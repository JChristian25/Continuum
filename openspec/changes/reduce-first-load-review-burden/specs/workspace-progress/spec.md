# Workspace progress

## Purpose
Expose the actual path from accepted input capture to incoming revalidation for the selected exact repository context.

## ADDED Requirements

### Requirement: WP-01 Service-derived lifecycle
The Workspace SHALL persistently show capture, discovery, baseline review, comparison and incoming revalidation progress from exact service state, including counts, coverage, blockers and available actions.

#### Scenario: First load and partial discovery
- **WHEN** captured inputs have a completed discovery run with partial coverage
- **THEN** capture is completed and discovery shows the published outcome and partial scope without a simulated percentage
- **AND** reviewed and pending counts identify actual effective decisions, including rejections

#### Scenario: Processing fails or cannot be read
- **WHEN** processing is queued, running, failed, incomplete or unavailable
- **THEN** its actual status or unknown state and the next permissible action remain visible without implying success

### Requirement: WP-02 Independent comparison availability
The Workspace SHALL expose comparison whenever captured baseline and target satisfy service eligibility, independently of unfinished baseline review.

#### Scenario: Pending baseline reviews
- **WHEN** both accepted inventories are captured and a baseline is selected while reviews remain pending
- **THEN** comparison is available to an authorized actor and review remains visibly incomplete
- **AND** the explanation identifies Git comparison of captured revisions and directly affected incoming relationships

#### Scenario: Incoming queue
- **WHEN** comparison publishes
- **THEN** its exact incoming stale/candidate counts and unresolved evidence are displayed, including an explicit zero-affected result

### Requirement: WP-03 Context-correct completion
Progress SHALL reflect the selected exact snapshot and the existing service completion conditions without transferring an earlier completion to later work.

#### Scenario: Review becomes eligible for completion
- **WHEN** pending count reaches zero
- **THEN** completion still requires a current active snapshot, settled processing and exact limitation acknowledgment
- **AND** independent follow-ups remain visible

#### Scenario: Snapshot changes or page reloads
- **WHEN** a decision, capture, discovery, comparison or snapshot selection changes the context or the page reloads
- **THEN** progress is read again for that context and prior completion remains inspectable only for its recorded version

#### Scenario: Viewer or historical context
- **WHEN** a viewer or historical snapshot is selected
- **THEN** progress provides inspection actions and does not authorize mutation
