# Proposal

## Why

Continuum currently pairs a strict transactional review backend with high practitioner friction and low-precision discovery:
- Recording an authored decision or requirement via `+ Record intent` (`ServiceApp.jsx`) hardcodes `sourceReference: null`, while adding or correcting a relationship (`ServiceTools.jsx`) requires manually typing 1-based start and end line numbers.
- `Tree-sitter` and `Docling` are invoked during lexical discovery (`discovery.py`), yet their parsed AST symbols and Markdown sections are discarded rather than surfaced for structural navigation, evidence anchoring, and Neo4j node metadata.
- Frozen `lexical-file-v1` discovery matches any shared 4+ character token across files, proposing 19 of 21 possible pairs (4,951 evidence anchors across 4 commits) on the 10-file Healthchecks sample without separating ubiquitous token overlap from high-signal anchors.
- Source acquisition (`acquisition.py`) hardcodes `healthchecks/healthchecks` via pre-hashed manifests, preventing practitioners from onboarding their own bounded Python, Markdown, and plain-text projects through the authenticated interface.

## What Changes

- **Interactive evidence anchoring & unified intent capture (`interactive-anchoring-and-intent`):** Allow practitioners to attach an exact captured artifact anchor or external URI directly inside `+ Record intent`, optionally propose an unconfirmed typed candidate (`motivates` or `implements`) in the same flow, pick line ranges or symbols interactively instead of typing line numbers blind, and initiate anchors directly from Code Explorer.
- **Real Tree-sitter & Docling structural extraction (`structural-ast-docling-extraction`):** Expose parsed Python symbols (classes, functions, methods) from Tree-sitter and Markdown structural sections/blocks from Docling on exact version reads, Code Explorer outlines, Inspector evidence context labels, and Neo4j `:ContinuumArtifact` projections.
- **Signal-tiered discovery & noise triage (`signal-ranked-triage`):** Classify candidate links and evidence into deterministic signal tiers (`high`, `moderate`, `low`) using corpus document frequency and explicit path/identifier specificity while keeping frozen `P-08` (`lexical-file-v1`) discovery reports unchanged, and provide targeted low-signal review/dismissal filters with per-item receipts.
- **Custom bounded workspace & local Git ingestion (`custom-workspace-ingestion`):** Add authenticated workspace creation and snapshot ingestion for user-supplied `.py`/`.md`/`.txt` file bundles or opted-in local Git repositories alongside the preserved `healthchecks/healthchecks` baseline, routed through the full PostgreSQL + Redis/RQ + Tree-sitter/Docling + Neo4j + native Git pipeline.

## Capabilities

### New Capabilities

- `interactive-anchoring-and-intent`: Interactive file, line-range, and symbol/section evidence anchoring across `+ Record intent`, `Add a relationship`, `Correct this relationship`, and Code Explorer, plus optional unconfirmed candidate proposal during intent capture.
- `structural-ast-docling-extraction`: Tree-sitter Python symbol span extraction and Docling Markdown outline extraction surfaced on versioned reads, UI outlines, evidence context badges, and Neo4j node properties.
- `signal-ranked-triage`: Deterministic corpus-specificity signal tiering (`high`, `moderate`, `low`), queue filters, and safe noise-triage workflows that preserve frozen `P-08` discovery outputs byte-for-byte.
- `custom-workspace-ingestion`: Authenticated creation and revision ingestion of bounded custom workspaces (uploaded file bundles or opted-in local Git directories) processed through the Table 5 service stack without altering the Healthchecks baseline.

### Modified Capabilities

None. Observed behavior in `openspec/specs/frontend-service/spec.md` and `openspec/specs/frontend-demo/spec.md`, as well as existing `establish-versioned-continuity-core` and `reduce-first-load-review-burden` baselines, remain intact until this change is implemented and verified.

## Impact

- Affected backend modules: `services/api/src/continuum/discovery.py`, `services/api/src/continuum/main.py`, `services/api/src/continuum/graph_store.py`, `services/api/src/continuum/pipeline.py`, `services/api/src/continuum/pipeline_schemas.py`, `services/api/src/continuum/schemas.py`, `services/api/src/continuum/acquisition.py` (untouched for Healthchecks; reused utilities), and a new `services/api/src/continuum/local_repo.py`.
- Affected frontend modules: `apps/web/src/components/ServiceApp.jsx`, `apps/web/src/components/ServiceTools.jsx`, `apps/web/src/data/evidenceSignal.js`, `apps/web/src/data/serviceApi.js`, `apps/web/src/context/ServiceContinuumProvider.jsx`, `apps/web/src/components/service.css`, and new focused interactive picker / custom workspace import components.
- Traceability references: `C-01a/b/c`, `C-02a/b`, `C-03a/b/c/d`, `C-04a/b`, `C-05a`, `C-06a/b`, `C-07a/b/c/e`, `C-08a/b/c/d`, `HC-01`, `HC-02D`, and `UP-01`–`UP-08`. Extensions `X-01` (broad external connectors/webhooks) and `X-02` (live LLM assistance) remain out of scope.
- Out of scope: LLM auto-confirmation or semantic scoring claims, cross-file transitive call graphs, silent transfer of confirmations across changed files, live production deployment, or automatic migration of existing user databases.
- **Authorization boundary:** Planning does not authorize implementation. No application source files, dependencies, schemas, or retained Healthchecks records are modified until the user explicitly approves this proposal and implementation plan.
