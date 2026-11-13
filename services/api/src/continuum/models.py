import time
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def new_id():
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    login: Mapped[str] = mapped_column(String(120), unique=True)
    display_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    credential_version: Mapped[int] = mapped_column(Integer, default=1)


class Repository(Base):
    __tablename__ = "repositories"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    snapshot_version: Mapped[int] = mapped_column(Integer, default=0)


class Grant(Base):
    __tablename__ = "repository_grants"
    actor_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(20))


class Session(Base):
    __tablename__ = "sessions"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    csrf: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[int] = mapped_column(default=lambda: int(time.time()))
    last_seen_at: Mapped[int] = mapped_column(default=lambda: int(time.time()))
    expires_at: Mapped[int]
    credential_version: Mapped[int] = mapped_column(default=0)
    revoked: Mapped[bool] = mapped_column(default=False)


class LoginLimit(Base):
    __tablename__ = "login_limits"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    started_at: Mapped[int]
    failures: Mapped[int] = mapped_column(default=0)


class SecurityAudit(Base):
    __tablename__ = "security_audit"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    subject_actor_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    recorded_at: Mapped[str] = mapped_column(String(40))
    action: Mapped[str] = mapped_column(String(40))
    outcome: Mapped[str] = mapped_column(String(40))


class Artifact(Base):
    __tablename__ = "artifacts"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    path: Mapped[str] = mapped_column(Text)


class ArtifactVersion(Base):
    __tablename__ = "artifact_versions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id"), index=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    identity: Mapped[dict] = mapped_column(JSON)
    content: Mapped[str] = mapped_column(Text)
    digest: Mapped[str] = mapped_column(String(64))


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    artifact_version_id: Mapped[str] = mapped_column(ForeignKey("artifact_versions.id"))
    locator: Mapped[dict] = mapped_column(JSON)
    availability: Mapped[str] = mapped_column(String(20), default="available")
    reason: Mapped[str | None] = mapped_column(Text)
    method_id: Mapped[str] = mapped_column(String(80))
    excerpt_digest: Mapped[str | None] = mapped_column(String(64))


class Assertion(Base):
    __tablename__ = "assertions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    type: Mapped[str] = mapped_column(String(40))
    source_artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id"))
    target_artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id"))
    predecessor_id: Mapped[str | None] = mapped_column(ForeignKey("assertions.id"))


class AssertionRevision(Base):
    __tablename__ = "assertion_revisions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    assertion_id: Mapped[str] = mapped_column(ForeignKey("assertions.id"))
    source: Mapped[dict] = mapped_column(JSON)
    target: Mapped[dict] = mapped_column(JSON)
    evidence_ids: Mapped[list] = mapped_column(JSON)
    method_id: Mapped[str] = mapped_column(String(80))
    limitations: Mapped[list] = mapped_column(JSON, default=list)
    supersedes_revision_id: Mapped[str | None] = mapped_column(ForeignKey("assertion_revisions.id"))


class ReviewContext(Base):
    __tablename__ = "review_contexts"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    assertion_revision_id: Mapped[str] = mapped_column(ForeignKey("assertion_revisions.id"))
    kind: Mapped[str] = mapped_column(String(20), default="initial")
    base_revision: Mapped[dict | None] = mapped_column(JSON)
    target_revision: Mapped[dict] = mapped_column(JSON)
    comparison_id: Mapped[str | None] = mapped_column(String(80))
    initial_validity: Mapped[str] = mapped_column(String(20), default="candidate")
    validity: Mapped[str] = mapped_column(String(20), default="candidate")
    resolution: Mapped[str] = mapped_column(String(20), default="open")
    projection_version: Mapped[int] = mapped_column(default=0)
    effective_judgment_event_id: Mapped[str | None] = mapped_column(String(80))
    successor_context_id: Mapped[str | None] = mapped_column(ForeignKey("review_contexts.id"))


class View(Base):
    __tablename__ = "review_views"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    context_id: Mapped[str] = mapped_column(ForeignKey("review_contexts.id"))
    assertion_revision_id: Mapped[str] = mapped_column(ForeignKey("assertion_revisions.id"))
    mode: Mapped[str] = mapped_column(String(20))


class ReviewEvent(Base):
    __tablename__ = "review_events"
    __table_args__ = (UniqueConstraint("context_id", "sequence"),)
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    context_id: Mapped[str] = mapped_column(ForeignKey("review_contexts.id"))
    assertion_revision_id: Mapped[str] = mapped_column(ForeignKey("assertion_revisions.id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"))
    recorded_at: Mapped[str] = mapped_column(String(40))
    sequence: Mapped[int]
    type: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON)


class FollowUp(Base):
    __tablename__ = "follow_ups"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    context_id: Mapped[str] = mapped_column(ForeignKey("review_contexts.id"))
    assertion_revision_id: Mapped[str] = mapped_column(ForeignKey("assertion_revisions.id"))
    opened_by_event_id: Mapped[str] = mapped_column(ForeignKey("review_events.id"))
    kind: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="open")
    resolution_event_id: Mapped[str | None] = mapped_column(ForeignKey("review_events.id"))


class Receipt(Base):
    __tablename__ = "receipts"
    actor_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), primary_key=True)
    command: Mapped[str] = mapped_column(String(40), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    input_digest: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict] = mapped_column(JSON)


class HistoryPage(Base):
    __tablename__ = "history_pages"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"))
    context_id: Mapped[str] = mapped_column(ForeignKey("review_contexts.id"))
    view_id: Mapped[str] = mapped_column(ForeignKey("review_views.id"))
    high_water: Mapped[int]
    after_sequence: Mapped[int]
