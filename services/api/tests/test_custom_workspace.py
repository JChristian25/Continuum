import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import uuid

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import text

from continuum.acquisition import WORKSPACE
from continuum.config import Settings
from continuum.db import initialize, make_engine, session_factory
from continuum.main import create_app
from continuum.models import Account
from continuum.security import passwords
from continuum.worker import cleanup_rq_queue, run_operation
from conftest import sign_in


@pytest.fixture
def custom_setup():
    url = os.getenv("CONTINUUM_TEST_DATABASE_URL")
    if not url:
        env = Path(__file__).resolve().parents[1] / ".env"
        if env.exists():
            values = dict(line.split("=", 1) for line in env.read_text().splitlines() if line and not line.startswith("#"))
            url = values.get("CONTINUUM_DATABASE_URL")
    if not url:
        pytest.fail("Set CONTINUUM_TEST_DATABASE_URL to an isolated PostgreSQL database")

    base = WORKSPACE / "outputs" / "custom-tests"
    base.mkdir(parents=True, exist_ok=True)
    temp_dir = tempfile.TemporaryDirectory(dir=base)
    root = Path(temp_dir.name).resolve()
    inputs_root = root / "inputs"
    git_root = root / "git_repos"
    outside_root = root / "outside_git"
    inputs_root.mkdir()
    git_root.mkdir()
    outside_root.mkdir()

    db_root = make_engine(url)
    schema = "continuum_test_" + uuid.uuid4().hex
    with db_root.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = make_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    initialize(engine)
    factory = session_factory(engine)
    password = secrets.token_urlsafe(24)
    with factory.begin() as db:
        for identity, login in [("alice-id", "alice"), ("bob-id", "bob")]:
            db.add(Account(id=identity, login=login, display_name=login.title(), password_hash=passwords.hash(password)))

    settings = Settings(
        url,
        origin="https://test",
        allow_custom_workspaces=True,
        allow_local_git=True,
        local_git_roots=(str(git_root),),
        custom_inputs_root=str(inputs_root),
    )
    app = create_app(settings, engine, worker_enabled=False)
    with TestClient(app, base_url="https://test", raise_server_exceptions=False) as client:
        yield {
            "client": client,
            "engine": engine,
            "db": factory,
            "password": password,
            "schema": schema,
            "root": root,
            "git_root": git_root,
            "outside_root": outside_root,
            "inputs_root": inputs_root,
        }
    engine.dispose()
    cleanup_rq_queue(schema)
    with db_root.begin() as connection:
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    db_root.dispose()
    temp_dir.cleanup()


def _ask(client, headers, repo_id, query, body):
    res = client.post(
        "/api/v1/queries",
        headers=headers,
        json={"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "repositoryId": repo_id, "query": query, "input": body},
    )
    assert res.status_code == 200, res.text
    return res.json()["result"]


def test_custom_bundle_lifecycle_revision_comparison_and_isolation(custom_setup):
    client = custom_setup["client"]
    alice_headers = sign_in(custom_setup, login="alice", client=client)

    create_res = client.post(
        "/api/v1/workspaces",
        headers=alice_headers,
        json={
            "schemaVersion": "0.1.0",
            "requestId": uuid.uuid4().hex,
            "name": "payments/gateway",
            "mode": "bundle",
            "bundle": {
                "revisionLabel": "R0",
                "files": [
                    {
                        "path": "src/payments.py",
                        "content": "class Gateway:\n    def process_charge(self, amount: int) -> bool:\n        return amount > 0\n",
                    },
                    {
                        "path": "docs/architecture.md",
                        "content": "# Payments Architecture\n\nSee `src/payments.py` for `process_charge` validation.\n",
                    },
                    {
                        "path": "notes/limits.txt",
                        "content": "Temporary plain text limit note.\n",
                    },
                ],
            },
        },
    )
    assert create_res.status_code == 200, create_res.text
    created = create_res.json()["result"]
    repo_id = created["repositoryId"]
    op_r0 = created["captureOperations"][0]["operationId"]
    assert run_operation(custom_setup["db"], op_r0) is True

    # Run discovery on R0
    sel_r0 = created["selection"]
    ctx_r0 = _ask(client, alice_headers, repo_id, "select_context", sel_r0)
    disc_res = client.post(
        "/api/v1/commands",
        headers=alice_headers,
        json={
            "schemaVersion": "0.1.0",
            "requestId": uuid.uuid4().hex,
            "repositoryId": repo_id,
            "viewId": ctx_r0["repositoryViewId"],
            "command": "discover_candidates",
            "input": {k: sel_r0[k] for k in ("targetRevision", "inventoryId", "configurationId")},
        },
    )
    assert disc_res.status_code == 200, disc_res.text
    assert run_operation(custom_setup["db"], disc_res.json()["result"]["operationId"]) is True

    snap_r0 = _ask(client, alice_headers, repo_id, "read_snapshot", {"selection": sel_r0})
    ws_r0 = _ask(client, alice_headers, repo_id, "read_workspace", {"snapshotId": snap_r0["id"]})
    assert len(ws_r0["artifacts"]) == 3
    doc_to_code = next(
        a for a in ws_r0["assertions"]
        if any(art["artifactId"] == a["assertion"]["source"]["artifactId"] and art["path"] == "docs/architecture.md" for art in ws_r0["artifacts"])
    )

    # Confirm the baseline link
    view_r0 = _ask(
        client,
        alice_headers,
        repo_id,
        "open_review_view",
        {"repositoryViewId": ctx_r0["repositoryViewId"], "snapshotId": snap_r0["id"], "contextId": doc_to_code["projection"]["contextId"]},
    )
    judge = client.post(
        "/api/v1/commands",
        headers=alice_headers,
        json={
            "schemaVersion": "0.1.0",
            "requestId": uuid.uuid4().hex,
            "repositoryId": repo_id,
            "viewId": view_r0["viewId"],
            "command": "record_judgment",
            "input": {
                "contextId": doc_to_code["projection"]["contextId"],
                "assertionRevisionId": doc_to_code["assertion"]["id"],
                "expectedProjectionVersion": 0,
                "decision": "confirm",
                "reason": "Verified architecture doc against process_charge.",
                "reviewedEvidenceIds": doc_to_code["assertion"]["evidenceIds"],
                "contentConcern": None,
                "followUpDisposition": {"kind": "none"},
            },
        },
    )
    assert judge.status_code == 200, judge.text
    snap_r0_confirmed = _ask(client, alice_headers, repo_id, "read_snapshot", {"selection": sel_r0})

    # Add R1 modifying src/payments.py, keeping docs/architecture.md, adding new.py, dropping notes/limits.txt
    add_res = client.post(
        f"/api/v1/repositories/{repo_id}/revisions",
        headers=alice_headers,
        json={
            "schemaVersion": "0.1.0",
            "requestId": uuid.uuid4().hex,
            "mode": "bundle",
            "bundle": {
                "revisionLabel": "R1",
                "files": [
                    {
                        "path": "src/payments.py",
                        "content": "class Gateway:\n    def process_charge(self, amount: int, currency: str = 'USD') -> bool:\n        return amount > 0 and bool(currency)\n",
                    },
                    {
                        "path": "docs/architecture.md",
                        "content": "# Payments Architecture\n\nSee `src/payments.py` for `process_charge` validation.\n",
                    },
                    {
                        "path": "src/audit.py",
                        "content": "def log_charge(tx_id: str) -> None:\n    pass\n",
                    },
                ],
            },
        },
    )
    assert add_res.status_code == 200, add_res.text
    added = add_res.json()["result"]
    assert run_operation(custom_setup["db"], added["captureOperations"][0]["operationId"]) is True

    sel_r1 = added["selection"]
    ctx_r1 = _ask(client, alice_headers, repo_id, "select_context", sel_r1)
    snap_r1 = _ask(client, alice_headers, repo_id, "read_snapshot", {"selection": sel_r1})

    # Native Git comparison across custom inventories queues stale incoming review
    cmp_res = client.post(
        "/api/v1/commands",
        headers=alice_headers,
        json={
            "schemaVersion": "0.1.0",
            "requestId": uuid.uuid4().hex,
            "repositoryId": repo_id,
            "viewId": ctx_r1["repositoryViewId"],
            "command": "compare_revisions",
            "input": {"baseSnapshotId": snap_r0_confirmed["id"], "targetSnapshotId": snap_r1["id"]},
        },
    )
    assert cmp_res.status_code == 200, cmp_res.text
    cmp_sel = _ask(client, alice_headers, repo_id, "select_context", cmp_res.json()["result"]["selection"])
    cmp_ws = _ask(client, alice_headers, repo_id, "read_workspace", {"snapshotId": cmp_sel["snapshot"]["id"]})
    assert {c["kind"] for c in cmp_ws["comparison"]["changes"]} == {"modified", "added", "deleted"}
    assert any(a["projection"]["validity"] == "stale" for a in cmp_ws["assertions"])

    # Bob cannot see or mutate Alice's custom workspace
    bob_client = TestClient(client.app, base_url="https://test", raise_server_exceptions=False)
    bob_headers = sign_in(custom_setup, login="bob", client=bob_client)
    bob_ws = bob_client.get("/api/v1/workspace").json()
    assert bob_ws["repositories"] == []
    assert bob_ws["capabilities"]["customWorkspaces"] is True
    assert bob_client.post(
        f"/api/v1/repositories/{repo_id}/revisions",
        headers=bob_headers,
        json={"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "mode": "bundle", "bundle": {"revisionLabel": "R2", "files": [{"path": "x.py", "content": "x = 1\n"}]}},
    ).status_code == 403


def test_custom_bundle_rejects_unsafe_paths_limits_and_disabled_setting(custom_setup):
    client = custom_setup["client"]
    headers = sign_in(custom_setup, login="alice", client=client)

    bad_cases = [
        {"path": "../escape.py", "content": "x = 1\n"},
        {"path": "dir\\win.py", "content": "x = 1\n"},
        {"path": "binary.pdf", "content": "not allowed"},
        {"path": "src/nul.py", "content": "a = '\x00'"},
    ]
    for bad in bad_cases:
        res = client.post(
            "/api/v1/workspaces",
            headers=headers,
            json={"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "name": "bad/repo", "mode": "bundle", "bundle": {"revisionLabel": "R0", "files": [bad]}},
        )
        assert res.status_code == 422, f"Expected 422 for {bad['path']}, got {res.status_code}"

    too_many = [{"path": f"f_{i}.py", "content": f"x = {i}\n"} for i in range(26)]
    res_26 = client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "name": "many/repo", "mode": "bundle", "bundle": {"revisionLabel": "R0", "files": too_many}},
    )
    assert res_26.status_code == 422

    # Fail-closed when allow_custom_workspaces=False
    disabled_app = create_app(Settings(str(custom_setup["engine"].url.render_as_string(hide_password=False)), origin="https://test", allow_custom_workspaces=False), custom_setup["engine"], worker_enabled=False)
    with TestClient(disabled_app, base_url="https://test", raise_server_exceptions=False) as dclient:
        dheaders = sign_in(custom_setup, login="alice", client=dclient)
        blocked = dclient.post(
            "/api/v1/workspaces",
            headers=dheaders,
            json={"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "name": "blocked/repo", "mode": "bundle", "bundle": {"revisionLabel": "R0", "files": [{"path": "a.py", "content": "x = 1\n"}]}},
        )
        assert blocked.status_code == 403


def test_opt_in_local_git_import_and_root_boundary(custom_setup):
    git_bin = shutil.which("git")
    assert git_bin is not None
    repo = custom_setup["git_root"] / "mini-service"
    repo.mkdir()
    git_env = {**os.environ, "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "t@example.com", "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "t@example.com"}

    def git(*args):
        return subprocess.run([git_bin, "-C", str(repo), *args], env=git_env, capture_output=True, text=True, check=True).stdout.strip()

    git("init")
    (repo / "app.py").write_text("def handle_ping():\n    return 'ok'\n", encoding="utf-8")
    (repo / "README.md").write_text("# Mini Service\n\nHandles `handle_ping`.\n", encoding="utf-8")
    git("add", "app.py", "README.md")
    git("commit", "-m", "initial")
    c0 = git("rev-parse", "HEAD")

    (repo / "app.py").write_text("def handle_ping(strict: bool = True):\n    return 'ok' if strict else 'warn'\n", encoding="utf-8")
    git("add", "app.py")
    git("commit", "-m", "add strict mode")
    c1 = git("rev-parse", "HEAD")

    client = custom_setup["client"]
    headers = sign_in(custom_setup, login="alice", client=client)

    outside_res = client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={
            "schemaVersion": "0.1.0",
            "requestId": uuid.uuid4().hex,
            "name": "escape-git",
            "mode": "local_git",
            "localGit": {"repoPath": str(custom_setup["outside_root"]), "commits": [c0]},
        },
    )
    assert outside_res.status_code == 403

    ok_res = client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={
            "schemaVersion": "0.1.0",
            "requestId": uuid.uuid4().hex,
            "name": "mini-service",
            "mode": "local_git",
            "localGit": {"repoPath": str(repo), "commits": [c0, c1]},
        },
    )
    assert ok_res.status_code == 200, ok_res.text
    result = ok_res.json()["result"]
    assert len(result["captureOperations"]) == 2
    for op in result["captureOperations"]:
        assert run_operation(custom_setup["db"], op["operationId"]) is True


def test_chained_comparison_retains_corrected_assertion(custom_setup):
    client = custom_setup["client"]
    headers = sign_in(custom_setup, login="alice", client=client)

    def _cmd(repo_id, view_id, command_name, payload):
        res = client.post(
            "/api/v1/commands",
            headers=headers,
            json={"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "repositoryId": repo_id, "viewId": view_id, "command": command_name, "input": payload},
        )
        assert res.status_code == 200, res.text
        return res.json()["result"]

    c_res = client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={
            "schemaVersion": "0.1.0",
            "requestId": uuid.uuid4().hex,
            "name": "acme/chain-test",
            "mode": "bundle",
            "bundle": {
                "revisionLabel": "R0",
                "files": [
                    {"path": "svc.py", "content": "def calc(x):\n    return x * 2\n"},
                    {"path": "spec.md", "content": "# Spec\n\ncalc multiplies by two.\n"},
                ],
            },
        },
    )
    assert c_res.status_code == 200, c_res.text
    created = c_res.json()["result"]
    repo_id = created["repositoryId"]
    assert run_operation(custom_setup["db"], created["captureOperations"][0]["operationId"]) is True

    sel_r0 = created["selection"]
    ctx_r0 = _ask(client, headers, repo_id, "select_context", sel_r0)
    ws_r0 = _ask(client, headers, repo_id, "read_workspace", {"snapshotId": ctx_r0["snapshot"]["id"]})
    svc_r0 = next(a for a in ws_r0["artifacts"] if a["path"] == "svc.py")
    spec_r0 = next(a for a in ws_r0["artifacts"] if a["path"] == "spec.md")

    _cmd(repo_id, ctx_r0["repositoryViewId"], "capture_candidate", {
        "type": "documents",
        "sourceArtifactId": spec_r0["artifactId"],
        "sourceVersionId": spec_r0["versionId"],
        "targetArtifactId": svc_r0["artifactId"],
        "targetVersionId": svc_r0["versionId"],
        "targetRevision": sel_r0["targetRevision"],
        "evidence": [{"artifactVersionId": svc_r0["versionId"], "locator": {"kind": "lines", "startLine": 1, "endLine": 2}}],
        "reason": "Manual link in R0",
        "predecessorContextId": None,
    })
    snap_cand = _ask(client, headers, repo_id, "read_snapshot", {"selection": sel_r0})
    ws_cand = _ask(client, headers, repo_id, "read_workspace", {"snapshotId": snap_cand["id"]})
    row_r0 = ws_cand["assertions"][0]
    v_r0 = _ask(client, headers, repo_id, "open_review_view", {"repositoryViewId": ctx_r0["repositoryViewId"], "snapshotId": snap_cand["id"], "contextId": row_r0["projection"]["contextId"]})
    _cmd(repo_id, v_r0["viewId"], "record_judgment", {
        "contextId": row_r0["projection"]["contextId"],
        "assertionRevisionId": row_r0["assertion"]["id"],
        "expectedProjectionVersion": row_r0["projection"]["projectionVersion"],
        "decision": "confirm",
        "reason": "Confirmed in R0",
        "reviewedEvidenceIds": [e["id"] for e in row_r0["evidence"]],
        "contentConcern": None,
        "followUpDisposition": {"kind": "none"},
    })
    snap_r0 = _ask(client, headers, repo_id, "read_snapshot", {"selection": sel_r0})

    def _add_rev(label, svc_text):
        r = client.post(
            f"/api/v1/repositories/{repo_id}/revisions",
            headers=headers,
            json={
                "schemaVersion": "0.1.0",
                "requestId": uuid.uuid4().hex,
                "mode": "bundle",
                "bundle": {"revisionLabel": label, "files": [{"path": "svc.py", "content": svc_text}, {"path": "spec.md", "content": "# Spec\n\ncalc multiplies by two.\n"}]},
            },
        )
        assert r.status_code == 200, r.text
        added = r.json()["result"]
        assert run_operation(custom_setup["db"], added["captureOperations"][0]["operationId"]) is True
        return added["selection"]

    sel_r1 = _add_rev("R1", "# shifted\ndef calc(x):\n    return x * 2\n")
    ctx_r1 = _ask(client, headers, repo_id, "select_context", sel_r1)
    cmp_r0_r1 = _cmd(repo_id, ctx_r1["repositoryViewId"], "compare_revisions", {"baseSnapshotId": snap_r0["id"], "targetSnapshotId": ctx_r1["snapshot"]["id"]})
    ctx_cmp1 = _ask(client, headers, repo_id, "select_context", cmp_r0_r1["selection"])
    ws_cmp1 = _ask(client, headers, repo_id, "read_workspace", {"snapshotId": ctx_cmp1["snapshot"]["id"]})
    stale_row = ws_cmp1["assertions"][0]
    svc_r1 = next(a for a in ws_cmp1["artifacts"] if a["path"] == "svc.py")
    spec_r1 = next(a for a in ws_cmp1["artifacts"] if a["path"] == "spec.md")

    v_cmp1 = _ask(client, headers, repo_id, "open_review_view", {"repositoryViewId": ctx_cmp1["repositoryViewId"], "snapshotId": ctx_cmp1["snapshot"]["id"], "contextId": stale_row["projection"]["contextId"]})
    corr = _cmd(repo_id, v_cmp1["viewId"], "correct_assertion", {
        "contextId": stale_row["projection"]["contextId"],
        "assertionRevisionId": stale_row["assertion"]["id"],
        "expectedProjectionVersion": stale_row["projection"]["projectionVersion"],
        "reason": "Update anchor to lines 2-3 after header comment",
        "replacement": {
            "type": "documents",
            "sourceArtifactId": spec_r1["artifactId"],
            "sourceVersionId": spec_r1["versionId"],
            "targetArtifactId": svc_r1["artifactId"],
            "targetVersionId": svc_r1["versionId"],
            "evidenceIds": [],
            "newEvidence": [{"artifactVersionId": svc_r1["versionId"], "locator": {"kind": "lines", "startLine": 2, "endLine": 3}}],
        },
    })
    succ_ctx_id = corr["successorProjection"]["contextId"]
    snap_cmp1_corr = _ask(client, headers, repo_id, "read_snapshot", {"selection": cmp_r0_r1["selection"]})
    ws_after_corr = _ask(client, headers, repo_id, "read_workspace", {"snapshotId": snap_cmp1_corr["id"]})
    succ_row = next(a for a in ws_after_corr["assertions"] if a["projection"]["contextId"] == succ_ctx_id)
    v_succ = _ask(client, headers, repo_id, "open_review_view", {"repositoryViewId": ctx_cmp1["repositoryViewId"], "snapshotId": snap_cmp1_corr["id"], "contextId": succ_ctx_id})
    _cmd(repo_id, v_succ["viewId"], "record_judgment", {
        "contextId": succ_ctx_id,
        "assertionRevisionId": succ_row["assertion"]["id"],
        "expectedProjectionVersion": succ_row["projection"]["projectionVersion"],
        "decision": "confirm",
        "reason": "Re-anchored and confirmed in R1",
        "reviewedEvidenceIds": [e["id"] for e in succ_row["evidence"]],
        "contentConcern": None,
        "followUpDisposition": {"kind": "none"},
    })
    snap_cmp1_final = _ask(client, headers, repo_id, "read_snapshot", {"selection": cmp_r0_r1["selection"]})

    # Verify both superseded and confirmed successor exist on R0->R1 with same assertionId, yet R1->R2 carries the active confirmed one regardless of UUID ordering.
    ws_cmp1_final = _ask(client, headers, repo_id, "read_workspace", {"snapshotId": snap_cmp1_final["id"]})
    same_assertion_ids = [a for a in ws_cmp1_final["assertions"] if a["assertion"]["assertionId"] == row_r0["assertion"]["assertionId"]]
    assert {a["projection"]["resolution"] for a in same_assertion_ids} == {"superseded", "resolved"}

    sel_r2 = _add_rev("R2", "# shifted\ndef calc(x):\n    return x * 3\n")
    ctx_r2 = _ask(client, headers, repo_id, "select_context", sel_r2)
    cmp_r1_r2 = _cmd(repo_id, ctx_r2["repositoryViewId"], "compare_revisions", {"baseSnapshotId": snap_cmp1_final["id"], "targetSnapshotId": ctx_r2["snapshot"]["id"]})
    ctx_cmp2 = _ask(client, headers, repo_id, "select_context", cmp_r1_r2["selection"])
    ws_cmp2 = _ask(client, headers, repo_id, "read_workspace", {"snapshotId": ctx_cmp2["snapshot"]["id"]})
    assert len(ws_cmp2["assertions"]) == 1
    assert ws_cmp2["assertions"][0]["projection"]["validity"] == "stale"
