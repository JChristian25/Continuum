# Relationship review delta

## Purpose

Let an accountable practitioner judge a typed relationship against exact artifact versions and evidence, then recover that decision without confusing link validity with follow-up work.

## ADDED Requirements

### Requirement: C-03b Typed version-specific assertions
The system SHALL identify each relationship assertion independently of its endpoint artifacts and bind each assertion revision to exact endpoint versions and evidence.

#### Scenario: Two links share an artifact
- **WHEN** a reviewer confirms one of two assertions involving the same artifact
- **THEN** only the selected assertion revision receives that judgment
- **AND** the other assertion's review context remains unchanged

### Requirement: C-04a Candidates remain unconfirmed
The system SHALL present discovered or manually captured relationships as candidates until an authorized human confirms their exact reviewed context.

#### Scenario: Discovery produces a match
- **WHEN** lexical or repository evidence proposes a documents relationship
- **THEN** its direction, source evidence, method and limitations are visible
- **AND** a score or generated explanation does not count as confirmation

#### Scenario: Manual capture follows an automatic miss
- **WHEN** a practitioner captures a candidate after automatic discovery did not produce it
- **THEN** the record identifies manual capture as its origin
- **AND** the automatic-discovery result remains a miss

### Requirement: C-05a Accountable authorized judgments
The system SHALL accept a relationship judgment only from an authorized actor with a nonblank reason and the exact selected assertion revision.

#### Scenario: Confirm readable evidence
- **WHEN** an authorized reviewer confirms a candidate with readable evidence and a nonblank reason
- **THEN** the recorded event identifies the actor, time, assertion revision and reviewed evidence
- **AND** that context becomes confirmed

#### Scenario: Reject a candidate
- **WHEN** an authorized reviewer rejects a candidate with a nonblank reason
- **THEN** its review is resolved as rejected
- **AND** it contributes no confirmed support

#### Scenario: Invalid authority or evidence
- **WHEN** a viewer, unknown or revoked actor submits a judgment, or confirmation uses missing evidence or a mismatched version
- **THEN** the command is rejected without changing decisions or queue counts

### Requirement: C-05b Durable save acknowledgment
The system SHALL acknowledge a saved judgment only after the decision and its resulting state are durably committed.

#### Scenario: Persistence fails
- **WHEN** persistence fails before a judgment commits
- **THEN** the reviewer receives a save failure and retains the draft
- **AND** no saved acknowledgment, partial decision or advanced progress is presented

### Requirement: C-05c Retry and conflict outcomes
The system SHALL prevent duplicate or lost judgments when requests are retried or submitted against stale review state.

#### Scenario: Delivery is uncertain
- **WHEN** a reviewer retries the same judgment with the same request identity after a timeout
- **THEN** the result identifies the original committed decision or safely commits it once

#### Scenario: Concurrent reviewers
- **WHEN** two different judgments target the same expected review state
- **THEN** one commits and the other receives a conflict
- **AND** the unsuccessful draft is preserved for explicit reconsideration

### Requirement: C-07a Corrected claims preserve predecessors
The system SHALL retain prior claim and judgment records when a reviewer corrects an assertion.

#### Scenario: Correct evidence or reviewed versions
- **WHEN** a correction preserves the relation type and stable artifact endpoints
- **THEN** a successor assertion revision records the corrected versions or evidence
- **AND** it starts unconfirmed while the earlier revision remains retrievable

#### Scenario: Correct relation type or artifact endpoints
- **WHEN** a correction changes the relation type or either stable artifact endpoint
- **THEN** a replacement assertion identifies its predecessor
- **AND** prior decisions are not rewritten as decisions about the replacement

### Requirement: C-07b Accountable reversal
The system SHALL preserve committed history when a reviewer reverses the latest effective judgment in an active context.

#### Scenario: Reverse after a follow-up note
- **WHEN** an authorized reviewer reverses the latest effective judgment with a reason
- **THEN** a new reversal event identifies that judgment
- **AND** earlier decisions and unrelated follow-up notes remain retrievable

#### Scenario: Reverse an older judgment
- **WHEN** a reversal targets a judgment superseded by a later effective judgment
- **THEN** the command returns a conflict without deleting or modifying either event

### Requirement: C-08a Historical retrieval
The system SHALL retrieve recorded decisions and their exact source context independently of the current revision view.

#### Scenario: Reopen history after restart
- **WHEN** a practitioner reopens an earlier decision after service restart
- **THEN** the earlier reason, actor, recorded time, assertion revision and source references remain inspectable
- **AND** unavailable source is labeled unavailable rather than replaced with current content

### Requirement: C-10a Independent follow-up work
The system SHALL track a relationship judgment separately from content concerns and follow-up completion.

#### Scenario: Link remains valid but prose needs updating
- **WHEN** a reviewer confirms that a document still describes the code while recording a documentation concern
- **THEN** relationship validity is confirmed and follow-up work remains independently open
- **AND** confirmation does not assert that the prose has been corrected

#### Scenario: Resolve follow-up
- **WHEN** an authorized reviewer records follow-up completion with a verification note
- **THEN** the work's resolution is retained
- **AND** it does not automatically confirm or revise the relationship judgment

### Requirement: C-04b Evidence-backed candidate discovery
The system SHALL generate typed candidate relationship assertions from supported inputs under its declared discovery method with inspectable evidence and limitations.

#### Scenario: Discover a supported relationship candidate
- **WHEN** the selected method processes a supported document/code example with qualifying evidence in the frozen input inventory
- **THEN** the resulting candidate identifies its directed type, exact endpoint versions, evidence anchors and method
- **AND** it remains unconfirmed pending human review

#### Scenario: Evidence is insufficient
- **WHEN** the selected method cannot establish qualifying evidence for a proposed pair
- **THEN** no confirmed relationship is inferred
- **AND** the result reports the no-match or insufficient-evidence scope and relevant limitations separately from any later manual capture
