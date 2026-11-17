# Structural AST and Docling extraction

## Purpose
Expose real Tree-sitter Python symbol boundaries and Docling Markdown structural sections on exact captured versions, Code Explorer outlines, Inspector evidence items, and Neo4j node projections while preserving raw byte digests and frozen lexical discovery parity.

## ADDED Requirements

### Requirement: SE-01 Tree-sitter Python symbol extraction
The system SHALL extract exact 1-based Python `class`, `function`, and `method` line spans using Tree-sitter for captured Python artifact versions without modifying raw source bytes or SHA-256 digests.

#### Scenario: Extract symbols from a valid Python version
- **WHEN** a client requests an exact Python `ArtifactVersion` via `GET /api/v1/repositories/{repositoryId}/versions/{versionId}`
- **THEN** the response includes `structure.engine = "tree-sitter-python"`, `structure.hasError = false`, and deterministic symbol entries containing `kind`, `name`, `qualifiedName`, `startLine`, `endLine`, and `signature`
- **AND** `content` and `contentDigest` remain identical to the immutable retained UTF-8 bytes

#### Scenario: Handle Python syntax errors truthfully
- **WHEN** a Python artifact version contains syntax error nodes in the Tree-sitter parse tree
- **THEN** the response marks `structure.hasError = true`, returns any cleanly parsed spans or an empty list without failing the version read, and preserves `P-08` partial scope rules

### Requirement: SE-02 Docling Markdown outline extraction
The system SHALL extract structural headings, code blocks, and tables aligned to exact 1-based raw lines using Docling for captured Markdown versions while handling plain-text files and malformed input safely.

#### Scenario: Extract aligned sections from Markdown
- **WHEN** a client requests a captured Markdown `ArtifactVersion`
- **THEN** the response includes `structure.engine = "docling"` and ordered structural items with exact 1-based `startLine` and `endLine` bounds matching the raw Markdown lines
- **AND** requesting a `.txt` or authored record returns plain-text/record structure metadata without inventing Markdown sections

#### Scenario: Docling conversion failure falls back safely
- **WHEN** Docling raises a conversion error on an anomalous Markdown input
- **THEN** the version read still succeeds with verified `content`, sets `structure.fallbackUsed = true`, and discloses the fallback state instead of returning an error or fabricated outline

### Requirement: SE-03 Structural context in Graph, Code Explorer, and Inspector
The system SHALL project structural counts onto Neo4j `:ContinuumArtifact` nodes and surface clickable outlines and enclosing symbol/section labels in the UI without altering underlying evidence locators.

#### Scenario: Inspect structural context in Code Explorer and Inspector
- **WHEN** a reviewer opens a Python or Markdown file in Code Explorer or opens a relationship in the Inspector
- **THEN** Code Explorer lists clickable symbols or sections that scroll to and highlight the exact span, and Inspector evidence cards display the enclosing symbol or section name alongside the exact line locator
- **AND** Neo4j `:ContinuumArtifact` nodes in synced snapshots retain `symbolCount`, `sectionCount`, and `structureEngine` properties
