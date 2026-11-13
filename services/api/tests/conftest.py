import os
import secrets
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from continuum.config import Settings
from continuum.db import initialize, make_engine, session_factory
from continuum.main import create_app
from continuum.models import (Account, Artifact, ArtifactVersion, Assertion, AssertionRevision,
                              Evidence, Grant, Repository, ReviewContext, View)
from continuum.security import digest, passwords


@pytest.fixture
def setup():
    url = os.getenv("CONTINUUM_TEST_DATABASE_URL")
    if not url:
        env = Path(__file__).resolve().parents[1] / ".env"
        if env.exists():
            values = dict(line.split("=", 1) for line in env.read_text().splitlines() if line and not line.startswith("#"))
            url = values.get("CONTINUUM_DATABASE_URL")
    if not url:
        pytest.fail("Set CONTINUUM_TEST_DATABASE_URL to an isolated PostgreSQL database")
    root = make_engine(url)
    schema = "continuum_test_" + uuid.uuid4().hex
    with root.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = make_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    initialize(engine)
    factory = session_factory(engine)
    password = secrets.token_urlsafe(24)
    with factory.begin() as db:
        for identity, login in [("reviewer", "alice"), ("viewer", "bob")]:
            db.add(Account(id=identity, login=login, display_name=login.title(), password_hash=passwords.hash(password)))
        db.add_all([Repository(id="repo", name="Synthetic review fixture"), Repository(id="other", name="Inaccessible fixture")])
        db.flush()
        db.add_all([Grant(actor_id="reviewer", repository_id="repo", role="reviewer"),
                    Grant(actor_id="viewer", repository_id="repo", role="viewer")])
        db.add_all([Artifact(id="doc", repository_id="repo", kind="document", path="README.md"),
                    Artifact(id="code", repository_id="repo", kind="code", path="sample.py")])
        db.flush()
        for identity, artifact, content in [("doc-v1", "doc", "Synthetic description\nRun sample.py to check.\n"),
                                              ("code-v1", "code", "def check():\n    return True\n")]:
            db.add(ArtifactVersion(id=identity, artifact_id=artifact, repository_id="repo",
                                   identity={"provenance": "synthetic", "fixture": identity}, content=content, digest=digest(content)))
        db.flush()
        db.add(Evidence(id="evidence", repository_id="repo", artifact_version_id="doc-v1",
                        locator={"kind": "lines", "startLine": 2, "endLine": 2}, method_id="synthetic-fixture-v1",
                        excerpt_digest=digest("Run sample.py to check.")))
        for suffix in ["1", "2"]:
            db.add(Assertion(id="assertion" + suffix, repository_id="repo", type="documents",
                             source_artifact_id="doc", target_artifact_id="code"))
        db.flush()
        for suffix in ["1", "2"]:
            db.add(AssertionRevision(id="revision" + suffix, assertion_id="assertion" + suffix, repository_id="repo",
                source={"artifactId": "doc", "versionId": "doc-v1", "availability": "available", "reason": None, "priorVersionId": None},
                target={"artifactId": "code", "versionId": "code-v1", "availability": "available", "reason": None, "priorVersionId": None},
                evidence_ids=["evidence"], method_id="synthetic-fixture-v1", limitations=["Synthetic fixture only."]))
        db.flush()
        for suffix in ["1", "2"]:
            db.add(ReviewContext(id="context" + suffix, repository_id="repo", assertion_revision_id="revision" + suffix,
                target_revision={"objectAlgorithm": "sha1", "commitId": "0" * 39 + "1"}))
        db.flush()
        for suffix in ["1", "2"]:
            db.add(View(id="view" + suffix, repository_id="repo", context_id="context" + suffix,
                        assertion_revision_id="revision" + suffix, mode="active"))
        db.add(View(id="historical", repository_id="repo", context_id="context1", assertion_revision_id="revision1", mode="historical"))
    settings = Settings(url, origin="https://test")
    app = create_app(settings, engine, worker_enabled=False)
    with TestClient(app, base_url="https://test", raise_server_exceptions=False) as client:
        yield {"client": client, "app": app, "engine": engine, "db": factory, "password": password, "schema": schema}
    engine.dispose()
    # The only deleted namespace is the generated schema created by this fixture.
    assert schema.startswith("continuum_test_") and len(schema) == 47
    with root.begin() as connection:
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    root.dispose()


def sign_in(setup, login="alice", client=None):
    client = client or setup["client"]
    boot = client.get("/api/v1/auth/bootstrap")
    response = client.post("/api/v1/auth/login", headers={"Origin": "https://test", "X-CSRF-Token": boot.json()["csrfToken"]},
                           json={"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex,
                                 "login": login, "password": setup["password"]})
    assert response.status_code == 200, response.text
    session = client.get("/api/v1/auth/session")
    assert session.status_code == 200
    return {"Origin": "https://test", "X-CSRF-Token": session.json()["csrfToken"]}


def envelope(command="record_judgment", version=0, **changes):
    body = {"schemaVersion": "0.1.0", "requestId": uuid.uuid4().hex,
            "repositoryId": "repo", "viewId": "view1", "command": command,
            "input": {"contextId": "context1", "assertionRevisionId": "revision1", "expectedProjectionVersion": version}}
    defaults = {
        "record_judgment": {"decision": "confirm", "reason": "Inspected the exact synthetic sources.",
                            "reviewedEvidenceIds": ["evidence"], "contentConcern": None, "followUpDisposition": {"kind": "none"}},
        "reverse_judgment": {"eventId": "unset", "reason": "Reconsider the earlier judgment."},
        "open_follow_up": {"workKind": "documentation_update", "note": "Clarify the prose.", "relatedJudgmentEventId": None},
        "resolve_follow_up": {"followUpId": "unset", "verificationNote": "Checked the resulting prose."},
        "correct_assertion": {"reason": "Correct the retained claim.", "replacement": {
            "type": "documents", "sourceArtifactId": "doc", "targetArtifactId": "code",
            "sourceVersionId": "doc-v1", "targetVersionId": "code-v1", "evidenceIds": ["evidence"]}},
    }
    body["input"].update(defaults[command])
    body["input"].update(changes)
    return body
