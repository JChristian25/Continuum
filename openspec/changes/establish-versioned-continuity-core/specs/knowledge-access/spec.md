# Knowledge access delta

## Purpose

Let practitioners find supported records and explore typed relationships while inspecting source evidence, selected versions and retained rationale. This covers the manuscript's core knowledge-access behavior using the existing frontend design as its interaction reference.

## ADDED Requirements

### Requirement: C-03c Common typed artifact representation
The system SHALL represent captured code, documents, requirements and decisions in a common typed graph with inspectable relationship direction and context.

#### Scenario: Inspect captured artifact kinds
- **WHEN** a practitioner opens a graph view containing captured code, documentation and linked requirement or decision records
- **THEN** each displayed record identifies its artifact kind and version context
- **AND** each displayed assertion identifies its type, direction and review state

#### Scenario: Represented but not analyzed
- **WHEN** a captured record is represented in the graph without supported automated extraction or analysis
- **THEN** the view identifies that support boundary
- **AND** graph membership alone does not label the record analyzed or verified

### Requirement: C-08b Search supported project context
The system SHALL let practitioners search accessible supported records within an explicitly selected project and revision context.

#### Scenario: Locate a supported artifact
- **WHEN** a practitioner searches for an artifact present in the selected supported inventory
- **THEN** results identify the matching records and their source and version context
- **AND** a result can be opened for evidence inspection

#### Scenario: No match or incomplete coverage
- **WHEN** a search produces no match or excludes inaccessible or unsupported content
- **THEN** the result distinguishes no match within searched scope from incomplete coverage
- **AND** it does not claim that the project contains no relevant knowledge

### Requirement: C-08c Graph-based evidence inspection
The system SHALL let practitioners navigate a displayed supported relationship to its assertion evidence and retained rationale.

#### Scenario: Follow a typed relationship
- **WHEN** a practitioner selects a displayed relationship between supported artifacts
- **THEN** its exact endpoint versions, evidence, review state and available decision rationale are inspectable
- **AND** a candidate is distinguishable from confirmed support

### Requirement: C-08d Explicit current and historical views
The system SHALL identify whether displayed knowledge belongs to the selected current context or an earlier retained context.

#### Scenario: Retrieve earlier rationale
- **WHEN** a practitioner switches from an incoming relationship context to a retained earlier decision
- **THEN** the view identifies the earlier revision and reason
- **AND** it does not present the earlier judgment as a judgment of the incoming evidence
