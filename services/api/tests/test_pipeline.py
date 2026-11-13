import os
from pathlib import Path
import subprocess
import sys
import uuid

import pytest
from sqlalchemy import func, select, text

from continuum.acquisition import WORKSPACE
from continuum.discovery import load_sources
from continuum.models import ArtifactVersion, Grant, ReviewContext, ReviewEvent
from continuum.pipeline import register_input, register_profile
from continuum.pipeline_models import Operation, SelectionArtifact, SelectionContext
from continuum.worker import claim, publish, renew, run_operation, worker_once
from conftest import sign_in

CHANGE = WORKSPACE / "openspec/changes/establish-versioned-continuity-core"


def ask(setup, headers, query, body):
    response = setup["client"].post("/api/v1/queries", headers=headers, json={"schemaVersion": "0.1.0",
        "requestId": uuid.uuid4().hex, "repositoryId": "repo", "query": query, "input": body})
    assert response.status_code == 200, response.text
    return response.json()["result"]


@pytest.fixture
def pipeline(setup):
    # Accepted real Healthchecks source, isolated synthetic service accounts/database schema.
    with setup["db"].begin() as db:
        inventory = register_input(db, "repo", CHANGE / "healthchecks-input-manifest.proposed.json", CHANGE / "healthchecks-input-acceptance.json")
        profile = register_profile(db, "repo", inventory.id, CHANGE / "discovery-profile.proposed.json", CHANGE / "discovery-profile-acceptance.json")
        selection = {"repositoryId": "repo", "targetRevision": {"objectAlgorithm": "sha1", "commitId": "0f78e117eadb59a01dd51e09344479fa3eeb4187"},
                     "baseRevision": None, "inventoryId": inventory.id, "configurationId": profile.id}
    headers = sign_in(setup)
    selected = ask(setup, headers, "select_context", selection)
    return {**setup, "headers": headers, "selection": selection, "selected": selected}


def submit(pipeline, command="capture_files"):
    selected, selection = pipeline["selected"], pipeline["selection"]
    body = {"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "repositoryId": "repo",
            "viewId": selected["repositoryViewId"], "command": command,
            "input": {key: selection[key] for key in ["targetRevision", "inventoryId", "configurationId"]}}
    response = pipeline["client"].post("/api/v1/commands", headers=pipeline["headers"], json=body)
    assert response.status_code == 200, response.text
    assert response.json()["result"]["status"] == "queued"
    return body, response.json()


def operation(pipeline, identity):
    return ask(pipeline, pipeline["headers"], "read_operation", {"operationId": identity})


@pytest.fixture
def captured(pipeline):
    _, admission = submit(pipeline)
    identity = admission["result"]["operationId"]
    assert run_operation(pipeline["db"], identity)
    assert operation(pipeline, identity)["status"] == "complete"
    return pipeline


def test_capture_admission_is_durable_and_retry_returns_original_receipt(pipeline):
    body, response = submit(pipeline)
    identity = response["result"]["operationId"]
    assert operation(pipeline, identity)["status"] == "queued"
    with pipeline["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectionArtifact)) == 0
    assert run_operation(pipeline["db"], identity)
    assert operation(pipeline, identity)["resultSnapshotId"] is not None
    replay = pipeline["client"].post("/api/v1/commands", headers=pipeline["headers"], json=body)
    assert replay.json() == response
    with pipeline["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectionArtifact)) == 10
        assert db.scalar(select(func.count()).select_from(Operation)) == 1
    assert not run_operation(pipeline["db"], identity)


def test_capture_results_pages_retain_membership_and_exact_sources(captured):
    with captured["db"]() as db:
        identity = db.scalar(select(Operation.id).where(Operation.kind == "capture"))
    first = ask(captured, captured["headers"], "read_capture_results", {"operationId": identity, "cursor": None, "pageSize": 3})
    second = ask(captured, captured["headers"], "read_capture_results", {"operationId": identity, "cursor": first["nextCursor"], "pageSize": 3})
    assert first["snapshotResultCount"] == second["snapshotResultCount"] == 10
    assert not ({item["artifactId"] for item in first["items"]} & {item["artifactId"] for item in second["items"]})
    version_id = first["items"][0]["artifactVersionId"]
    source = captured["client"].get(f"/api/v1/repositories/repo/versions/{version_id}").json()
    assert source["identity"]["commit"] == captured["selection"]["targetRevision"]
    assert source["identity"]["blobId"]
    assert source["identity"]["provenance"]["agent"]["kind"] == "system"


def test_discovery_publishes_candidates_and_exact_evidence_for_review(captured):
    _, queued = submit(captured, "discover_candidates")
    identity = queued["result"]["operationId"]
    assert run_operation(captured["db"], identity)
    results = ask(captured, captured["headers"], "read_discovery_results", {"operationId": identity, "cursor": None, "pageSize": 100})
    assert results["operation"]["status"] == "complete"
    assert len(results["items"]) == 19
    assert all(item["origin"] == "automatic" for item in results["items"])
    with captured["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectionContext)) == 19
        assert db.scalar(select(func.count()).select_from(ReviewEvent)) == 0
    snapshot = ask(captured, captured["headers"], "read_snapshot", {"selection": captured["selection"]})
    assert snapshot["pendingReviewCount"] == 19
    assert next(item for item in snapshot["coverage"] if item["function"] == "evidence")["processedCount"] == 21
    context_id = results["items"][0]["contextId"]
    view = ask(captured, captured["headers"], "open_review_view", {"repositoryViewId": captured["selected"]["repositoryViewId"],
               "snapshotId": snapshot["id"], "contextId": context_id})
    detail = captured["client"].get(f"/api/v1/repositories/repo/contexts/{context_id}", params={"viewId": view["viewId"]}).json()
    assert detail["projection"]["validity"] == "candidate"
    for evidence in detail["evidence"]:
        readable = captured["client"].get(f"/api/v1/repositories/repo/evidence/{evidence['id']}")
        assert readable.status_code == 200 and readable.json()["availability"] == "available"
    body = {"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "repositoryId": "repo", "viewId": view["viewId"],
        "command": "record_judgment", "input": {"contextId": context_id, "assertionRevisionId": view["assertionRevisionId"],
        "expectedProjectionVersion": 0, "decision": "confirm", "reason": "Synthetic account verifies the readable exact-source command path; no research rating.",
        "reviewedEvidenceIds": results["items"][0]["evidenceIds"], "contentConcern": None, "followUpDisposition": {"kind": "none"}}}
    response = captured["client"].post("/api/v1/commands", headers=captured["headers"], json=body)
    assert response.status_code == 200, response.text
    old = captured["client"].get(f"/api/v1/repositories/repo/contexts/{context_id}", params={"viewId": view["viewId"]}).json()
    assert old["mode"] == "historical" and old["projection"]["validity"] == "candidate"
    refreshed = ask(captured, captured["headers"], "read_snapshot", {"selection": captured["selection"]})
    assert refreshed["pendingReviewCount"] == 18
    retained_history = captured["client"].get(f"/api/v1/repositories/repo/contexts/{context_id}/history", params={"viewId": view["viewId"]}).json()
    assert retained_history["snapshotSequence"] == 0 and retained_history["items"] == []
    changed = {**body, "requestId": uuid.uuid4().hex}
    assert captured["client"].post("/api/v1/commands", headers=captured["headers"], json=changed).json()["error"]["code"] == "snapshot_conflict"
    assert captured["client"].post("/api/v1/commands", headers=captured["headers"], json=body).json() == response.json()
    _, rerun = submit(captured, "discover_candidates")
    assert run_operation(captured["db"], rerun["result"]["operationId"])
    with captured["db"]() as db:
        assert db.get(ReviewContext, context_id).validity == "confirmed"
        assert db.scalar(select(func.count()).select_from(SelectionContext)) == 19


@pytest.mark.parametrize("when", ["before_claim", "before_publication"])
def test_revoked_reviewer_cannot_publish_source(pipeline, when):
    _, queued = submit(pipeline)
    identity = queued["result"]["operationId"]
    claimed = claim(pipeline["db"], identity) if when == "before_publication" else None
    with pipeline["db"].begin() as db:
        db.get(Grant, ("reviewer", "repo")).role = "viewer"
    if claimed:
        _, sources = load_sources(claimed["manifestPath"], claimed["acceptancePath"], "codeBase")
        assert not publish(pipeline["db"], claimed, sources)
    else:
        assert not run_operation(pipeline["db"], identity)
    assert operation(pipeline, identity)["status"] == "failed"
    with pipeline["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectionArtifact)) == 0


def test_expired_lease_generation_fences_older_worker(pipeline):
    _, queued = submit(pipeline)
    identity = queued["result"]["operationId"]
    first = claim(pipeline["db"], identity)
    with pipeline["db"].begin() as db:
        db.get(Operation, identity).lease_until = 0
    second = claim(pipeline["db"], identity)
    assert second["generation"] == first["generation"] + 1
    _, sources = load_sources(first["manifestPath"], first["acceptancePath"], "codeBase")
    assert not publish(pipeline["db"], first, sources)
    assert publish(pipeline["db"], second, sources)


def test_storage_failure_publishes_no_partial_artifact_records(pipeline):
    _, queued = submit(pipeline)
    identity = queued["result"]["operationId"]
    with pipeline["engine"].begin() as connection:
        connection.execute(text("""CREATE FUNCTION reject_capture() RETURNS trigger LANGUAGE plpgsql AS $$
                                 BEGIN RAISE EXCEPTION 'Synthetic capture failure'; END $$"""))
        connection.execute(text("CREATE TRIGGER fail_capture BEFORE INSERT ON artifact_versions FOR EACH ROW EXECUTE FUNCTION reject_capture()"))
    assert not run_operation(pipeline["db"], identity)
    assert operation(pipeline, identity)["status"] == "failed"
    with pipeline["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectionArtifact)) == 0
        assert db.scalar(select(func.count()).select_from(ArtifactVersion)) == 2


@pytest.mark.parametrize("command", ["capture_files", "discover_candidates"])
def test_viewer_read_permission_does_not_allow_job_admission(pipeline, command):
    headers = sign_in(pipeline, "bob")
    body = {"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "repositoryId": "repo",
        "viewId": pipeline["selected"]["repositoryViewId"], "command": command,
        "input": {key: pipeline["selection"][key] for key in ["targetRevision", "inventoryId", "configurationId"]}}
    assert pipeline["client"].post("/api/v1/commands", headers=headers, json=body).status_code == 403
    assert ask(pipeline, headers, "select_context", pipeline["selection"])["snapshot"]["pendingReviewCount"] == 0


def test_separate_worker_process_picks_up_durable_admission(pipeline):
    _, queued = submit(pipeline)
    url = pipeline["engine"].url.update_query_dict({"options": "-csearch_path=" + pipeline["schema"]})
    environment = {**os.environ, "CONTINUUM_DATABASE_URL": url.render_as_string(hide_password=False),
                   "CONTINUUM_ORIGIN": "https://test", "CONTINUUM_LOCAL_HTTP": "0"}
    process = subprocess.run([sys.executable, "-m", "continuum.admin", "worker-once"], env=environment,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    assert process.returncode == 0, "Worker process failed"
    assert operation(pipeline, queued["result"]["operationId"])["status"] == "complete"


def test_missing_capture_fails_discovery_without_publishing_contexts(pipeline):
    _, queued = submit(pipeline, "discover_candidates")
    identity = queued["result"]["operationId"]
    assert not run_operation(pipeline["db"], identity)
    assert operation(pipeline, identity)["status"] == "failed"
    with pipeline["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectionContext)) == 0


@pytest.mark.parametrize("reason", ["deadline", "attempts"])
def test_job_deadline_and_attempt_limit_are_explicit(pipeline, reason):
    _, queued = submit(pipeline)
    identity = queued["result"]["operationId"]
    with pipeline["db"].begin() as db:
        current = db.get(Operation, identity)
        if reason == "deadline":
            current.deadline_at = 0
        else:
            current.attempts = 3
    assert claim(pipeline["db"], identity) is None
    public = operation(pipeline, identity)
    assert public["status"] == "failed" and "maximumAttempts" in public["limitations"][0]


def test_heartbeat_renews_only_current_authorized_lease(pipeline):
    import time
    _, queued = submit(pipeline)
    identity = queued["result"]["operationId"]
    current = claim(pipeline["db"], identity)
    with pipeline["db"].begin() as db:
        db.get(Operation, identity).lease_until = int(time.time()) + 1
    assert renew(pipeline["db"], current)
    with pipeline["db"].begin() as db:
        assert db.get(Operation, identity).lease_until > int(time.time()) + 10
        db.get(Grant, ("reviewer", "repo")).role = "viewer"
    assert not renew(pipeline["db"], current)
    assert operation(pipeline, identity)["status"] == "failed"


def test_single_worker_slot_prevents_parallel_processing(pipeline):
    _, queued = submit(pipeline)
    with pipeline["engine"].connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(hashtext(current_schema()), hashtext('continuum-worker-v1'))"))
        connection.commit()
        try:
            assert not worker_once(pipeline["db"])
            assert operation(pipeline, queued["result"]["operationId"])["status"] == "queued"
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(hashtext(current_schema()), hashtext('continuum-worker-v1'))"))
            connection.commit()


def test_changed_selection_fails_stale_publication_without_overwriting_work(pipeline):
    _, first = submit(pipeline)
    current = claim(pipeline["db"], first["result"]["operationId"])
    _, sources = load_sources(current["manifestPath"], current["acceptancePath"], "codeBase")
    _, second = submit(pipeline)
    assert run_operation(pipeline["db"], second["result"]["operationId"])
    assert not publish(pipeline["db"], current, sources)
    public = operation(pipeline, first["result"]["operationId"])
    assert public["status"] == "failed" and "context changed" in public["limitations"][0]
    with pipeline["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectionArtifact)) == 10


def test_api_embedded_worker_processes_admitted_capture(pipeline):
    import socket
    import time
    import httpx

    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    url = pipeline["engine"].url.update_query_dict({"options": "-csearch_path=" + pipeline["schema"]})
    environment = {**os.environ, "CONTINUUM_DATABASE_URL": url.render_as_string(hide_password=False),
                   "CONTINUUM_ORIGIN": origin, "CONTINUUM_LOCAL_HTTP": "1"}
    process = subprocess.Popen([sys.executable, "-m", "uvicorn", "continuum.main:app_factory", "--factory",
        "--host", "127.0.0.1", "--port", str(port), "--no-access-log"], env=environment,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    try:
        with httpx.Client(base_url=origin, timeout=5) as client:
            deadline = time.monotonic() + 15
            while True:
                assert process.poll() is None, "API process exited"
                try:
                    if client.get("/api/v1/health").status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                assert time.monotonic() < deadline, "API did not become ready"
                time.sleep(0.05)
            bootstrap = client.get("/api/v1/auth/bootstrap").json()
            login = client.post("/api/v1/auth/login", headers={"Origin": origin, "X-CSRF-Token": bootstrap["csrfToken"]},
                json={"schemaVersion": "0.1.0", "requestId": "embedded-worker-login", "login": "alice", "password": pipeline["password"]})
            assert login.status_code == 200
            session = client.get("/api/v1/auth/session").json()
            headers = {"Origin": origin, "X-CSRF-Token": session["csrfToken"]}
            request = {"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "repositoryId": "repo",
                "viewId": pipeline["selected"]["repositoryViewId"], "command": "capture_files",
                "input": {key: pipeline["selection"][key] for key in ["targetRevision", "inventoryId", "configurationId"]}}
            admitted = client.post("/api/v1/commands", headers=headers, json=request)
            assert admitted.status_code == 200 and admitted.json()["result"]["status"] == "queued"
            operation_id = admitted.json()["result"]["operationId"]
            deadline = time.monotonic() + 15
            while True:
                response = client.post("/api/v1/queries", headers=headers, json={"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex,
                    "repositoryId": "repo", "query": "read_operation", "input": {"operationId": operation_id}})
                assert response.status_code == 200
                status = response.json()["result"]["status"]
                if status not in {"queued", "running"}:
                    assert status == "complete", response.text
                    break
                assert time.monotonic() < deadline, "Embedded worker did not publish capture"
                time.sleep(0.05)
            with pipeline["db"]() as db:
                assert db.scalar(select(func.count()).select_from(SelectionArtifact)) == 10
    finally:
        process.terminate()
        process.wait(timeout=10)
