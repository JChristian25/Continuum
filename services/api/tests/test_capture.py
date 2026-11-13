import uuid

import pytest
from sqlalchemy import func, select

from continuum.models import ArtifactVersion, Assertion, ReviewContext, ReviewEvent
from continuum.pipeline_models import SelectedRecord, SelectionArtifact
from conftest import sign_in
from test_pipeline import ask, captured, pipeline, submit
from continuum.worker import run_operation


def send(setup, command, data, request_id=None):
    body = {"schemaVersion": "0.1.0", "requestId": request_id or uuid.uuid4().hex, "repositoryId": "repo",
            "viewId": setup["selected"]["repositoryViewId"], "command": command, "input": data}
    return setup["client"].post("/api/v1/commands", headers=setup["headers"], json=body)


def record(kind="decision"):
    return {"kind": kind, "title": "Synthetic verification record", "content": "Keep relationship validity separate from follow-up work.",
            "sourceReference": None, "sourceAbsenceReason": "Authored by an isolated synthetic account for service verification."}


@pytest.mark.parametrize("kind", ["requirement", "decision"])
def test_authored_records_are_attributed_versioned_and_do_not_confirm_links(pipeline, kind):
    request_id = uuid.uuid4().hex
    first = send(pipeline, "capture_record", record(kind), request_id)
    assert first.status_code == 200, first.text
    created = first.json()["result"]
    assert created["recordVersion"] == 1
    assert send(pipeline, "capture_record", record(kind), request_id).json() == first.json()
    version = pipeline["client"].get(f"/api/v1/repositories/repo/versions/{created['artifactVersionId']}").json()
    assert version["identity"]["kind"] == "record" and "commit" not in version["identity"]
    assert version["identity"]["provenance"]["agent"] == {"kind": "practitioner", "id": "reviewer"}
    changed = {key: value for key, value in record(kind).items() if key != "kind"}
    changed.update(artifactId=created["artifactId"], expectedRecordVersion=1,
                   content="Retain exact earlier versions and accountable decisions.", reason="Clarify this synthetic verification record.")
    revised = send(pipeline, "revise_record", changed)
    assert revised.status_code == 200, revised.text
    assert revised.json()["result"]["recordVersion"] == 2
    stale = send(pipeline, "revise_record", changed)
    assert stale.status_code == 409 and stale.json()["error"]["details"] == {"currentRecordVersion": 2}
    retained = pipeline["client"].get(f"/api/v1/repositories/repo/versions/{created['artifactVersionId']}").json()
    assert retained == version
    with pipeline["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectedRecord)) == 1
        assert db.scalar(select(func.count()).select_from(ReviewEvent)) == 0
    snapshot = ask(pipeline, pipeline["headers"], "read_snapshot", {"selection": pipeline["selection"]})
    assert snapshot["pendingReviewCount"] == 0
    assert next(item for item in snapshot["coverage"] if item["function"] == "ingestion")["processedCount"] == 0


@pytest.mark.parametrize("invalid", ["missing_reason", "source_and_absence", "forged_actor", "nul"])
def test_invalid_record_input_cannot_publish(pipeline, invalid):
    data = record()
    if invalid == "missing_reason":
        data["sourceAbsenceReason"] = None
    elif invalid == "source_and_absence":
        data["sourceReference"] = {"kind": "external", "uri": "https://example.invalid/reference", "label": "Attributed reference",
                                   "availability": "unresolved", "reason": "Not fetched."}
    elif invalid == "forged_actor":
        data["actorId"] = "another-user"
    else:
        data["content"] = "Invalid\x00record"
    assert send(pipeline, "capture_record", data).status_code == 422
    with pipeline["db"]() as db:
        assert db.scalar(select(func.count()).select_from(SelectedRecord)) == 0


def test_external_reference_stays_unfetched_attributed_metadata(pipeline):
    data = record()
    data["sourceAbsenceReason"] = None
    data["sourceReference"] = {"kind": "external", "uri": "https://example.invalid/no-fetch", "label": "Unfetched reference",
                               "availability": "unresolved", "reason": "Only attributed source metadata was provided."}
    response = send(pipeline, "capture_record", data)
    assert response.status_code == 200, response.text
    provenance = ask(pipeline, pipeline["headers"], "read_activity", {"activityId": response.json()["result"]["activityId"]})
    assert any("not fetched" in item for item in provenance["limitations"])


def manual_input(captured):
    with captured["db"]() as db:
        versions = list(db.scalars(select(ArtifactVersion).join(SelectionArtifact, SelectionArtifact.version_id == ArtifactVersion.id)))
    by_path = {version.identity["path"]: version for version in versions}
    document, code = by_path["templates/front/snippets/python_requests_payload.txt"], by_path["hc/lib/urls.py"]
    return {"targetRevision": captured["selection"]["targetRevision"], "type": "documents",
        "sourceArtifactId": document.artifact_id, "targetArtifactId": code.artifact_id,
        "sourceVersionId": document.id, "targetVersionId": code.id,
        "evidence": [{"artifactVersionId": document.id, "locator": {"kind": "lines", "startLine": 1, "endLine": 1}}],
        "reason": "Synthetic command-path verification of manual origin, without semantic confirmation.", "predecessorContextId": None}


def test_manual_capture_after_automatic_miss_does_not_rewrite_discovery_results(captured):
    _, queued = submit(captured, "discover_candidates")
    identity = queued["result"]["operationId"]
    assert run_operation(captured["db"], identity)
    original = ask(captured, captured["headers"], "read_discovery_results", {"operationId": identity, "cursor": None, "pageSize": 100})
    data = manual_input(captured)
    request_id = uuid.uuid4().hex
    response = send(captured, "capture_candidate", data, request_id)
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["origin"] == "manual" and result["projection"]["validity"] == "candidate"
    assert result["assertionId"] not in {item["assertionId"] for item in original["items"]}
    after = ask(captured, captured["headers"], "read_discovery_results", {"operationId": identity, "cursor": None, "pageSize": 100})
    assert after == original
    assert send(captured, "capture_candidate", data, request_id).json() == response.json()
    duplicate = send(captured, "capture_candidate", data)
    assert duplicate.status_code == 200 and duplicate.json()["result"]["contextId"] == result["contextId"]
    evidence = captured["client"].get(f"/api/v1/repositories/repo/evidence/{result['evidenceIds'][0]}").json()
    assert evidence["provenance"]["agent"]["kind"] == "practitioner"


def test_terminal_claim_needs_explicit_successor_and_preserves_predecessor(captured):
    data = manual_input(captured)
    first = send(captured, "capture_candidate", data).json()["result"]
    snapshot = ask(captured, captured["headers"], "read_snapshot", {"selection": captured["selection"]})
    view = ask(captured, captured["headers"], "open_review_view", {"repositoryViewId": captured["selected"]["repositoryViewId"],
               "snapshotId": snapshot["id"], "contextId": first["contextId"]})
    body = {"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex, "repositoryId": "repo", "viewId": view["viewId"],
        "command": "record_judgment", "input": {"contextId": first["contextId"], "assertionRevisionId": first["assertionRevisionId"],
        "expectedProjectionVersion": 0, "decision": "reject", "reason": "Synthetic terminal-state verification; not a research judgment.",
        "reviewedEvidenceIds": [], "contentConcern": None, "followUpDisposition": {"kind": "none"}}}
    assert captured["client"].post("/api/v1/commands", headers=captured["headers"], json=body).status_code == 200
    assert send(captured, "capture_candidate", data).status_code == 422
    successor = send(captured, "capture_candidate", {**data, "predecessorContextId": first["contextId"]})
    assert successor.status_code == 200, successor.text
    result = successor.json()["result"]
    assert result["assertionId"] != first["assertionId"] and result["projection"]["validity"] == "candidate"
    with captured["db"]() as db:
        assert db.get(Assertion, result["assertionId"]).predecessor_id == first["assertionId"]
        assert db.get(ReviewContext, first["contextId"]).validity == "rejected"


@pytest.mark.parametrize("command", ["capture_record", "revise_record", "capture_candidate"])
def test_viewer_cannot_capture_records_or_manual_candidates(captured, command):
    captured["headers"] = sign_in(captured, "bob")
    data = record() if command != "capture_candidate" else manual_input(captured)
    assert send(captured, command, data).status_code == 403
