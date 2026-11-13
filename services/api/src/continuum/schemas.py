from .relations import RelationType
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Id = Annotated[str, StringConstraints(min_length=1, max_length=80)]
Note = Annotated[str, StringConstraints(min_length=1, max_length=8000, pattern=r"\S")]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    @field_validator("*")
    @classmethod
    def reject_nul(cls, value):
        if isinstance(value, str) and "\x00" in value:
            raise ValueError("NUL characters are not accepted")
        return value


class Login(Strict):
    schemaVersion: Literal["0.1.0"]
    requestId: Id
    login: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class Envelope(Strict):
    schemaVersion: Literal["0.1.0"]
    requestId: Id
    repositoryId: Id
    viewId: Id
    command: Literal["compare_revisions", "record_judgment", "reverse_judgment", "correct_assertion", "open_follow_up", "resolve_follow_up", "capture_files", "discover_candidates", "capture_record", "revise_record", "capture_candidate", "complete_cycle", "export_snapshot"]
    input: dict


class ContextInput(Strict):
    contextId: Id
    assertionRevisionId: Id
    expectedProjectionVersion: int = Field(ge=0)


class NoFollowUp(Strict):
    kind: Literal["none"]


class NewFollowUp(Strict):
    kind: Literal["open"]
    workKind: Literal["code_update", "documentation_update"]
    note: Note


class Judgment(ContextInput):
    decision: Literal["confirm", "reject", "reconfirm", "retire"]
    reason: Note | None = None
    reviewedEvidenceIds: list[Id] = Field(max_length=1024)
    contentConcern: Note | None
    followUpDisposition: Annotated[NoFollowUp | NewFollowUp, Field(discriminator="kind")]

    @field_validator('reason', mode='before')
    @classmethod
    def absent_reason(cls, value):
        # Normalize only blank input; retain authored nonblank text verbatim.
        if isinstance(value, str) and not value.strip() and len(value) <= 8000:
            return None
        return value

    @model_validator(mode="after")
    def unique_evidence(self):
        if len(set(self.reviewedEvidenceIds)) != len(self.reviewedEvidenceIds):
            raise ValueError("Evidence IDs must be unique")
        return self


class Reversal(ContextInput):
    eventId: Id
    reason: Note


class OpenFollowUp(ContextInput):
    workKind: Literal["code_update", "documentation_update"]
    note: Note
    relatedJudgmentEventId: Id | None


class ResolveFollowUp(ContextInput):
    followUpId: Id
    verificationNote: Note


class Replacement(Strict):
    type: RelationType
    sourceArtifactId: Id
    targetArtifactId: Id
    sourceVersionId: Id
    targetVersionId: Id
    evidenceIds: list[Id] = Field(default_factory=list, max_length=1024)
    newEvidence: list[dict] = Field(default_factory=list, max_length=1024)

    @model_validator(mode="after")
    def unique_evidence(self):
        if not self.evidenceIds and not self.newEvidence:
            raise ValueError("Correction requires existing or newly anchored evidence")
        if len(set(self.evidenceIds)) != len(self.evidenceIds):
            raise ValueError("Evidence IDs must be unique")
        return self


class Correction(ContextInput):
    reason: Note
    replacement: Replacement


INPUT_TYPES = {
    "record_judgment": Judgment,
    "reverse_judgment": Reversal,
    "correct_assertion": Correction,
    "open_follow_up": OpenFollowUp,
    "resolve_follow_up": ResolveFollowUp,
}
