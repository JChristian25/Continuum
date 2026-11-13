from sqlalchemy import ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .models import Base, new_id


class InputRegistration(Base):
    __tablename__ = "input_registrations"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    manifest_path: Mapped[str] = mapped_column(Text)
    acceptance_path: Mapped[str] = mapped_column(Text)
    manifest_digest: Mapped[str] = mapped_column(String(64))
    acceptance_digest: Mapped[str] = mapped_column(String(64))


class ProfileRegistration(Base):
    __tablename__ = "profile_registrations"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    inventory_id: Mapped[str] = mapped_column(ForeignKey("input_registrations.id"))
    profile_path: Mapped[str] = mapped_column(Text)
    acceptance_path: Mapped[str] = mapped_column(Text)
    profile_digest: Mapped[str] = mapped_column(String(64))
    acceptance_digest: Mapped[str] = mapped_column(String(64))


class Selection(Base):
    __tablename__ = "selections"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    inventory_id: Mapped[str] = mapped_column(ForeignKey("input_registrations.id"))
    configuration_id: Mapped[str] = mapped_column(ForeignKey("profile_registrations.id"))
    target_revision: Mapped[dict] = mapped_column(JSON)
    base_revision: Mapped[dict | None] = mapped_column(JSON)
    snapshot_version: Mapped[int] = mapped_column(default=0)


class RepositoryView(Base):
    __tablename__ = "repository_views"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    selection_id: Mapped[str] = mapped_column(ForeignKey("selections.id"))
    mode: Mapped[str] = mapped_column(String(20))


class SelectionArtifact(Base):
    __tablename__ = "selection_artifacts"
    selection_id: Mapped[str] = mapped_column(ForeignKey("selections.id"), primary_key=True)
    artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id"), primary_key=True)
    version_id: Mapped[str] = mapped_column(ForeignKey("artifact_versions.id"))


class SelectionContext(Base):
    __tablename__ = "selection_contexts"
    selection_id: Mapped[str] = mapped_column(ForeignKey("selections.id"), primary_key=True)
    context_id: Mapped[str] = mapped_column(ForeignKey("review_contexts.id"), primary_key=True)


class Operation(Base):
    __tablename__ = "operations"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    selection_id: Mapped[str] = mapped_column(ForeignKey("selections.id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"))
    kind: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="queued")
    generation: Mapped[int] = mapped_column(default=0)
    attempts: Mapped[int] = mapped_column(default=0)
    lease_until: Mapped[int] = mapped_column(default=0)
    deadline_at: Mapped[int]
    selection_version: Mapped[int] = mapped_column(default=0)
    published_version: Mapped[int] = mapped_column(default=0)
    result_snapshot_id: Mapped[str | None] = mapped_column(ForeignKey("snapshots.id"))
    result_items: Mapped[list] = mapped_column(JSON, default=list)
    result_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    coverage: Mapped[list] = mapped_column(JSON, default=list)
    limitations: Mapped[list] = mapped_column(JSON, default=list)


class Snapshot(Base):
    __tablename__ = "snapshots"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    selection_id: Mapped[str] = mapped_column(ForeignKey("selections.id"))
    snapshot_version: Mapped[int]
    document: Mapped[dict] = mapped_column(JSON)


class ReviewViewBinding(Base):
    __tablename__ = "review_view_bindings"
    view_id: Mapped[str] = mapped_column(ForeignKey("review_views.id"), primary_key=True)
    selection_id: Mapped[str] = mapped_column(ForeignKey("selections.id"))
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("snapshots.id"))


class ResultPage(Base):
    __tablename__ = "result_pages"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=new_id)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"))
    query: Mapped[str] = mapped_column(String(40))
    binding: Mapped[str] = mapped_column(String(80))
    items: Mapped[list] = mapped_column(JSON)
    metadata_document: Mapped[dict] = mapped_column(JSON)
    after_index: Mapped[int]


class RecordCurrent(Base):
    __tablename__ = "record_current"
    artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id"), primary_key=True)
    record_version: Mapped[int]
    version_id: Mapped[str] = mapped_column(ForeignKey("artifact_versions.id"))


class SelectedRecord(Base):
    __tablename__ = "selected_records"
    selection_id: Mapped[str] = mapped_column(ForeignKey("selections.id"), primary_key=True)
    artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id"), primary_key=True)
    version_id: Mapped[str] = mapped_column(ForeignKey("artifact_versions.id"))


class Activity(Base):
    __tablename__ = "processing_activities"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    document: Mapped[dict] = mapped_column(JSON)


class EvidenceOrigin(Base):
    __tablename__ = "evidence_origins"
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence.id"), primary_key=True)
    activity_id: Mapped[str] = mapped_column(ForeignKey("processing_activities.id"))


class RevisionOrigin(Base):
    __tablename__ = "revision_origins"
    revision_id: Mapped[str] = mapped_column(ForeignKey("assertion_revisions.id"), primary_key=True)
    activity_id: Mapped[str] = mapped_column(ForeignKey("processing_activities.id"))
