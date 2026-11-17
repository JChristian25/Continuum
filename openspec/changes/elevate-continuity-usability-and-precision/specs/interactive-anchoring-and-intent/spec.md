# Interactive anchoring and intent

## Purpose
Allow authorized reviewers to attach exact captured source anchors or external references directly while recording decisions/requirements, and select line ranges or structural symbols visually instead of typing line numbers blind.

## ADDED Requirements

### Requirement: IA-01 Source-backed intent authoring
The system SHALL allow an authorized reviewer to capture an authored requirement or decision record with either an exact captured artifact anchor, an external attributed source reference, or an explicit source-absence reason.

#### Scenario: Capture an authored decision anchored to captured lines
- **WHEN** an authorized reviewer opens `+ Record intent` in an active repository snapshot, selects a captured artifact version and line range, and submits the record
- **THEN** the service persists the authored record with `sourceReference.kind = "artifact"` bound to that exact `artifactVersionId` and line range without requiring a fabricated absence reason
- **AND** recording the anchored decision alone does not create or confirm a relationship until separately proposed and judged

#### Scenario: Capture an external reference or absent-source record
- **WHEN** the reviewer chooses an external URI reference or explicitly selects no source reference with a nonblank `sourceAbsenceReason`
- **THEN** the service persists the corresponding attributed external metadata (without fetching external URIs) or absent-source record
- **AND** rejects requests that supply both a source reference and an absence reason or omit both

### Requirement: IA-02 Optional candidate linking from intent capture
The system SHALL allow an authorized reviewer authoring a requirement or decision to optionally propose an initial unconfirmed typed relationship (`motivates` or `implements`) in the same workflow without skipping separate confirmation.

#### Scenario: Propose an unconfirmed link alongside a new decision
- **WHEN** an authorized reviewer submits an authored decision with optional candidate linking enabled against a selected code artifact version and exact evidence lines
- **THEN** the service saves the authored record first and then submits `capture_candidate` with `type = "motivates"`, entering the queue strictly as `validity = "candidate"` and `resolution = "open"`
- **AND** if the follow-on candidate link fails validation or authorization, the authored record remains saved and the draft retains the link error without duplicating the record on retry

### Requirement: IA-03 Interactive source line and symbol picker
The system SHALL provide interactive line-range and structural symbol/section selection across `Add a relationship`, `Correct this relationship`, `Propose an unconfirmed successor`, and `Code explorer`, keeping line ranges bound to exact captured versions.

#### Scenario: Pick exact line span from source viewer
- **WHEN** an authorized reviewer selects a target artifact in a relationship editor or clicks a line range / symbol span in Code Explorer to propose or correct a link
- **THEN** the UI loads the exact captured `ArtifactVersion` content and populates validated 1-based `startLine` and `endLine` bounds directly from the user's line or symbol selection
- **AND** viewer accounts and historical snapshots keep anchoring and write controls disabled
