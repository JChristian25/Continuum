# Guided continuity tasks: development rehearsal

These steps rehearse the manuscript's guided continuity workflow using the
accepted Healthchecks package and frozen profile. They are not participant
instructions, collected responses or study findings. The manuscript source and
checked anchors are recorded in `outputs/manuscript-audit/backend-conformance.md`.

Use a synthetic reviewer and generated test schema for automated rehearsal. The
existing local operator account may inspect the same features, but the automated
commands below never clear its data or install research judgments.

| Task | Action | Inspectable result |
| --- | --- | --- |
| G-01 | Capture/discover an accepted initial revision and inspect a candidate's exact endpoints and evidence. | Snapshot, input/profile identity, assertion revision, source and evidence version references. |
| G-02 | Record a reasoned baseline judgment. Submit the identical envelope again. | One effective decision and retained receipt; retry does not create another judgment. |
| G-03 | Compare the captured baseline with another accepted revision. | Native Git changed-path metadata, separate incoming selection, directly affected confirmed claims marked stale, candidates kept unconfirmed. |
| G-04 | Inspect the earlier read-only reason and evidence, then review incoming evidence and reconfirm or retire with a new reason. | Earlier exact source/decision retained; new decision bound to incoming context; unresolved anchors cannot be confirmed by substitution. |

Automated rehearsal:

```powershell
& services/api/.venv/Scripts/python.exe -m pytest services/api/tests/test_continuity.py -k guided -q
```

The test writes `outputs/continuity-completion/guided-task-result.json` only after
its assertions pass. It reports the actual accepted revisions, snapshot/assertion
identities, Git version and incoming decision. Its reason strings expressly label
the activity synthetic. The broader suite separately covers missing endpoints,
deletion/addition without rename inference, comparison chaining, terminal
decisions, concurrent writes, record revisions and independent follow-up work.

The authenticated browser rehearsal additionally covers login, review drafts,
response-loss retry, authored requirement capture, a manual typed link, a record
revision, prior evidence inspection, server content search, graph navigation,
per-item batch inspection checkboxes, lightweight candidate triage (`defer`,
`screen`, `restore`), scoped completion (`scoped_review`), viewer restrictions and
logout. Its observed result is under `outputs/frontend-integration/browser-result.json`.

## Bridging note for Appendix 1 vocabulary and triage (§1.7, Appendix 1 Form A)

- **State labels:** Appendix 1 Form A Key Terms (PDF p. 95) refer to unreviewed relationships as **`proposed`**; Continuum labels them **`candidate`** (matching §3.7.5) and adds queue-organization dispositions (`open`, `deferred`, `screened`) via `triage_candidate` without falsifying a formal `rejected` judgment.
- **Typed relations:** Core build implements **`documents`**, **`implements`**, and **`motivates`**. Version supersession is stored structurally (`supersedes_revision_id`, `predecessor_context_id`).

## Common Demonstration Evidence brief (Appendix 1 Items 13–16 & Item 19; §3.5(7))

Before administering Form B (`SOP 3`), walk participants through the implemented extension seams and disclosed operating setup below so every respondent receives the same evidence (§3.5(7), PDF p. 72; Common Demonstration Evidence, PDF p. 104). Distinguish **working baseline behavior** from **documented extension hooks**; do not present extension examples as working features unless implemented.

| Form B Item | Extension / Disclosure Topic | Implemented Anchor & Walkthrough Explanation | Working vs. Extension Boundary |
| --- | --- | --- | --- |
| **Item 13** | Additional project record type (e.g., incident note or test plan) | `Artifact.kind` (`continuum/models.py`) and `CaptureRecord.kind` (`continuum/pipeline_schemas.py`) carry a string kind verified at capture time; `capture_record` (`continuum/capture.py`) stores content, `contentDigest`, optional `ArtifactSource`/`ExternalSource` anchors, and `ReviewContext` projections uniformly without changing review, comparison, or history logic. | **Working:** `requirement`, `decision` records plus `.py`, `.md`, `.txt` files. **Extension addition:** adding a new `kind` literal in `CaptureRecord.kind`, UI form selector, and optional extractor. |
| **Item 14** | Additional relationship type (e.g., `verifies` or `depends_on`) | `RelationType` and `RELATIONS` in `continuum/relations.py` validate `(type, source.kind, target.kind)`, and `REL_TYPE_MAP` in `continuum/graph_store.py` maps relation types to Neo4j edges (`:DOCUMENTS`, `:IMPLEMENTS`, `:MOTIVATES`). The state machine (`candidate`, `confirmed`, `rejected`, `stale`, `retired`) and revision revalidation operate identically for any relation in `RELATIONS`. | **Working:** `documents` (`document` → `code`), `implements` (`code` → `requirement`), `motivates` (`decision` → `code`). **Extension addition:** registering a new entry in `RELATIONS`, `RelationType`, `REL_TYPE_MAP`, and UI hints. |
| **Item 15** | Different repository arrangement | `Selection` and repository/inventory/profile manifests (`continuum/acquisition.py`, `continuum/local_repo.py`) separate snapshot/review pipelines from where accepted file bytes originate. Core pipelines accept any inventory resolving bounded UTF-8 blobs and commit references cleanly into `ArtifactVersion` + `git diff --no-index --no-renames`. | **Working:** bounded `healthchecks/healthchecks` package plus opt-in single-repository custom `.py`/`.md`/`.txt` bundles (`CONTINUUM_ALLOW_CUSTOM_WORKSPACES=1`) and allowlisted local Git roots (`CONTINUUM_ALLOW_LOCAL_GIT=1`). **Extension addition (`X-01`):** multi-repository linking across separate repos or automated PR/push webhooks. |
| **Item 16** | Additional knowledge-access function | Read-only retrieval queries in `continuum/main.py` (`search_records`, `read_graph`, `read_workspace`, `export_snapshot`) consume committed `Snapshot` documents, `ReviewEvent` history, and Neo4j projections without modifying transactional state. A new query or view consumes those same version-pinned IDs and high-water sequence bounds. | **Working:** Unicode literal search, Neo4j Cypher 1-hop typed neighborhood traversal, Markdown/print-PDF/JSON audit export. **Extension addition (`X-02`):** vector similarity indexing or grounded LLM assistant restricted to retrieved evidence with explicit uncertainty. |
| **Item 19** | Disclosed setup, dependencies & operating requirements | Recorded in `services/api/RELEASE.json` (`continuity-core-41f8d388bea9d9a1e03f1ddd`) and `specs/architecture-reconciliation.md`: Python 3.12+ (`FastAPI`, `SQLAlchemy`, `psycopg`, `tree-sitter-python`, `docling`), PostgreSQL 17, Redis 7 + RQ worker, Neo4j 5 Community, Native Git on `PATH`, Node/npm React 19 + Vite UI, bounded inventory limits (`<= 25` custom files / `<= 4 MiB`), and operator-provisioned sessions. | Local loopback HTTP development profile only (`http://localhost:5173` → `http://127.0.0.1:8787`); production HTTPS deployment and live DB migration remain separate authorized tasks. |

Before a practitioner study, freeze the intended release and study configuration,
approve the actual participant procedure and collection instruments, and collect
results through that procedure. Development checks supply readiness evidence;
they do not supply participant scores, usability ratings or semantic ground truth.
