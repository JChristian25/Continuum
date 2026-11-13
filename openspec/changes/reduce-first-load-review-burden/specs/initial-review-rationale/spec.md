# Initial review rationale

## Purpose
Allow ordinary initial decisions without authored rationale while retaining evidence safeguards and accountable exact-version history.

## ADDED Requirements

### Requirement: IR-01 Optional initial rationale
The system SHALL accept eligible ordinary initial candidate confirmation or rejection with an absent reason and preserve supplied nonblank explanations unchanged.

#### Scenario: Confirm or reject without text
- **WHEN** an authorized reviewer submits an eligible initial candidate judgment with omitted, null or whitespace-only reason
- **THEN** reason is recorded as absent with actor, timestamp, decision, exact assertion and evidence versions retained
- **AND** confirmation still requires the existing readable exact evidence and acknowledgment

#### Scenario: Supply an explanation
- **WHEN** the reviewer supplies a valid nonblank reason
- **THEN** its text is retained as the reviewer's explanation

#### Scenario: Exceptional action
- **WHEN** incoming review, reconfirmation, retirement, correction, reversal or follow-up is submitted without its required reason or note
- **THEN** existing validation rejects the action without changing history

### Requirement: IR-02 Explicit absent-reason reads
History, search and exports SHALL safely distinguish absent rationale from supplied text without generating a reviewer explanation.

#### Scenario: Read mixed history
- **WHEN** stored records include supplied text and absent, legacy missing or blank reasons
- **THEN** history shows supplied text or “No reason provided” and retains exact history boundaries
- **AND** search skips absent rationale safely while supplied text remains searchable

#### Scenario: Export an absent reason
- **WHEN** an exact snapshot containing a reason-free decision is exported
- **THEN** raw reason is null with explicit not-provided status and documented “No reason provided” presentation
- **AND** previously published exports remain unchanged

### Requirement: IR-03 Retained review safeguards
Optional rationale SHALL preserve existing authorization, evidence, concurrency, draft and uncertain-delivery protections.

#### Scenario: Uncertain delivery and concurrent write
- **WHEN** delivery is uncertain or a competing decision invalidates the displayed projection
- **THEN** the draft remains available and explicit retry retains the original envelope and request ID
- **AND** receipts prevent duplicate judgments and stale writes are rejected

#### Scenario: Invalid authority or evidence
- **WHEN** a viewer or historical context attempts a write, or confirmation lacks the required exact evidence acknowledgment
- **THEN** the service rejects it without changing decisions or counts
