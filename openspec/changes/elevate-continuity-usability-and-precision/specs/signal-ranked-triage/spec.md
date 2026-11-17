# Signal-ranked triage

## Purpose
Classify candidate assertions and evidence by corpus specificity and anchor strength so reviewers can prioritize genuine links and triage high-frequency lexical noise without silently dropping candidates or mutating frozen `P-08` discovery outputs.

## ADDED Requirements

### Requirement: ST-01 Deterministic candidate signal classification
The system SHALL classify each snapshot relationship into a deterministic signal tier (`high`, `moderate`, or `low`) using relationship origin, explicit path/filename evidence, and corpus document-frequency of shared lexical tokens while leaving frozen `P-08` backend discovery outputs unchanged.

#### Scenario: Distinguish explicit and domain-specific links from ubiquitous token noise
- **WHEN** a snapshot contains manual typed links (`implements`, `motivates`, manual `documents`), automatic candidates with explicit path/stem or low-frequency compound identifiers, and automatic candidates matched solely by ubiquitous tokens appearing across most files
- **THEN** manual links and explicit path/stem/specific-identifier candidates classify as `high`, multi-term non-ubiquitous candidates classify as `moderate`, and ubiquitous-token-only candidates classify as `low`
- **AND** frozen `HC-LEXICAL-2026-11-13-P1` discovery outputs and `19`-pair snapshot membership on Healthchecks remain byte-for-byte intact

### Requirement: ST-02 Signal filtering with honest completion counts
The system SHALL allow filtering the relationship review queue by signal tier while always disclosing unfiltered pending review totals and preventing cycle completion until all open relationships are resolved.

#### Scenario: Filter out low-signal noise in the review queue
- **WHEN** a reviewer selects `High & moderate` or `High only` in the queue signal filter
- **THEN** the list shows only matching relationships alongside an explicit disclosure of how many relationships are hidden by the active filter
- **AND** Workspace pending counts and `complete_cycle` eligibility continue to enforce the true unfiltered `pendingReviewCount`

### Requirement: ST-03 Controlled low-signal batch triage
The system SHALL allow an authorized reviewer to select visible `low` signal open candidates for batch inspection and dismissal while retaining per-context evidence inspection, projection checks, and individual `record_judgment` receipts.

#### Scenario: Dismiss low-signal lexical noise with individual receipts
- **WHEN** an authorized reviewer in an active snapshot clicks `"Select visible low-signal"` and confirms batch rejection
- **THEN** each rejected candidate records its own accountable `ReviewEvent` and `Receipt` under current projection and authority checks
- **AND** viewer accounts and historical snapshots cannot trigger batch triage controls
