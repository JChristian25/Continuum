# Tasks

All implementation and verification tasks below are marked based on observed file edits and verified checks. Completion of development tasks does not represent production deployment, live operator DB migration, or practitioner user evaluation.

## 1. Structural AST & Docling Extraction (`SE-01`–`SE-03`)

- [x] 1.1 Add `extract_python_symbols(text)` in `services/api/src/continuum/discovery.py` using `tree_sitter` (`tree_sitter_python`) to extract `class`, `function`, and `method` spans with qualified names, signatures, and exact 1-based line bounds without altering `code_index()` or frozen `P-08` outputs.
- [x] 1.2 Add `extract_markdown_sections(document)` in `services/api/src/continuum/discovery.py` using `docling` (`DocumentConverter`) aligned to exact 1-based lines in raw Markdown, with safe fallback for malformed Markdown and empty outline for `.txt`/authored records.
- [x] 1.3 Extend `GET /api/v1/repositories/{repository_id}/versions/{version_id}` in `services/api/src/continuum/main.py` with additive `structure` metadata (`{engine, hasError, items}`) while keeping `content` and `contentDigest` verification untouched.
- [x] 1.4 Project `symbolCount`, `sectionCount`, and `structureEngine` onto `:ContinuumArtifact` nodes in `services/api/src/continuum/graph_store.py` and verify Cypher read-back in `test_stack_technologies.py`.
- [x] 1.5 Render clickable symbol/section outlines in Code Explorer (`Files`) and enclosing symbol/section labels on evidence cards in `Inspector` (`ServiceApp.jsx`). Add unit and integration tests for `SE-01`–`SE-03` including syntax-error Python fallback and plain-text handling.

## 2. Interactive Evidence Anchoring & Unified Intent Capture (`IA-01`–`IA-03`)

- [x] 2.1 Build a reusable `SourceLinePicker` component in `apps/web/src/components/` supporting full line-numbered source loading via `ctx.api.version()`, clickable symbol/section range chips, and click / Shift-click line-range selection synchronized with numeric inputs.
- [x] 2.2 Upgrade `RecordDialog` in `ServiceApp.jsx` to support Artifact Anchor (`ArtifactSource`), External Reference (`ExternalSource`), and No Source (`sourceAbsenceReason`), plus optional follow-on unconfirmed candidate linking (`motivates` or `implements`) after `capture_record` succeeds.
- [x] 2.3 Replace manual line inputs in `RelationshipEditor` (`ServiceTools.jsx`) for `Add a relationship`, `Correct this relationship`, and `Propose an unconfirmed successor` with `SourceLinePicker`, and add direct `"Anchor & link"` / `"Record intent for lines"` actions in Code Explorer (`Files`).
- [x] 2.4 Add frontend unit tests (`apps/web/src/data/service.test.js`) and authenticated browser Playwright checks (`services/api/tests/test_frontend_browser.py`) verifying `IA-01`–`IA-03`, including draft preservation, sequential `capture_record` + `capture_candidate` execution in `submitRecordIntent`, and read-only enforcement for viewers/historical snapshots.

## 3. Signal-Tiered Discovery & Noise Triage (`ST-01`–`ST-03`)

- [x] 3.1 Implement `classifyCandidateSignal(row, allRows)` in `apps/web/src/data/evidenceSignal.js` (paired with backend `signalMeta` in `services/api/src/continuum/pipeline.py`) to classify relationships into `high`, `moderate`, and `low` signal tiers based on origin/type, path/stem mentions, and corpus rarity/frequency of shared tokens.
- [x] 3.2 Add Signal Tier badges, a Signal filter (`All signals`, `High & moderate`, `High only`, `Low signal only`), filtered/total counts, and `"Select low-signal"` batch selection in `Relationships` (`ServiceApp.jsx`), keeping existing per-context `record_judgment` receipts and frozen `P-08` backend snapshots intact.
- [x] 3.3 Add unit tests in `apps/web/src/data/service.test.js` verifying `ST-01`–`ST-03` on the Healthchecks-style token patterns, ensuring manual links always classify as `high` and completion gates still reflect all open candidates regardless of active filters.

## 4. Custom Workspace & Bounded Local Git Ingestion (`CW-01`–`CW-03`)

- [x] 4.1 Create `services/api/src/continuum/local_repo.py` implementing bounded custom file-bundle validation (`.py`/`.md`/`.txt`, `<= 25` paths, `<= 1 MiB` per file, `<= 4 MiB` total, strict UTF-8, path containment) and opt-in local Git commit/blob inspection (`CONTINUUM_ALLOW_LOCAL_GIT=1` + `CONTINUUM_LOCAL_GIT_ROOTS`, `GIT_CONFIG_NOSYSTEM=1`, no checkout/hooks).
- [x] 4.2 Add workspace registration/revision-addition routes in `services/api/src/continuum/main.py` (gated by `CONTINUUM_ALLOW_CUSTOM_WORKSPACES=1`), updating `pipeline.py` (`registered_inputs` / `make_snapshot`) to support custom workspace manifests under `inputs/custom/` without breaking `acquisition.py` or Healthchecks verification.
- [x] 4.3 Add `CustomWorkspaceModal` (`"Import or create workspace"` and `"Add revision to ..."`) in `apps/web/src/components/CustomWorkspaceModal.jsx` (supporting folder/file picking, inline authoring, and optional local Git import), and hook workspace switching cleanly in `ServiceContinuumProvider.jsx`.
- [x] 4.4 Add backend tests (`services/api/tests/test_custom_workspace.py`) and browser verification covering `CW-01`–`CW-03`: bundle creation, multi-revision comparison via native Git, path-traversal/symlink/size/non-UTF-8 rejection, cross-user grant isolation (user B cannot read user A's custom workspace), and preservation of the Healthchecks baseline.

## 5. End-to-End Verification & OpenSpec Reconciliation

- [x] 5.1 Run full backend suite (`services/api/.venv/Scripts/python.exe -m pytest services/api/tests -q`), frontend unit tests (`node --test apps/web/src/data/service.test.js apps/web/src/data/workflow.test.js`), lint (`npm --prefix apps/web run lint`), production build (`npm --prefix apps/web run build`), and `openspec validate --all --strict`.
- [x] 5.2 Inspect desktop and mobile screenshots of the updated Workspace, Code Explorer outline, `Inspector`, and signal filters (`signal-triage.png`, `custom-workspace-ast.png`, `custom-inspector-ast.png`, `workspace-mobile.png`, `change-impact-graph.png`), confirming `DESIGN.md` visual preservation.
- [x] 5.3 Update `services/api/CONTINUITY.md`, `services/api/FRONTEND.md`, `specs/architecture-reconciliation.md`, and regenerate `RELEASE.json` after all tests pass.
