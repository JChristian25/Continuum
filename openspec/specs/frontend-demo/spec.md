# Frontend demonstration specification

## Purpose

Record the observed synthetic review workflow in the current frontend. This baseline is grounded in `src/App.jsx`, `src/context/ContinuumContext.jsx`, `src/data/workflow.js`, `src/data/state.js`, `src/components/Inspector.jsx` and `src/components/ReviewSummary.jsx`. It does not establish connected authentication, Git ingestion, analysis services or durable multi-user storage. Existing limitations are documented in `../../../specs/engineering-review.md`.

## Requirements

### Requirement: DEMO-01 Sample workspace entry
The frontend demonstration SHALL present its configured synthetic workspace through demo sign-in and sample setup.

#### Scenario: Complete sample setup
- **WHEN** a user completes demo sign-in and sample setup
- **THEN** the application opens its configured sample workspace
- **AND** setup communicates that no remote repository was accessed

### Requirement: DEMO-02 Module and evidence navigation
The demonstration SHALL let users navigate the configured modules and open a selected fixture artifact in the inspector.

#### Scenario: Inspect a queue item
- **WHEN** a user selects an existing fixture artifact from the review queue
- **THEN** the inspector opens that artifact's fixture context
- **AND** its baseline or incoming excerpt follows the selected demo revision mode

### Requirement: DEMO-03 Judgment-save guards
The demonstration SHALL reject a judgment save when its current workflow guard reports an invalid review input or context.

#### Scenario: Historical baseline is read-only for judgment save
- **WHEN** a judgment save is attempted in R0 historical mode
- **THEN** the workflow returns the historical-baseline error and does not commit the review

#### Scenario: Reviewer and rationale are required by the save guard
- **WHEN** the active persona is not an Authorized Reviewer, the rationale is blank, or an AI draft remains unconfirmed
- **THEN** the save guard rejects the command without recording a judgment

### Requirement: DEMO-04 Candidate rejection
The demonstration SHALL resolve a rejected candidate review without promoting it to confirmed support.

#### Scenario: Reject the sample semantic candidate
- **WHEN** an authorized incoming-mode reviewer saves Reject candidate with valid rationale and follow-up disposition
- **THEN** that item's review status becomes reviewed
- **AND** its coverage condition becomes no_link

### Requirement: DEMO-05 Review and follow-up presentation
The demonstration SHALL present review completion separately from outstanding follow-up work and unknown coverage.

#### Scenario: Reviewed queue with unfinished work
- **WHEN** all configured queue items have judgments but a code or documentation follow-up remains open
- **THEN** the summary reports reviewed progress and open follow-up counts separately
- **AND** it retains the warning that queued review completion does not establish full coverage or completed edits

### Requirement: DEMO-06 Browser-local state
The demonstration SHALL use browser-local state to retain its sample workspace between reloads when browser storage succeeds.

#### Scenario: Restore a saved sample workspace
- **WHEN** valid sample state has been written to localStorage and the application reloads
- **THEN** loadState merges the saved sample state with its fixture baseline

#### Scenario: Malformed stored sample state
- **WHEN** the saved sample state cannot be parsed
- **THEN** loadState falls back to the initial fixture state

### Requirement: DEMO-07 Local undo
The demonstration SHALL offer its existing local undo behavior for a newly committed fixture judgment.

#### Scenario: Undo the latest matching local event
- **WHEN** the toast undo targets the last review event for its original artifact
- **THEN** undoCommittedReview restores that artifact's earlier fixture value
- **AND** it removes that event from the local activity list while preserving unrelated list entries

This local behavior is an observed baseline, not an append-only audit guarantee. Storage failures, historical field inconsistencies and command-specific persona differences remain known limitations; the proposed continuity change must not label them already fixed.
