# Artifact context delta

## Purpose

Let practitioners identify supported project artifacts and inspect the exact source versions and evidence used in a relationship judgment. These are proposed capabilities for the future continuity cycle.

## ADDED Requirements

### Requirement: C-01a Artifact identity
The system SHALL retain an artifact identity, kind and source location for every captured artifact in the selected project.

#### Scenario: Capture a supported file
- **WHEN** a supported Python file, Markdown document or plain-text document is captured from the selected repository revision
- **THEN** the artifact record identifies its repository, kind and repository-relative path
- **AND** later relationships reference that artifact identity

### Requirement: C-01b Immutable source versions
The system SHALL preserve each captured artifact version independently of later source changes.

#### Scenario: Capture a changed file
- **WHEN** a later selected commit changes the contents of an already captured file
- **THEN** a distinct version identifies the later commit and content
- **AND** the earlier version and its exact source remain retrievable

#### Scenario: Requested source is unavailable
- **WHEN** an exact requested revision or source object cannot be read
- **THEN** the result identifies the unavailable source
- **AND** current branch contents are not substituted for the requested version

### Requirement: C-01c Authored requirement and decision records
The system SHALL retain structured requirements and decisions as attributed, versioned records distinct from relationship judgments.

#### Scenario: Record intent about an artifact
- **WHEN** an authorized practitioner captures a requirement or decision with content and an available source reference
- **THEN** the record preserves its kind, author and version
- **AND** authorship alone does not confirm a relationship to the referenced artifact

### Requirement: C-03a Inspectable evidence anchors
The system SHALL identify the exact artifact version and source location supporting each retained evidence item.

#### Scenario: Open evidence from a relationship
- **WHEN** a practitioner opens an available evidence item
- **THEN** its source location, exact version, discovery or capture method and limitations are inspectable

#### Scenario: Anchor cannot be resolved
- **WHEN** an evidence locator cannot be resolved against its recorded source version
- **THEN** the evidence is marked unavailable or unresolved with a reason
- **AND** it is not silently presented as verified evidence from another version

### Requirement: C-02a Processing support and uncertainty
The system SHALL report processing support separately for ingestion, extraction, relationship evidence and change handling within the declared inventory.

#### Scenario: Unsupported document content
- **WHEN** an input is unsupported for extraction or evidence processing
- **THEN** that function is reported as unsupported with its limitation
- **AND** successful registration alone does not label the artifact fully analyzed

#### Scenario: Processing is incomplete
- **WHEN** a declared operating limit or inaccessible input prevents complete processing
- **THEN** the result identifies incomplete scope and its reason
- **AND** missing results do not establish that the affected artifacts have no relationships or impacts

#### Scenario: Inspect the support matrix
- **WHEN** a practitioner inspects support for the selected release inventory
- **THEN** ingestion, extraction, relationship evidence and change handling each identify implemented, partially implemented or unsupported functions and their limits
- **AND** unverified coverage is identified as unknown rather than implemented

### Requirement: C-02b Core document input coverage
The system SHALL support Markdown and plain-text documents as core document inputs within the selected project's declared support profile.

#### Scenario: Capture a plain-text document
- **WHEN** a supported plain-text document is captured from the selected revision
- **THEN** its versioned content and available source anchors can be inspected for relationship evidence
- **AND** actual extraction, evidence and change support are reported separately

### Requirement: C-03d Inspectable processing provenance
The system SHALL retain inspectable source versions, processing activities and responsible agents for produced or reviewed relationship evidence.

#### Scenario: Inspect the origin of an evidence item
- **WHEN** a practitioner opens the provenance of retained evidence
- **THEN** its source versions, processing method and activity, and responsible practitioner or system agent are identifiable
- **AND** provenance alone does not label the assertion semantically correct
