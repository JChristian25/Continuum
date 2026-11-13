from typing import Literal

from pydantic import Field, model_validator

from .schemas import Id, Note, Strict


class CommitRef(Strict):
    objectAlgorithm: Literal["sha1", "sha256"]
    commitId: str

    @model_validator(mode="after")
    def full_identity(self):
        import re
        size = 40 if self.objectAlgorithm == "sha1" else 64
        if not re.fullmatch(f"[0-9a-f]{{{size}}}", self.commitId):
            raise ValueError("Full immutable commit identity is required")
        return self


class SelectionInput(Strict):
    repositoryId: Id
    targetRevision: CommitRef
    baseRevision: CommitRef | None
    inventoryId: Id
    configurationId: Id


class ProcessingInput(Strict):
    targetRevision: CommitRef
    inventoryId: Id
    configurationId: Id


class QueryEnvelope(Strict):
    schemaVersion: Literal["0.1.0"]
    requestId: Id
    repositoryId: Id
    query: Literal["select_context", "read_snapshot", "open_review_view", "read_operation", "read_capture_results", "read_discovery_results", "read_activity"]
    input: dict


class SnapshotInput(Strict):
    selection: SelectionInput


class ReviewViewInput(Strict):
    repositoryViewId: Id
    snapshotId: Id
    contextId: Id


class OperationInput(Strict):
    operationId: Id


class ResultsInput(OperationInput):
    cursor: Id | None
    pageSize: int = Field(ge=1, le=100)


class Lines(Strict):
    kind: Literal["lines"]
    startLine: int = Field(ge=1)
    endLine: int = Field(ge=1)

    @model_validator(mode="after")
    def ascending(self):
        if self.endLine < self.startLine:
            raise ValueError("Invalid line range")
        return self


class PathField(Strict):
    kind: Literal["field"]
    fieldPath: Literal["identity.path"]


class CandidateAnchor(Strict):
    artifactVersionId: Id
    locator: Lines | PathField


class ArtifactSource(CandidateAnchor):
    kind: Literal["artifact"]


class ExternalSource(Strict):
    kind: Literal["external"]
    uri: str = Field(min_length=1, max_length=2048)
    label: str = Field(min_length=1, max_length=200)
    availability: Literal["available", "missing", "unresolved"]
    reason: Note | None

    @model_validator(mode="after")
    def absence_reason(self):
        if (self.availability == "available") != (self.reason is None):
            raise ValueError("Unavailable external references require a reason")
        return self


class RecordInput(Strict):
    title: str = Field(min_length=1, max_length=200, pattern=r"\S")
    content: str = Field(min_length=1, max_length=65536, pattern=r"\S")
    sourceReference: ArtifactSource | ExternalSource | None
    sourceAbsenceReason: Note | None

    @model_validator(mode="after")
    def source_or_reason(self):
        if (self.sourceReference is None) != (self.sourceAbsenceReason is not None):
            raise ValueError("Absent source requires an explicit reason")
        return self


class CaptureRecord(RecordInput):
    kind: Literal["requirement", "decision"]


class ReviseRecord(RecordInput):
    artifactId: Id
    expectedRecordVersion: int = Field(ge=1)
    reason: Note


class CaptureCandidate(Strict):
    targetRevision: CommitRef
    type: Literal["documents"]
    sourceArtifactId: Id
    targetArtifactId: Id
    sourceVersionId: Id
    targetVersionId: Id
    evidence: list[CandidateAnchor] = Field(min_length=1, max_length=1024)
    reason: Note
    predecessorContextId: Id | None

    @model_validator(mode="after")
    def unique_anchors(self):
        if len({item.model_dump_json() for item in self.evidence}) != len(self.evidence):
            raise ValueError("Evidence anchors must be unique")
        return self


class ActivityInput(Strict):
    activityId: Id
