from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event, current_thread, main_thread

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select, text
from sqlalchemy.exc import DBAPIError

from continuum.config import Settings
from continuum.models import (Account, Artifact, ArtifactVersion, Assertion, AssertionRevision, Evidence, Grant,
                              Receipt, Repository, ReviewContext, ReviewEvent, SecurityAudit, Session, View)
from continuum.security import digest, passwords
from conftest import envelope, sign_in


def post(setup, headers, body):
    return setup["client"].post("/api/v1/commands", headers=headers, json=body)


def context(setup, identity="context1", view="view1"):
    response = setup["client"].get(f"/api/v1/repositories/repo/contexts/{identity}", params={"viewId": view})
    assert response.status_code == 200, response.text
    return response.json()["projection"]


def test_authentication_bootstrap_cookie_and_logout(setup):
    client = setup["client"]
    assert client.get("/api/v1/auth/session").status_code == 401
    headers = sign_in(setup)
    assert "__Host-continuum_session" in client.cookies
    assert "__Host-continuum_pre" not in client.cookies
    token = client.cookies.get("__Host-continuum_session")
    with setup["db"]() as db:
        assert db.get(Session, token) is None
        assert db.get(Session, digest(token)).actor_id == "reviewer"
    assert client.post("/api/v1/auth/logout", headers=headers, json={}).status_code == 200
    client.cookies.set("__Host-continuum_session", token)
    assert client.get("/api/v1/auth/session").status_code == 401


@pytest.mark.parametrize("mode", ["viewer", "unknown", "historical", "csrf", "origin", "disabled", "expired", "idle", "revoked", "credential_reset"])
def test_authority_denies_without_domain_change(setup, mode):
    headers = sign_in(setup, "bob" if mode == "viewer" else "alice")
    body = envelope()
    expected = 403
    if mode == "unknown":
        setup["client"].cookies.clear()
        expected = 401
    elif mode == "historical":
        body["viewId"] = "historical"
        expected = 422
    elif mode == "csrf":
        headers.pop("X-CSRF-Token")
    elif mode == "origin":
        headers["Origin"] = "https://attacker.invalid"
    elif mode in {"disabled", "expired", "idle", "revoked", "credential_reset"}:
        with setup["db"].begin() as db:
            actor = db.get(Account, "reviewer")
            session = db.scalar(select(Session).where(Session.actor_id == "reviewer"))
            if mode == "disabled":
                actor.enabled = False
            elif mode == "expired":
                session.expires_at = 1
            elif mode == "idle":
                session.last_seen_at = 1
            elif mode == "revoked":
                session.revoked = True
            else:
                actor.credential_version += 1
        expected = 401
    response = post(setup, headers, body)
    assert response.status_code == expected, response.text
    with setup["db"]() as db:
        assert db.scalar(select(func.count()).select_from(ReviewEvent)) == 0
        assert db.get(ReviewContext, "context1").projection_version == 0


def test_confirm_one_assertion_does_not_confirm_shared_artifact_links(setup):
    headers = sign_in(setup)
    body = envelope()
    response = post(setup, headers, body)
    assert response.status_code == 200, response.text
    assert response.json()["result"]["projection"]["validity"] == "confirmed"
    assert context(setup, "context2", "view2")["validity"] == "candidate"
    with TestClient(setup["app"], base_url="https://test") as reopened:
        sign_in(setup, client=reopened)
        retained = reopened.get("/api/v1/repositories/repo/contexts/context1/history", params={"viewId": "view1"}).json()
        assert retained["items"][0]["reason"] == body["input"]["reason"]
        assert retained["items"][0]["actorId"] == "reviewer"


def test_receipt_replay_precedes_live_projection_but_not_permission(setup):
    headers = sign_in(setup)
    body = envelope()
    first = post(setup, headers, body)
    assert first.status_code == 200, first.text
    later = envelope("open_follow_up", version=1)
    assert post(setup, headers, later).status_code == 200
    assert post(setup, headers, body).json() == first.json()
    changed = {**body, "input": {**body["input"], "reason": "Different content under the same identity."}}
    assert post(setup, headers, changed).status_code == 409
    with setup["db"].begin() as db:
        db.get(Grant, ("reviewer", "repo")).role = "viewer"
    assert post(setup, headers, body).status_code == 403


@pytest.mark.parametrize("decision", ["confirm", "reject"])
def test_concurrent_distinct_requests_one_wins(setup, decision):
    headers = sign_in(setup)
    cookies = dict(setup["client"].cookies)
    barrier = Barrier(2)

    def submit(body):
        with TestClient(setup["app"], base_url="https://test", cookies=cookies) as client:
            barrier.wait(timeout=10)
            return client.post("/api/v1/commands", headers=headers, json=body)

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(submit, [envelope(decision=decision), envelope(decision=decision)]))
    assert sorted(response.status_code for response in responses) == [200, 409]
    with setup["db"]() as db:
        assert db.scalar(select(func.count()).select_from(ReviewEvent)) == 1


def test_concurrent_identical_retry_commits_once(setup):
    headers = sign_in(setup)
    cookies, body, barrier = dict(setup["client"].cookies), envelope(), Barrier(2)

    def submit(_):
        with TestClient(setup["app"], base_url="https://test", cookies=cookies) as client:
            barrier.wait(timeout=10)
            return client.post("/api/v1/commands", headers=headers, json=body)

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(submit, range(2)))
    assert [response.status_code for response in responses] == [200, 200]
    assert responses[0].json() == responses[1].json()
    with setup["db"]() as db:
        assert db.scalar(select(func.count()).select_from(ReviewEvent)) == 1
        assert db.scalar(select(func.count()).select_from(Receipt)) == 1


def test_persistence_failure_rolls_back_event_projection_and_receipt(setup):
    headers = sign_in(setup)
    with setup["engine"].begin() as connection:
        connection.execute(text("""CREATE FUNCTION reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
                                 BEGIN RAISE EXCEPTION 'Synthetic persistence failure'; END $$"""))
        connection.execute(text("CREATE TRIGGER fail_receipt BEFORE INSERT ON receipts FOR EACH ROW EXECUTE FUNCTION reject_receipt()"))
    body = envelope()
    response = post(setup, headers, body)
    assert response.status_code == 503, response.text
    with setup["db"]() as db:
        assert db.scalar(select(func.count()).select_from(ReviewEvent)) == 0
        assert db.scalar(select(func.count()).select_from(Receipt)) == 0
        assert db.get(ReviewContext, "context1").projection_version == 0
        assert db.get(Repository, "repo").snapshot_version == 0
    with setup["engine"].begin() as connection:
        connection.execute(text("DROP TRIGGER fail_receipt ON receipts"))
    assert post(setup, headers, body).status_code == 200


def test_retirement_reversal_restores_confirmation_and_preserves_work(setup):
    headers = sign_in(setup)
    confirmed = post(setup, headers, envelope()).json()["result"]
    opened = post(setup, headers, envelope("open_follow_up", 1, relatedJudgmentEventId=confirmed["eventIds"][0])).json()["result"]
    work_id = opened["followUps"][0]["id"]
    retired = post(setup, headers, envelope(version=2, decision="retire")).json()["result"]
    reversed_retirement = post(setup, headers, envelope("reverse_judgment", 3, eventId=retired["eventIds"][0]))
    assert reversed_retirement.status_code == 200, reversed_retirement.text
    result = reversed_retirement.json()["result"]
    assert result["projection"]["validity"] == "confirmed"
    assert result["followUps"][0]["status"] == "open"
    reversed_confirm = post(setup, headers, envelope("reverse_judgment", 4, eventId=confirmed["eventIds"][0]))
    assert reversed_confirm.json()["result"]["projection"]["validity"] == "candidate"
    resolved = post(setup, headers, envelope("resolve_follow_up", 5, followUpId=work_id))
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["result"]["projection"]["validity"] == "candidate"
    assert resolved.json()["result"]["followUps"][0]["status"] == "resolved"
    assert post(setup, headers, envelope("resolve_follow_up", 6, followUpId=work_id)).status_code == 422


def test_correction_preserves_predecessor_and_retry_after_supersession(setup):
    headers = sign_in(setup)
    body = envelope("correct_assertion")
    response = post(setup, headers, body)
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["projection"]["resolution"] == "superseded"
    assert result["successorProjection"]["validity"] == "candidate"
    assert result["successorProjection"]["projectionVersion"] == 0
    assert post(setup, headers, body).json() == response.json()
    assert post(setup, headers, envelope(version=1)).status_code == 422
    successor = result["successorProjection"]
    next_body = envelope(contextId=successor["contextId"], assertionRevisionId=successor["assertionRevisionId"])
    next_body["viewId"] = result["successorViewId"]
    assert post(setup, headers, next_body).status_code == 200
    assert context(setup)["resolution"] == "superseded"


def test_history_snapshot_is_stable_during_new_events(setup):
    headers = sign_in(setup)
    confirm = post(setup, headers, envelope()).json()["result"]["eventIds"][0]
    assert post(setup, headers, envelope("open_follow_up", 1)).status_code == 200
    route = "/api/v1/repositories/repo/contexts/context1/history"
    params = {"viewId": "view1", "pageSize": 1}
    first = setup["client"].get(route, params=params).json()
    assert first["snapshotSequence"] == 2
    assert first["items"][0]["reversedByEventId"] is None
    assert post(setup, headers, envelope("reverse_judgment", 2, eventId=confirm)).status_code == 200
    second = setup["client"].get(route, params={**params, "cursor": first["nextCursor"]}).json()
    assert second["snapshotSequence"] == 2
    assert second["items"][0]["sequence"] == 2
    assert second["nextCursor"] is None
    fresh = setup["client"].get(route, params=params).json()
    assert fresh["snapshotSequence"] == 3
    assert fresh["items"][0]["reversedByEventId"] is not None
    wrong = setup["client"].get("/api/v1/repositories/repo/contexts/context2/history", params={"viewId": "view2", "cursor": first["nextCursor"]})
    assert wrong.status_code == 422


@pytest.mark.parametrize("mutation", ["missing", "anchor", "digest"])
def test_unavailable_or_wrong_evidence_cannot_be_confirmed(setup, mutation):
    headers = sign_in(setup)
    with setup["db"].begin() as db:
        evidence = db.get(Evidence, "evidence")
        if mutation == "missing":
            evidence.availability, evidence.reason = "missing", "Synthetic missing evidence"
        elif mutation == "anchor":
            evidence.locator = {"kind": "lines", "startLine": 2, "endLine": 99}
        else:
            evidence.excerpt_digest = "0" * 64
    assert post(setup, headers, envelope()).status_code == 422
    response = setup["client"].get("/api/v1/repositories/repo/evidence/evidence")
    expected_availability = "missing" if mutation == "missing" else "unresolved"
    assert response.json()["availability"] == expected_availability
    detail = setup["client"].get("/api/v1/repositories/repo/contexts/context1", params={"viewId": "view1"})
    assert detail.json()["evidence"][0]["availability"] == expected_availability
    assert post(setup, headers, envelope(decision="reject", reviewedEvidenceIds=[])).status_code == 200


def test_exact_sources_and_database_immutability(setup):
    sign_in(setup)
    response = setup["client"].get("/api/v1/repositories/repo/versions/doc-v1")
    assert response.status_code == 200
    assert response.json()["contentDigest"]["value"] == digest(response.json()["content"])
    with pytest.raises(DBAPIError), setup["engine"].begin() as connection:
        connection.execute(text("UPDATE artifact_versions SET content = 'changed' WHERE id = 'doc-v1'"))


def test_cross_repository_and_forged_actor_rejected(setup):
    headers = sign_in(setup)
    body = envelope()
    body["actorId"] = "reviewer"
    response = post(setup, headers, body)
    assert response.status_code == 422
    assert "input" not in response.json()["error"]
    assert setup["client"].get("/api/v1/repositories/other/versions/doc-v1").status_code == 403
    assert setup["client"].get("/api/v1/repositories/repo/versions/not-present").status_code == 404


def test_login_throttle_is_durable_and_does_not_echo_secrets(setup):
    client = setup["client"]
    boot = client.get("/api/v1/auth/bootstrap").json()
    headers = {"Origin": "https://test", "X-CSRF-Token": boot["csrfToken"]}
    wrong = "synthetic-wrong-password"
    body = {"schemaVersion": "0.1.0", "requestId": "login", "login": "unknown", "password": wrong}
    for _ in range(5):
        response = client.post("/api/v1/auth/login", headers=headers, json=body)
        assert response.status_code == 401
        assert wrong not in response.text
    assert client.post("/api/v1/auth/login", headers=headers, json=body).status_code == 429
    invalid = client.post("/api/v1/auth/login", headers=headers, json={**body, "actorId": "forged"})
    assert invalid.status_code == 422
    assert wrong not in invalid.text


def test_request_and_page_limits(setup):
    headers = sign_in(setup)
    assert post(setup, headers, envelope(reason=" ")).status_code == 422
    assert post(setup, headers, envelope(expectedProjectionVersion=True)).status_code == 422
    assert setup["client"].post("/api/v1/commands", headers={**headers, "Content-Type": "application/json"}, content="x" * 262145).status_code == 413
    assert setup["client"].get("/api/v1/repositories/repo/contexts/context1/history", params={"viewId": "view1", "pageSize": 101}).status_code == 422


@pytest.mark.parametrize("command", ["record_judgment", "reverse_judgment", "correct_assertion", "open_follow_up", "resolve_follow_up"])
def test_viewer_denied_for_every_review_command(setup, command):
    headers = sign_in(setup, "bob")
    assert post(setup, headers, envelope(command)).status_code == 403


@pytest.mark.parametrize("disable", [False, True])
def test_revocation_committed_before_waiting_retry_denies_receipt(setup, disable):
    headers = sign_in(setup)
    body = envelope()
    assert post(setup, headers, body).status_code == 200
    cookies, waiting = dict(setup["client"].cookies), Event()

    def observe(connection, cursor, statement, parameters, context, executemany):
        if current_thread() is not main_thread() and "accounts" in statement and "FOR UPDATE" in statement:
            waiting.set()

    def retry():
        with TestClient(setup["app"], base_url="https://test", cookies=cookies) as client:
            return client.post("/api/v1/commands", headers=headers, json=body)

    event.listen(setup["engine"], "before_cursor_execute", observe)
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            with setup["db"].begin() as db:
                actor = db.scalar(select(Account).where(Account.id == "reviewer").with_for_update())
                pending = pool.submit(retry)
                assert waiting.wait(timeout=10), "Request did not reach the authority lock"
                if disable:
                    actor.enabled = False
                else:
                    db.get(Grant, ("reviewer", "repo")).role = "viewer"
            assert pending.result(timeout=10).status_code == (401 if disable else 403)
    finally:
        event.remove(setup["engine"], "before_cursor_execute", observe)


def test_different_reviewers_conflict_under_repository_lock(setup):
    with setup["db"].begin() as db:
        db.add(Account(id="second-reviewer", login="carol", display_name="Carol", password_hash=passwords.hash(setup["password"])))
        db.flush()
        db.add(Grant(actor_id="second-reviewer", repository_id="repo", role="reviewer"))
    barrier = Barrier(2)

    def submit(login):
        with TestClient(setup["app"], base_url="https://test") as client:
            headers = sign_in(setup, login, client)
            barrier.wait(timeout=10)
            return client.post("/api/v1/commands", headers=headers, json=envelope())

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(submit, ["alice", "carol"]))
    assert sorted(response.status_code for response in results) == [200, 409]
    losing = next(response for response in results if response.status_code == 409).json()
    assert losing["error"]["code"] == "stale_projection"
    assert losing["error"]["details"] == {"currentProjectionVersion": 1}
    assert set(losing) == {"schemaVersion", "requestId", "error"}


def test_correction_changed_endpoint_creates_a_replacement_assertion(setup):
    headers = sign_in(setup)
    with setup["db"].begin() as db:
        db.add(Artifact(id="code-other", repository_id="repo", kind="code", path="second.py"))
        db.flush()
        db.add(ArtifactVersion(id="code-other-v1", artifact_id="code-other", repository_id="repo",
                               identity={"provenance": "synthetic"}, content="pass", digest=digest("pass")))
    body = envelope("correct_assertion")
    body["input"]["replacement"].update(targetArtifactId="code-other", targetVersionId="code-other-v1")
    response = post(setup, headers, body)
    assert response.status_code == 200, response.text
    with setup["db"]() as db:
        revision_id = response.json()["result"]["successorProjection"]["assertionRevisionId"]
        revision = db.get(AssertionRevision, revision_id)
        assertion = db.get(Assertion, revision.assertion_id)
        assert assertion.id != "assertion1"
        assert assertion.predecessor_id == "assertion1"
        assert revision.supersedes_revision_id == "revision1"


def test_stale_incoming_context_needs_reconfirm_and_does_not_inherit_confirmation(setup):
    headers = sign_in(setup)
    assert post(setup, headers, envelope()).status_code == 200
    with setup["db"].begin() as db:
        incoming = db.get(ReviewContext, "context2")
        incoming.initial_validity = incoming.validity = "stale"
        incoming.kind, incoming.comparison_id = "comparison", "synthetic-comparison"
        incoming.base_revision = incoming.target_revision
        incoming.target_revision = {"objectAlgorithm": "sha1", "commitId": "0" * 39 + "2"}
    body = envelope(contextId="context2", assertionRevisionId="revision2")
    body["viewId"] = "view2"
    assert post(setup, headers, body).status_code == 422
    body["input"]["decision"] = "reconfirm"
    assert post(setup, headers, body).status_code == 200
    assert context(setup)["projectionVersion"] == 1
    assert context(setup, "context2", "view2")["validity"] == "confirmed"


def test_missing_incoming_endpoint_can_be_retired_but_never_confirmed(setup):
    headers = sign_in(setup)
    with setup["db"].begin() as db:
        old = db.get(AssertionRevision, "revision1")
        db.add(AssertionRevision(id="missing-revision", repository_id="repo", assertion_id="assertion1",
            source=old.source, target={"artifactId": "code", "versionId": None, "availability": "missing", "reason": "Synthetic deleted endpoint", "priorVersionId": "code-v1"},
            evidence_ids=old.evidence_ids, method_id="synthetic-deletion-fixture", limitations=["Synthetic missing endpoint."]))
        db.flush()
        db.add(ReviewContext(id="missing-context", repository_id="repo", assertion_revision_id="missing-revision",
            initial_validity="stale", validity="stale", target_revision={"objectAlgorithm": "sha1", "commitId": "0" * 39 + "2"}))
        db.flush()
        db.add(View(id="missing-view", repository_id="repo", context_id="missing-context", assertion_revision_id="missing-revision", mode="active"))
    body = envelope(decision="reconfirm", contextId="missing-context", assertionRevisionId="missing-revision")
    body["viewId"] = "missing-view"
    assert post(setup, headers, body).status_code == 422
    body["input"]["decision"] = "retire"
    assert post(setup, headers, body).status_code == 200


def test_cookie_flags_lifecycle_audit_and_expired_logout_cleanup(setup):
    boot = setup["client"].get("/api/v1/auth/bootstrap")
    header = boot.headers["set-cookie"].lower()
    assert "secure" in header and "httponly" in header and "path=/" in header
    assert "domain=" not in header
    sign_in(setup)
    with setup["db"].begin() as db:
        db.scalar(select(Session).where(Session.actor_id == "reviewer")).expires_at = 1
    boot = setup["client"].get("/api/v1/auth/bootstrap")
    response = setup["client"].post("/api/v1/auth/logout", json={},
        headers={"Origin": "https://test", "X-CSRF-Token": boot.json()["csrfToken"]})
    assert response.status_code == 200
    assert "__Host-continuum_session" not in setup["client"].cookies
    with setup["db"]() as db:
        audits = list(db.scalars(select(SecurityAudit)))
        assert len(audits) == 1 and audits[0].action == "login"
        assert db.scalar(select(func.count()).select_from(ReviewEvent)) == 0


def test_insecure_profile_requires_explicit_loopback_configuration():
    url = "postgresql+psycopg://unused:unused@localhost/unused"
    with pytest.raises(ValueError):
        Settings(url, "http://127.0.0.1:8000")
    with pytest.raises(ValueError):
        Settings(url, "http://elsewhere.invalid", True)
    settings = Settings(url, "http://127.0.0.1:8000", True)
    assert settings.session_cookie == "continuum_dev_session"
