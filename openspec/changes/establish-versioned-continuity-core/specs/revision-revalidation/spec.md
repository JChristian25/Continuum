# Revision revalidation delta

## Purpose

Identify supported revision changes that warrant another relationship judgment while keeping earlier source evidence and decisions available for historical inspection.

## ADDED Requirements

### Requirement: C-06a Selected revision comparison
The system SHALL compare explicitly selected revisions of the configured repository and report supported source changes with their revision context.

#### Scenario: Compare two readable commits
- **WHEN** a practitioner selects two available commits in the configured repository
- **THEN** the comparison identifies its base and target commits and supported changed paths
- **AND** it reports the processing scope and limitations

#### Scenario: Equal revisions
- **WHEN** the same resolved commit is selected as base and target
- **THEN** the comparison reports no source changes
- **AND** that result does not establish complete relationship coverage

#### Scenario: Missing history
- **WHEN** a required commit or source object is unavailable
- **THEN** the comparison reports failure or incomplete scope with the unavailable input
- **AND** it does not fabricate a complete empty change set

### Requirement: C-06b Directed relationship impact context
The system SHALL identify directly related artifacts for inspection when either endpoint of a registered documents relationship changes under the declared rule.

#### Scenario: Code-origin change
- **WHEN** supported code content changes at an endpoint of a registered documents relationship
- **THEN** the related document is surfaced for inspection with the relationship path, changed versions and reason
- **AND** the relationship remains directed from document to code

#### Scenario: Documentation-origin change
- **WHEN** a supported document changes at the other endpoint of that relationship
- **THEN** the related code is surfaced for inspection even if its source is unchanged
- **AND** inspection does not prescribe a code edit

#### Scenario: Unchanged disconnected control
- **WHEN** an unchanged artifact has no registered relationship to changed endpoints in the declared inventory
- **THEN** this direct propagation rule creates no review context for that artifact
- **AND** unknown processing coverage remains visible

### Requirement: C-07c No inherited confirmation
The system SHALL distinguish a new changed-version review context from earlier confirmed or unconfirmed contexts.

#### Scenario: Earlier confirmed relationship
- **WHEN** a change affects a previously confirmed assertion's endpoint or evidence
- **THEN** the new exact-version context is stale and open for review
- **AND** the earlier confirmation remains retrievable for its original versions

#### Scenario: Earlier unconfirmed candidate
- **WHEN** a change affects an assertion that was never confirmed
- **THEN** the new context remains an unconfirmed candidate
- **AND** it is not represented as a stale previously confirmed link

#### Scenario: Inspect base history during incoming review
- **WHEN** a comparison presents an earlier confirmation beside the incoming review context
- **THEN** the base view is identified as historical and the incoming view names its own exact revision and evidence
- **AND** a write through the base historical view cannot confirm the incoming context

### Requirement: C-07d Explicit unresolved change context
The system SHALL report uncertainty when supported evidence cannot establish endpoint continuity or anchor relevance after a change.

#### Scenario: Ambiguous rename or deleted endpoint
- **WHEN** an endpoint is deleted or its identity across a move cannot be established by the declared support policy
- **THEN** the review context identifies the deleted or unresolved endpoint and its limitation
- **AND** the system does not invent a valid replacement relationship

#### Scenario: Missing incoming version cannot be confirmed
- **WHEN** a changed context has a missing or unresolved incoming endpoint version or required evidence
- **THEN** confirmation is rejected without substituting the earlier endpoint or current branch content
- **AND** an authorized retirement with a reason can still retain that absence and the earlier source references

### Requirement: C-07e Revalidation preserves earlier context
The system SHALL record a new version-specific decision when a reviewer reconfirms, corrects or retires an affected relationship.

#### Scenario: Reconfirm after source inspection
- **WHEN** an authorized reviewer reconfirms the stale context with readable incoming evidence and a reason
- **THEN** the new decision applies to the incoming assertion revision
- **AND** the earlier assertion, evidence and reason remain separately available

#### Scenario: Retire the incoming relationship
- **WHEN** an authorized reviewer retires an affected relationship with a recorded reason for its incoming version context
- **THEN** that context is retired and contributes no current confirmed support
- **AND** its earlier confirmation, evidence, actor and reason remain separately retrievable

#### Scenario: Comparison does not revive a retired claim
- **WHEN** later comparison processing encounters an assertion whose preceding context was retired
- **THEN** the retired claim is not automatically restored as confirmed or stale support
- **AND** a proposed successor remains separate from the retained retirement

#### Scenario: Repeat comparison processing
- **WHEN** the same comparison attempt is retried for unchanged inputs
- **THEN** previously created review contexts and decisions are not duplicated

### Requirement: C-09a Reproducible demonstration context
The system SHALL identify the build, source revisions, declared inventory, processing configuration and limitations associated with a demonstration result.

#### Scenario: Repeat a bounded demonstration
- **WHEN** a demonstration is replayed from its documented isolated reset procedure
- **THEN** its result identifies the exact inputs and configuration used
- **AND** unsupported cases remain recorded rather than being counted as passed verification

### Requirement: C-10b Review-cycle completion scope
The system SHALL associate cycle completion and exported results with the selected reviewed context snapshot.

#### Scenario: A new context follows a completed cycle
- **WHEN** new pending review work or a reversed decision changes the current snapshot
- **THEN** current completion is reassessed
- **AND** a prior completion record is retained without making the new snapshot appear complete

#### Scenario: Export the selected context
- **WHEN** a practitioner exports the selected review snapshot
- **THEN** its repository, revision identities, judgments, follow-up state and limitations match that snapshot
- **AND** synthetic fixture labels are not presented as real-project evidence

#### Scenario: Completion races with new work
- **WHEN** a completion request targets a stale snapshot or unsettled processing can still publish review work for that selection
- **THEN** the request returns a conflict without a new completion record
- **AND** later completion requires an explicitly selected current settled snapshot

#### Scenario: Review is complete while follow-up remains open
- **WHEN** all pending relationship reviews in the current settled snapshot are resolved but independent follow-up remains open
- **THEN** review completion retains the open follow-up and explicitly acknowledged processing limitations
- **AND** completion does not assert corrected content or complete relationship discovery

#### Scenario: Export historical or incomplete review
- **WHEN** an authorized practitioner exports a retained historical snapshot or an incomplete review snapshot
- **THEN** the export preserves that snapshot's exact identities, judgments, completion state, provenance and limitations
- **AND** export does not grant write authority over historical records or change when later current work changes

### Requirement: C-09b Demonstration release disclosure
The demonstration release record SHALL identify its software version, configuration, selected language and formats, dependencies, operating requirements, support matrix and known limitations.

#### Scenario: Inspect a demonstration release record
- **WHEN** the recorded demonstration version is prepared for practitioner inspection
- **THEN** the release record discloses each required setup and support field and links requirements to verification results and guided tasks
- **AND** proposed, implemented, partially implemented and unsupported provisions remain distinguishable
