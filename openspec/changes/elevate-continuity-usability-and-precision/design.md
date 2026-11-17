# Design

## Context

Read-only inspection on 2026-11-17 established that Continuum's authenticated stack (`React 19 + Vite`, `FastAPI`, `PostgreSQL 17`, `Redis 7 + RQ`, `Tree-sitter`, `Docling`, `Neo4j 5 Community`, and native `Git`) enforces strong versioning, idempotency receipts, and fail-closed authorization, yet suffers from four practical usability bottlenecks:
1. `RecordDialog` (`apps/web/src/components/ServiceApp.jsx:670-678`) hardcodes `sourceReference: null` and requires `sourceAbsenceReason`, even though `CaptureRecord` (`services/api/src/continuum/pipeline_schemas.py:112-127`) and `capture.py:41-78` already accept `ArtifactSource` and `ExternalSource`. Meanwhile `RelationshipEditor` (`apps/web/src/components/ServiceTools.jsx:15-69`) asks users to type 1-based `Start line` and `End line` numbers manually with at most an 80-line preview.
2. `discovery.py:135-185` runs `tree_sitter` (`_PY_LANGUAGE`) and `docling` (`_DOCLING_MD_CONVERTER`), but `extract_document_lines()` discards the converted `DoclingDocument` after counting `structuredItems`, and `code_index()` flattens identifiers into a single token-to-first-line dictionary without exposing classes, functions, or Markdown sections.
3. Frozen `P-08` discovery (`discovery.py:203-315`) proposes 19 of 21 `(document, code)` pairs on `healthchecks/healthchecks` (4,951 lexical anchors across 4 commits) because any shared 4+ character token outside the 15-word stop list creates a candidate. `evidenceSignal.js` ranks evidence within one already-opened relationship, but `Relationships` (`ServiceApp.jsx:243-408`) lacks corpus-specificity signal tiering across the queue.
4. `acquisition.py:16-18, 70-75` hardcodes `REPOSITORY = "healthchecks/healthchecks"` and `REPOSITORY_ID = 38067078` with a maximum of 10 paths, while `ServiceApp.jsx` offers no UI to register or ingest a user's own bounded workspace.

## Goals / Non-Goals

Goals:
- Make anchoring code/doc lines and recording linked architectural intent fast and visual without sacrificing exact-version accountability or bypassing human confirmation.
- Make every layer of the Manuscript Table 5 stack (`Tree-sitter`, `Docling`, `Neo4j`, `Redis/RQ`, `PostgreSQL`, `Git`) perform observable, user-facing work.
- Reduce lexical noise triage burden while preserving `HC-LEXICAL-2026-11-13-P1` (`P-08`) byte-for-byte reproducibility.
- Allow authenticated users to import bounded custom workspaces (`.py`, `.md`, `.txt`) or opted-in local Git commits via the UI into the full continuity pipeline.

Non-Goals:
- Replacing human confirmation with automated/LLM approval (`X-02` remains excluded).
- Cross-file AST call-graph inference, transitive impact propagation, or automatic rename transfer.
- Unbounded whole-monorepo ingestion, arbitrary binary formats (`.pdf`/`.docx` in live core), or executing untrusted user code.
- Replacing `DESIGN.md` warm-paper aesthetic or altering `?mode=demo`.

## Decisions

### 1. Interactive Anchoring & Unified Intent Capture

- **Unified `RecordDialog`:** Extend `RecordDialog` in `ServiceApp.jsx` with a source reference mode selector:
  - `artifact`: Pick a captured artifact in the current snapshot and select exact lines (or structural symbol/section range) via a shared `SourceLinePicker` component, populating `ArtifactSource`.
  - `external`: Supply `{ kind: "external", uri, label, availability, reason }` (`ExternalSource` already validated by `pipeline_schemas.py:98-109`).
  - `none`: Retain `sourceReference: null` with required `sourceAbsenceReason`.
- **Optional immediate candidate link:** When authoring a `decision` or `requirement` in `RecordDialog`, provide an opt-in checkbox (`"Also propose an unconfirmed relationship to a captured artifact"`). When checked and submitted, the client executes `capture_record` first, reads the returned `{ artifactId, artifactVersionId }`, and if an anchor was picked or target selected, submits `capture_candidate` (`motivates` for `decision -> code`, `implements` for `code -> requirement`) anchored to line 1 of the authored record and/or the picked code/doc lines. If the second command fails, the authored record remains safely saved and the failure is surfaced without losing drafts. Every proposed assertion enters strictly as `validity: "candidate", resolution: "open"` (`C-03b`, `C-04a`).
- **`SourceLinePicker` in `RelationshipEditor` & `Files`:** Replace manual line-number guesswork with an interactive line-numbered viewer that fetches the target `ArtifactVersion` via `GET /api/v1/repositories/{repoId}/versions/{versionId}` (cached per `versionId`), renders clickable structural symbol/section chips (from Pillar 2), and lets the user click a start line and Shift-click (or click "Set end line") an end line. Manual number inputs remain synchronized as accessible numeric controls. Inside `Files` (`Code explorer`), add `"Link to record / decision"` and `"Record intent from selection"` buttons pre-seeded with the currently viewed file/line range.

### 2. Real Tree-sitter & Docling Structural Extraction

- **Python AST outline (`discovery.py`):** Add `extract_python_symbols(text: str)` using `tree_sitter` (`_PY_LANGUAGE`). Walk `class_definition` and `function_definition` nodes (plus `decorated_definition` bounds) to emit `{ id, kind: "class" | "function" | "method", name, qualifiedName, startLine, endLine, signature }` with exact 1-based line spans. `code_index()` remains unchanged for `P-08` discovery parity.
- **Markdown Docling outline (`discovery.py`):** Add `extract_markdown_sections(document: Source)` using `_DOCLING_MD_CONVERTER.convert_string(...)`. Walk `conversion.document.iterate_items()` (`SectionHeaderItem`, `TitleItem`, `CodeItem`, `TableItem`, etc.) and align each item's provenance or text back to exact 1-based line ranges in `document.text.splitlines()`, filling closing `endLine` boundaries up to the next heading of equal or higher level (or EOF). For plain-text (`.txt`) or authored records (`kind == "record"`), return `{ engine: "plain_text", items: [] }` cleanly without fabricating Markdown structure.
- **Version read contract (`main.py`):** Extend `GET /api/v1/repositories/{repository_id}/versions/{version_id}` (`main.py:276-287`) with an additive `structure` object (`{ engine, hasError, items }`) computed deterministically from the verified UTF-8 content without modifying `content` or `contentDigest`.
- **Neo4j projection (`graph_store.py`):** Store `symbolCount` / `sectionCount` / `structureEngine` properties on `:ContinuumArtifact` nodes during `sync_snapshot_to_neo4j()`.
- **UI integration (`ServiceApp.jsx`):** Render a clickable `"Document & symbol outline"` index inside `Files` (`Code explorer`) that scrolls/highlights the selected span, and annotate `Inspector` evidence items with their enclosing symbol/section name (e.g., `Lines 64–72 · in Command.handle()` or `Line 110 · § Filtering rules`).

### 3. Signal-Tiered Discovery & Noise Triage

- **Immutable `P-08` core:** Keep `discover()` in `discovery.py` and the frozen `HC-LEXICAL-2026-11-13-P1` JSON outputs unchanged (`19` candidates on Healthchecks). Never silently drop or hide low-signal candidates from snapshot counts, exports, or completion gates.
- **Corpus-specificity signal classifier (`evidenceSignal.js`):** Compute inverse-document-frequency style ubiquity across the loaded snapshot's `artifacts` / evidence tokens:
  - Classify a relationship row into `high`, `moderate`, or `low`:
    - `high`: Manual or authored relationships (`methodId !== 'lexical-file-v1'`, or `type !== 'documents'`), OR any automatic candidate containing an explicit repository-relative path match, filename/stem match, or a shared compound/specific identifier present in $\le 35\%$ of code/doc artifacts.
    - `moderate`: Automatic candidate with $\ge 3$ distinct shared non-ubiquitous tokens (present in $< 70\%$ of artifacts) and no path/stem match.
    - `low`: Automatic candidate whose evidence consists solely of ubiquitous tokens (present in $\ge 70\%$ of artifacts, e.g., `check`, `email`, `name`, `ping`, `time`, `site`, `start`) or $\le 2$ weak single-token hits.
- **UI triage ergonomics (`ServiceApp.jsx`):**
  - Display a signal badge (`High signal`, `Moderate`, `Low signal`) on each queue row alongside its validity chip.
  - Add a `Signal` filter (`All signals`, `High & moderate`, `High only`, `Low signal`) without hiding the underlying total count (`e.g., Showing 6 of 19 · 13 low-signal filtered`).
  - Add a `"Select visible low-signal"` quick-selection button in the batch bar so an authorized reviewer can inspect and batch-dismiss noisy suggestions using existing per-context `record_judgment` receipts (`ServiceContinuumProvider.jsx:submitBatchJudgments`).

### 4. Custom Workspace & Bounded Local Git Ingestion

- **Separation from Healthchecks (`local_repo.py` [NEW]):** Keep `acquisition.py` strictly locked to `HC-UPSTREAM-2026-11-13-P1` (`healthchecks/healthchecks`). Add `services/api/src/continuum/local_repo.py` for user-created workspaces under `inputs/custom/<repository_id>/<manifest_sha256>/`.
- **Two bounded input sources:**
  1. **Uploaded File Bundle (always available to authenticated users with workspace creation enabled):** Accepts `name`, `revisionLabel` (or deterministic commit-style SHA-1 derived or user-supplied), and up to `25` `.py`, `.md`, and `.txt` files (`<= 1 MiB` per file, `<= 4 MiB` total unique bytes, strict UTF-8, no NUL bytes, normalized relative POSIX path without `..` or absolute paths). Supports adding a subsequent revision bundle to the same custom repository so native Git comparison (`compare_revisions`) works immediately between custom revisions.
  2. **Local Git Directory Import (opt-in via `CONTINUUM_ALLOW_LOCAL_GIT=1` and `CONTINUUM_LOCAL_GIT_ROOTS` allowlist):** Uses `git rev-parse`, `git ls-tree`, and `git cat-file` with `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, and strict path containment—never checking out, executing hooks, or mutating the target repo—to extract up to 25 eligible `.py`/`.md`/`.txt` blobs across 1 to 4 selected commits.
- **Shared pipeline reuse (`pipeline.py`, `worker.py`, `graph_store.py`):** Custom workspaces synthesize a valid `manifest.json`, `acceptance.json`, and `discovery-profile.json` (`methodId: "lexical-file-v1"`, `scope: "file"`, raising `maximumPaths` for custom profiles to `25` while keeping `HC-LEXICAL-2026-11-13-P1` at `10`), register `InputRegistration` and `ProfileRegistration`, assign the creating account a `reviewer` `Grant`, and execute `capture_files` and `discover_candidates` through the exact same Redis/RQ + PostgreSQL worker and Neo4j projection.
- **UI flow (`ServiceApp.jsx`, `Shell.jsx`):** Add an `"Add workspace / revision"` modal accessible from the sidebar workspace switcher and `Team & governance`. Users can pick files/folders from disk (via `<input type="file" webkitdirectory>` filtered client-side to `.py`/`.md`/`.txt` within byte bounds) or enter a local repo path + commit SHA when enabled by the server.

## Risks / Trade-offs

- **Docling Markdown initialization latency:** `_DOCLING_MD_CONVERTER` initializes once at module import (`discovery.py:21`). Parsing on `GET /versions/{id}` is fast for $\le 1\text{ MiB}$ Markdown files, and should be safely guarded with a line-scan fallback if Docling throws on malformed Markdown, disclosing `fallbackUsed: true`.
- **Line alignment between Docling items and raw Markdown:** Docling's Markdown parser normalizes headings and text; exact line numbers must be matched sequentially against `document.text.splitlines()` (matching heading markers `# ...`, fenced blocks ```` ``` ````, and table delimiters) rather than relying solely on normalized text equality, so line anchors never shift.
- **Custom workspace security boundaries:** Allowing arbitrary filesystem paths in an HTTP endpoint risks path traversal outside authorized local projects. Mitigate by gating local Git path imports behind `CONTINUUM_ALLOW_LOCAL_GIT=1` + explicit `CONTINUUM_LOCAL_GIT_ROOTS` prefix containment (`contained()`), rejecting symlinks/submodules, while keeping browser-uploaded file bundles sandboxed inside `inputs/custom/` with strict path/UTF-8/size validation.
- **Batch judgment latency:** Keeping per-context `record_judgment` writes ensures every confirmation/rejection gets its own receipt and optimistic projection check; sequential HTTP calls over 25 items remain acceptable (< 2s locally) and preserve existing database invariants without introducing partial-failure ambiguity.

## Open Decisions

1. **Custom workspace creation permission:** Should every authenticated account in local/development deployments be permitted to create a new custom workspace (receiving `reviewer` on that newly created repository only, never gaining access to other existing repositories), or should it require an account-level `can_create_workspaces` flag set by `continuum.admin`? (Proposed default: allow authenticated accounts to create self-owned workspaces via `POST /api/v1/workspaces`, gated by `CONTINUUM_ALLOW_CUSTOM_WORKSPACES=1` enabled in local dev and fail-closed unless set).
2. **Maximum path cap for custom workspaces:** Proposed `25` `.py`/`.md`/`.txt` files per revision (`<= 4 MiB` unique bytes) vs `50` files. Keeping `25` keeps Neo4j projection, ELK graph layout, and lexical discovery fast and visually legible without breaking `1,000`-artifact access bounds.
