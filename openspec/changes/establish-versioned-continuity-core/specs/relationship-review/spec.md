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

#### Scenario: Explicit successor after a terminal outcome
- **WHEN** an authorized practitioner proposes a new claim after rejection or retirement through explicit successor capture
- **THEN** the new assertion retains its predecessor reference and starts candidate and open
- **AND** the earlier outcome and automatic-discovery results remain unchanged

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

#### Scenario: Initial review at an earlier commit
- **WHEN** an authorized reviewer uses an eligible active initial-review context at a selected commit without a comparison
- **THEN** the judgment applies only to that context's exact assertion revision and evidence
- **AND** the commit's age alone does not make the initial review historical

#### Scenario: Historical view cannot authorize a write
- **WHEN** a new write uses a server-identified historical view, even with a client-supplied active or initial label
- **THEN** the command is rejected without changing retained records
- **AND** reviewer permission alone does not make that view writable

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

#### Scenario: Retry after later state changes
- **WHEN** an authorized actor repeats an identically committed request after the context has advanced or become superseded
- **THEN** the original committed result is returned without adding another event or changing the newer state
- **AND** reuse of that request identity with different input returns a conflict

#### Scenario: Access revoked before retry
- **WHEN** an actor retries a committed request after losing required access
- **THEN** access is denied before the prior receipt or inaccessible records are disclosed

### Requirement: C-05d Trusted repository authority
The system SHALL enforce current server-resolved actor and repository permissions for every service command, query, retry and processing publication.

#### Scenario: Viewer attempts a domain command
- **WHEN** an authenticated viewer attempts capture, discovery, comparison, judgment, correction, reversal, follow-up mutation or cycle completion
- **THEN** the command is denied without changing domain state
- **AND** authorized read and retained-export access does not imply mutation permission

#### Scenario: Cross-repository object or cursor
- **WHEN** an actor supplies a snapshot, evidence, event, operation, export or cursor from a repository outside that actor's access
- **THEN** the query or command discloses no inaccessible record content or metadata
- **AND** possession of an object or view identity does not establish authority

#### Scenario: Revocation wins before commit
- **WHEN** an account disable or repository permission revocation commits before a waiting command's authority recheck
- **THEN** the command fails without committing its domain changes or disclosing a prior receipt
- **AND** earlier legitimately committed decisions remain attributable and retained

#### Scenario: Requester loses permission during processing
- **WHEN** an admitted operation's requester loses required repository permission before its next publication batch
- **THEN** the operation stops before publishing that batch and records its stopped or failed scope
- **AND** earlier committed batches and accountable history are not deleted

### Requirement: C-05e Service session lifecycle
The system SHALL reject service access through expired, revoked or disabled sessions without falling back to synthetic persona identity.

#### Scenario: Session expires during a review draft
- **WHEN** a session reaches its declared idle or absolute expiry before review submission
- **THEN** submission fails as unauthenticated and the unsent draft remains associated with its exact context
- **AND** re-authentication requires refreshed authority and review state before a new submission

#### Scenario: Session replay after logout or credential reset
- **WHEN** a client reuses a session revoked by logout, credential reset or account disable
- **THEN** protected commands, history reads and retry receipts remain inaccessible through that session
- **AND** a valid fixture persona cannot restore service access

### Requirement: C-05f Browser write origin validation
The system SHALL reject browser state-changing requests that lack valid session-bound CSRF proof or an allowed origin.

#### Scenario: Cross-origin or missing-CSRF mutation
- **WHEN** a browser submits a domain command or authenticated logout from a disallowed origin or without valid CSRF proof
- **THEN** the request is rejected before domain state or authenticated session state changes
- **AND** a valid session cookie alone does not authorize the request

#### Scenario: Login replaces anonymous pre-session
- **WHEN** valid named credentials are submitted through the allowed login bootstrap and CSRF flow
- **THEN** a new server-held authenticated session replaces the anonymous pre-session
- **AND** the login creates no repository permission or relationship judgment

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

#### Scenario: Correction requires another review
- **WHEN** an eligible candidate or stale context is corrected
- **THEN** the predecessor is retained as superseded and its successor begins candidate and open
- **AND** successor confirmation requires a separate authorized command with its own exact evidence

#### Scenario: Correction cannot be undone by deleting history
- **WHEN** a reversal command targets a correction event rather than a judgment
- **THEN** the command is rejected without removing the correction or successor
- **AND** a further correction requires an accountable successor

### Requirement: C-07b Accountable reversal
The system SHALL preserve committed history when a reviewer reverses the latest effective judgment in an active context.

#### Scenario: Reverse after a follow-up note
- **WHEN** an authorized reviewer reverses the latest effective judgment with a reason
- **THEN** a new reversal event identifies that judgment
- **AND** earlier decisions and unrelated follow-up notes remain retrievable

#### Scenario: Reverse an older judgment
- **WHEN** a reversal targets a judgment superseded by a later effective judgment
- **THEN** the command returns a conflict without deleting or modifying either event

#### Scenario: Reverse retirement after confirmation
- **WHEN** the latest effective judgment is retirement following confirmation in the same active context and an authorized reviewer reverses it with a reason
- **THEN** the preceding non-reversed confirmation becomes effective in that exact context
- **AND** retirement and reversal remain inspectable without confirming any other revision

#### Scenario: Reverse the first judgment
- **WHEN** the only effective judgment in an active context is reversed
- **THEN** validity returns to that context's initial candidate or stale state and resolution becomes open
- **AND** both the judgment and reversal remain retained

### Requirement: C-08a Historical retrieval
The system SHALL retrieve recorded decisions and their exact source context independently of the current revision view.

#### Scenario: Reopen history after restart
- **WHEN** a practitioner reopens an earlier decision after service restart
- **THEN** the earlier reason, actor, recorded time, assertion revision and source references remain inspectable
- **AND** unavailable source is labeled unavailable rather than replaced with current content

#### Scenario: Page history while another event is appended
- **WHEN** a practitioner retrieves later pages of a retained history snapshot while new events are appended
- **THEN** the pages retain the original snapshot boundary and stable event order without duplicates or omissions
- **AND** exact-version references and reversal annotations describe that snapshot

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

#### Scenario: Follow-up survives judgment reversal
- **WHEN** a judgment is reversed after associated follow-up notes or resolutions were recorded
- **THEN** those notes, their original judgment references and their open or resolved state remain inspectable
- **AND** the reversed judgment is identified without automatically resolving or reopening the follow-up

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
