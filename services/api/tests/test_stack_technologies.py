import uuid

import pytest

from continuum.access import GraphInput
from continuum.discovery import (
    Source,
    code_index,
    extract_document_lines,
    extract_markdown_sections,
    extract_python_symbols,
    parse_python_ast_summary,
)
from continuum.graph_store import get_driver, query_neighborhood, snapshot_key_for
from continuum.pipeline_models import Snapshot
from continuum.worker import get_redis_connection, get_rq_queue, run_operation, worker_once
from test_capture import record, send
from test_discovery import profile, source
from test_pipeline import ask, captured, pipeline, submit


def test_treesitter_python_ast_extracts_identifiers_and_detects_syntax_errors(profile):
    valid = (
        "from __future__ import annotations\n"
        "def health_check(timeout_ms: int) -> bool:\n"
        "    return timeout_ms > 0\n"
    )
    summary = parse_python_ast_summary(valid)
    assert summary["engine"] == "tree-sitter-python"
    assert summary["hasError"] is False
    assert summary["identifierCount"] >= 5

    index = code_index(source("hc/health.py", valid), profile)
    assert index["future"] == {"kind": "lines", "startLine": 1, "endLine": 1}
    assert index["health"] == {"kind": "lines", "startLine": 2, "endLine": 2}
    assert index["timeout"] == {"kind": "lines", "startLine": 2, "endLine": 2}

    broken_syntax = "def broken():\n    return :\n"
    broken_summary = parse_python_ast_summary(broken_syntax)
    assert broken_summary["engine"] == "tree-sitter-python"
    assert broken_summary["hasError"] is True
    with pytest.raises(SyntaxError, match="Tree-sitter"):
        code_index(source("hc/broken.py", broken_syntax), profile)


def test_docling_extracts_markdown_structure_and_preserves_line_locators():
    md_source = Source(
        path="docs/overview.md",
        kind="document",
        format="Markdown",
        commit="1" * 40,
        blob="2" * 40,
        digest="3" * 64,
        text="# Overview\n\nSee `hc/check.py` for failure handling.\n",
    )
    lines, meta = extract_document_lines(md_source)
    assert meta["engine"] == "docling"
    assert meta["fallbackUsed"] is False
    assert meta["structuredItems"] >= 2
    assert lines == [
        (1, "# Overview"),
        (2, ""),
        (3, "See `hc/check.py` for failure handling."),
    ]

    txt_source = Source(
        path="docs/notes.txt",
        kind="document",
        format="plain-text",
        commit="1" * 40,
        blob="4" * 40,
        digest="5" * 64,
        text="Line one\nLine two\n",
    )
    txt_lines, txt_meta = extract_document_lines(txt_source)
    assert txt_meta["engine"] == "plain_text_fallback"
    assert txt_meta["fallbackUsed"] is True
    assert txt_lines == [(1, "Line one"), (2, "Line two")]


def test_redis_rq_enqueues_and_simple_worker_executes_operation(pipeline):
    conn = get_redis_connection()
    assert conn is not None and conn.ping() is True

    _, admission = submit(pipeline)
    operation_id = admission["result"]["operationId"]

    queue = get_rq_queue(conn, schema=pipeline["schema"])
    job = queue.fetch_job(f"continuum-op-{operation_id}")
    assert job is not None
    assert job.get_status(refresh=True) == "queued"

    assert worker_once(pipeline["db"]) is True

    job.refresh()
    assert job.get_status(refresh=True) == "finished"
    assert job.return_value() is True

    op = ask(pipeline, pipeline["headers"], "read_operation", {"operationId": operation_id})
    assert op["status"] == "complete"
    workspace = ask(pipeline, pipeline["headers"], "read_workspace", {"snapshotId": op["resultSnapshotId"]})
    assert len(workspace["artifacts"]) == 10


def test_neo4j_projects_snapshot_and_serves_typed_neighborhood_cypher(captured):
    _, queued = submit(captured, "discover_candidates")
    assert run_operation(captured["db"], queued["result"]["operationId"]) is True

    created = send(captured, "capture_record", {**record("requirement"), "content": "Verify Neo4j projection."}).json()["result"]
    snapshot = ask(captured, captured["headers"], "read_snapshot", {"selection": captured["selection"]})
    workspace = ask(captured, captured["headers"], "read_workspace", {"snapshotId": snapshot["id"]})
    code_artifact = next(a for a in workspace["artifacts"] if a["kind"] == "code")

    manual = send(
        captured,
        "capture_candidate",
        {
            "targetRevision": captured["selection"]["targetRevision"],
            "type": "implements",
            "sourceArtifactId": code_artifact["artifactId"],
            "targetArtifactId": created["artifactId"],
            "sourceVersionId": code_artifact["versionId"],
            "targetVersionId": created["artifactVersionId"],
            "evidence": [
                {
                    "artifactVersionId": created["artifactVersionId"],
                    "locator": {"kind": "lines", "startLine": 1, "endLine": 1},
                }
            ],
            "reason": "Verify Neo4j IMPLEMENTS projection.",
            "predecessorContextId": None,
        },
    )
    assert manual.status_code == 200, manual.text

    latest_snap = ask(captured, captured["headers"], "read_snapshot", {"selection": captured["selection"]})
    with captured["db"]() as db:
        snap_row = db.get(Snapshot, latest_snap["id"])
        assert snap_row is not None

    driver, database = get_driver(verify=True)
    assert driver is not None
    skey = snapshot_key_for(snap_row)

    records, _, _ = driver.execute_query(
        """
        MATCH (s:ContinuumSnapshot {snapshotKey: $snapshotKey})
        OPTIONAL MATCH (s)-[:HAS_ARTIFACT]->(a:ContinuumArtifact)
        OPTIONAL MATCH (s)-[:HAS_CONTEXT]->(c:ContinuumAssertionContext)
        RETURN s.synced AS synced,
               count(DISTINCT a) AS artifactCount,
               count(DISTINCT c) AS contextCount
        """,
        snapshotKey=skey,
        database_=database,
    )
    assert len(records) == 1
    assert records[0]["synced"] is True
    assert records[0]["artifactCount"] == 11
    assert records[0]["contextCount"] == 20

    rel_records, _, _ = driver.execute_query(
        """
        MATCH (:ContinuumArtifact {snapshotKey: $snapshotKey})-[r:DOCUMENTS|IMPLEMENTS]->(:ContinuumArtifact {snapshotKey: $snapshotKey})
        RETURN type(r) AS relType, count(r) AS relCount
        """,
        snapshotKey=skey,
        database_=database,
    )
    rel_counts = {row["relType"]: row["relCount"] for row in rel_records}
    assert rel_counts.get("DOCUMENTS", 0) == 19
    assert rel_counts.get("IMPLEMENTS", 0) == 1

    direct_items, root_node = query_neighborhood(
        snap_row,
        GraphInput(
            snapshotId=snap_row.id,
            rootArtifactId=code_artifact["artifactId"],
            relationTypes=["implements"],
            direction="outgoing",
            depth=1,
            pageSize=30,
        ),
        raise_on_error=True,
    )
    assert root_node["artifactId"] == code_artifact["artifactId"]
    assert len(direct_items) == 1
    assert direct_items[0]["edge"]["type"] == "implements"

    api_graph = ask(
        captured,
        captured["headers"],
        "read_graph",
        {
            "snapshotId": latest_snap["id"],
            "rootArtifactId": code_artifact["artifactId"],
            "relationTypes": ["implements", "documents"],
            "direction": "both",
            "depth": 1,
        },
    )
    assert any(edge["type"] == "implements" for edge in api_graph["edges"])
    assert any(edge["type"] == "documents" for edge in api_graph["edges"])

    # Verify structural counts were projected onto :ContinuumArtifact nodes in Neo4j
    struct_rows, _, _ = driver.execute_query(
        """
        MATCH (:ContinuumSnapshot {snapshotKey: $snapshotKey})-[:HAS_ARTIFACT]->(a:ContinuumArtifact)
        WHERE a.kind = 'code'
        RETURN a.path AS path, a.structureEngine AS engine, a.symbolCount AS symbolCount
        """,
        snapshotKey=skey,
        database_=database,
    )
    assert struct_rows
    assert all(row["engine"] == "tree-sitter-python" for row in struct_rows)
    assert any(row["symbolCount"] > 0 for row in struct_rows)


def test_structural_extraction_endpoints_and_fallbacks(captured):
    python_src = (
        "class PaymentService:\n"
        "    @staticmethod\n"
        "    async def charge(amount: int) -> bool:\n"
        "        return amount > 0\n\n"
        "def helper():\n"
        "    return 1\n"
    )
    py_struct = extract_python_symbols(python_src)
    assert py_struct["engine"] == "tree-sitter-python"
    assert py_struct["hasError"] is False
    assert [(s["kind"], s["qualifiedName"], s["startLine"], s["endLine"]) for s in py_struct["items"]] == [
        ("class", "PaymentService", 1, 4),
        ("method", "PaymentService.charge", 2, 4),
        ("function", "helper", 6, 7),
    ]

    broken = extract_python_symbols("def bad(:\n    pass\n")
    assert broken["hasError"] is True

    md_src = (
        "# Service Guide\n\nIntro paragraph.\n\n"
        "## Filtering Rules\n\nDetails here.\n\n"
        "```python\ndef demo():\n    pass\n```\n"
    )
    md_struct = extract_markdown_sections(md_src, "guide.md")
    assert md_struct["engine"] == "docling"
    assert md_struct["fallbackUsed"] is False
    assert any(i["kind"] == "section" and i["name"] == "Service Guide" and i["startLine"] == 1 for i in md_struct["items"])
    assert any(i["kind"] == "section" and i["name"] == "Filtering Rules" and i["startLine"] == 5 and i["endLine"] == 12 for i in md_struct["items"])
    assert any(i["kind"] == "code_block" and i["startLine"] == 9 and i["endLine"] == 12 for i in md_struct["items"])

    # Verify version HTTP endpoint attaches additive structure while keeping contentDigest intact
    snap = ask(captured, captured["headers"], "read_snapshot", {"selection": captured["selection"]})
    ws = ask(captured, captured["headers"], "read_workspace", {"snapshotId": snap["id"]})
    py_art = next(a for a in ws["artifacts"] if a["path"].endswith(".py"))
    md_art = next(a for a in ws["artifacts"] if a["path"].endswith(".md"))
    txt_art = next(a for a in ws["artifacts"] if a["path"].endswith(".txt"))

    py_ver = captured["client"].get(f"/api/v1/repositories/repo/versions/{py_art['versionId']}").json()
    assert py_ver["structure"]["engine"] == "tree-sitter-python"
    assert len(py_ver["structure"]["items"]) > 0

    md_ver = captured["client"].get(f"/api/v1/repositories/repo/versions/{md_art['versionId']}").json()
    assert md_ver["structure"]["engine"] == "docling"
    assert len(md_ver["structure"]["items"]) > 0

    txt_ver = captured["client"].get(f"/api/v1/repositories/repo/versions/{txt_art['versionId']}").json()
    assert txt_ver["structure"]["engine"] == "plain_text"
    assert txt_ver["structure"]["items"] == []
