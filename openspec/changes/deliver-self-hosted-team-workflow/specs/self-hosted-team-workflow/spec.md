## ADDED Requirements

### Requirement: TEAM-01 Fresh team installation

An operator SHALL be able to start an HTTPS instance on a fresh host, create named accounts and grant access to a team repository.

#### Scenario: First project

- **WHEN** an operator initializes the stack and provisions a developer
- **THEN** the developer can sign in, connect a team-controlled repository and inspect its selected revision
- **AND** a teammate granted viewer access can read the team's decision with writes restricted by the service

### Requirement: TEAM-02 Return to work

The service frontend SHALL resume the last available repository and revision opened by that account in the same browser.

#### Scenario: Return during a comparison

- **WHEN** an authorized developer signs back in after reviewing an incoming revision
- **THEN** Continuum opens the same comparison when the service can still resolve it
- **AND** the frontend retrieves current workspace data under the new session

#### Scenario: Access has changed

- **WHEN** a developer's previous repository is absent from the current grants
- **THEN** Continuum selects an accessible workspace or offers the available onboarding actions

### Requirement: TEAM-03 Recovery

A team operator SHALL be able to recover repository evidence, review history and grants from a documented backup.

#### Scenario: Replacement host

- **WHEN** the operator restores a backup to an empty installation of the same version
- **THEN** a reviewer can retrieve the recorded decision, its exact source and its revision
- **AND** repository grants still govern access

### Requirement: TEAM-04 Account for Git file coverage

Continuum SHALL retain the exact bytes of eligible regular UTF-8 files at a selected Git commit and report the capture scope and exclusions for that revision.

#### Scenario: Inspect a whole-tree capture

- **WHEN** a developer captures a commit without a path filter
- **THEN** the snapshot identifies the commit, the tree entry count, the captured file count and each excluded path with its reason
- **AND** an unfamiliar file extension or Git archive attribute does not prevent capture of an otherwise eligible file

#### Scenario: Admission exceeds the supported byte budget

- **WHEN** the selected revisions exceed the distinct eligible byte budget for a request
- **THEN** the service returns the limiting resource and rejects the request before registering the workspace or revision

### Requirement: TEAM-05 Review the next remote commit

Continuum SHALL refresh a connected remote branch and preserve the captured revisions and earlier review evidence across changes to that branch.

#### Scenario: Incoming commit after a review

- **WHEN** the developer refreshes the connected branch after a push
- **THEN** the commit picker shows the new tip and the developer can capture that exact revision in the existing workspace
- **AND** a comparison keeps the earlier judgment inspectable alongside the changed evidence

#### Scenario: Rewritten or removed branch

- **WHEN** a team rewrites or deletes a remote branch
- **THEN** browsing or importing that branch reflects the current upstream refs
- **AND** evidence for an already captured commit remains available by its original identity

### Requirement: TEAM-06 Resume an interrupted import

Continuum SHALL let a developer recover an interrupted import in the same browser and report the actual processing outcome.

#### Scenario: Server receipt lost in transit

- **WHEN** the browser loses the reply to a submitted import and the same account resumes it
- **THEN** the service reconciles the original request and workspace under the account's current grants
- **AND** duplicate submissions of that request produce a single admission

#### Scenario: Browser closes during processing

- **WHEN** capture finishes after the developer closes the browser
- **THEN** any discovery requested with the import is scheduled by the service after successful capture
- **AND** a developer who reopens the workspace can inspect operation status and partial coverage
