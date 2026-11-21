# Latest-manuscript reconciliation

Date: 2026-11-09. Source: MS-2026-11-09, identified in [the source record](manuscript-source.md). Status: scoped reconciliation of the committed core, specification method and demonstration-readiness obligations. All affected OpenSpec capabilities remain proposed and unimplemented.

## Review boundary

The only implementation source is this prototype. The explicitly supplied latest manuscript is the research reference. No sibling project or external checkout was inspected. The manuscript was read in place, not modified or copied into the project.

Relevant text was checked in §§1.2-1.7 (PDF pp. 14-27) and §§3.1-3.7.6 (PDF pp. 64-86). PDF page 22 was rendered and visually inspected to confirm the core format and repository boundaries. This is not an exhaustive literature/citation audit, questionnaire validation or visual review of all highlighted passages. It does not compare every earlier manuscript revision.

Source-derived obligations below cite this exact manuscript. Engineering mechanisms remain proposals unless separately accepted. Document procedures do not authorize implementation or participant-data collection.

## Reconciliation decisions

| ID | Checked obligation or distinction | Manuscript location | Specification disposition |
|---|---|---|---|
| M-01 | Core document formats include Markdown and plain text. | §1.5, PDF p. 22 | The earlier accepted initial slice named Python/Markdown. User explicitly selected inclusion of plain text in the proposed core during this reconciliation. Add C-02b and update scope/context. This is not a claim of implemented .txt support. |
| M-02 | Common typed representation covers code, documentation and captured requirements/decisions; representation is distinct from extraction. | §1.5 pp. 21-22; §1.7 pp. 25-27; §3.7.5(1), p. 83 | Add C-03c in the proposed knowledge-access capability, preserving file scope and the distinction between captured and analyzed records. |
| M-03 | Candidate discovery must establish inspectable typed proposals, not only display manually entered links. | §1.5 p. 21; §3.7.5(2), pp. 83-84 | Add C-04b with successful and insufficient-evidence scenarios. Keep algorithm choice open and separate automatic results from manual capture. |
| M-04 | Search and graph exploration are part of core knowledge access. | §1.5 p. 21; §3.7.5(6), p. 85 | Add knowledge-access C-08b/c/d. C-08 was already in the accepted parent register; the new delta closes missing observable requirements rather than replacing the UI. |
| M-05 | Reconfirmation, correction and retirement retain reason and version-specific history. | §1.7 p. 27; §3.7.5(3,5), pp. 84-85 | Add a direct retirement scenario to C-07e. Keep the exact reversal and successor-identity mechanism labeled engineering design. |
| M-06 | Provenance distinguishes versions, processing activities and responsible agents. | §1.7 p. 27; §3.7.1/Table 4, pp. 76-77 | Add inspectable processing provenance C-03d. RDF exchange is optional in Table 4 and is not a new core obligation. |
| M-07 | Readiness includes per-function support and a release record with dependencies and operating requirements. | §3.7.6, pp. 85-86 | Add the support-matrix scenario to C-02a and release-record C-09b. Neither a registered record nor a passed unit test establishes complete processing support. |
| M-08 | Requirements have identified source, rationale, priority, scope and acceptance; scope/feasibility decisions retain reasons. | §3.7.1/Table 4, pp. 76-77; §3.7.2, pp. 77-78 | Add per-core-requirement planning metadata to the background register. Mark priorities provisional, practitioner input unavailable and dependencies as engineering sequencing. |
| M-09 | Guided tasks use one documented starting state and cover artifact/revision, candidate review, change response, revalidation and earlier decisions. | §3.5, pp. 71-72; §3.7.6, pp. 85-86 | Add a specification-stage demonstration guide. No reset, repository ingestion, participant exposure or formal evaluation is executed. |
| M-10 | Listed frameworks, tools and formats form a proposed shortlist subject to verification. | §3.7.3/Table 5, pp. 79-80; §3.7.4, pp. 80-83 | Keep backend/storage choices open and preserve the observed React/Vite UI. The manuscript does not establish that Next.js, FastAPI, Redis/RQ, Docling or Neo4j are installed or mandate a UI replacement. |
| M-11 | Selected Git comparisons are core; extra repositories/event connectors, conversational assistance and role-specific/onboarding provisions are extensions. | §1.5 pp. 21-23; §3.7.4 pp. 81-82; §3.7.5 p. 85 | Retain X-01 through X-03 classifications and one selected repository/language. Python remains the user's selected demonstration language; additional language support is not inferred from Table 5. |
| M-12 | Assessment is perceived adequacy, with developmental verification separate from empirical accuracy/productivity claims. | §1.5 p. 23; §§3.1-3.3 pp. 64-68; §§3.5-3.6 pp. 71-76; §3.7.6 pp. 85-86 | No precision/recall benchmark, comparative time-saving claim, survey result or certification is added to the product requirements. Practitioner findings and empirical priority decisions remain unavailable. |

## Requirement-to-source index

This is a traceability index, not a second normative specification. The behavior is defined by the active OpenSpec delta files.

| Capability | Atomic requirement IDs | Source basis |
|---|---|---|
| artifact-context | C-01a/b/c | §1.5 pp. 21-22; §3.7.5(1), p. 83 |
| artifact-context | C-03a | §1.7 pp. 25-27; §3.7.5(2), pp. 83-84 |
| artifact-context | C-03d | §1.7 p. 27; §3.7.1/Table 4, pp. 76-77 |
| artifact-context | C-02a/b | §1.5 p. 22; §3.7.6 p. 86 |
| relationship-review | C-03b | §1.7 pp. 25-27; §3.7.5(2-3), pp. 83-84 |
| relationship-review | C-04a/b | §1.5 pp. 21-23; §3.7.5(2), pp. 83-84 |
| relationship-review | C-05a | §3.7.2 p. 78; §3.7.5(3), p. 84 |
| relationship-review | C-05b/c | Engineering reliability detail supporting the accepted accountable-review behavior; exact durability/retry mechanisms are study-defined. |
| relationship-review | C-07a/b | §1.7 p. 27; §3.7.5(3,5), pp. 84-85 supports retained correction/history. Replacement identity and latest-judgment reversal are engineering choices, not manuscript-prescribed states. |
| relationship-review | C-08a | §3.7.5(5-6), pp. 84-85 |
| relationship-review | C-10a | §1.7 pp. 25-27; §3.7.5(4-5), pp. 84-85 |
| revision-revalidation | C-06a/b | §1.5 p. 22; §1.7 p. 25; §3.7.5(4), p. 84 |
| revision-revalidation | C-07c/d/e | §1.7 p. 27; §3.7.5(3-5), pp. 84-85 |
| revision-revalidation | C-09a/b | §3.5 pp. 71-72; §3.7.6 pp. 85-86 |
| revision-revalidation | C-10b | Engineering snapshot/export detail supporting reproducibility and retained context; exact cycle-completion rules are not prescribed by the manuscript. |
| knowledge-access | C-03c | §1.5 pp. 21-22; §1.7 pp. 26-27; §3.7.4 p. 81 |
| knowledge-access | C-08b/c/d | §3.7.5(6), p. 85; §3.5 guided tasks, p. 72 |

## Remaining limits and decisions

The updated draft represents the checked source obligations; it is not proof that they are implemented or demonstrated. Final backend/storage/authentication, request/response schemas, discovery method, processing depth, operating bounds, immutable real-project inputs and expected outcomes remain open. The current frontend-demo main spec is unchanged.

Plain-text scope is resolved for the proposed core by the user's explicit answer. Future support still needs implementation and verification. Practitioner necessity/priority data are not supplied. Per-requirement planning priorities are provisional and cannot be presented as survey findings.

A supplementary read-only reviewer independently identified missing search/graph requirements, plain-text scope, positive discovery, retirement acceptance, release metadata and requirements-register metadata. Those findings informed this reconciliation; they are not a full gstack clearance or empirical validation. The exact source hash remains the source record's identity.

## Reconciliation checks

On 2026-11-09, OpenSpec 1.16.1 strict validation passed for both the proposed change and the existing frontend-demo specification (2/2 items, no reported issues). The proposed change contains four capability files, 29 requirements and 51 scenarios. Local Markdown links under `specs/` and `openspec/` resolved. The manuscript SHA-256 matched the registered source.

A supplementary delta review found the six identified gaps addressed and no new blocking contradiction within its checked scope. This is a documentary check, not full manuscript conformity, functional verification or complete gstack clearance. Application source, assets, dependency manifests and lockfiles were unchanged. No backend behavior, repository processing or research assessment was executed.

This reconciliation created `specs/manuscript-reconciliation.md`, `specs/demonstration-plan.md` and `openspec/changes/establish-versioned-continuity-core/specs/knowledge-access/spec.md`. It amended the proposal, design, review checklist, three existing capability deltas, requirements register, acceptance plan, manuscript source record, continuity contract, both specification indexes, OpenSpec configuration and project instructions. The continuity-contract amendment aligns its proposed lexical input inventory with the approved plain-text scope; it does not select or validate that algorithm.

## Implementation Reconciliation Addendum (2026-11-17): Reducing First-Load Review Burden & Preserving Workflow Substance

Following end-to-end engineering evaluation against Manuscript Sections §§1.4–1.5, §3.5, and §§3.7.3–3.7.6, the implemented system reconciles three practical divergences from early manuscript phrasing while strengthening underlying continuity guarantees:

1. **Lightweight initial candidate triage vs. early universal-review wording (`§3.7.5`):** Requiring practitioners to write formal justifications or click formal rejections for every low-signal discovery candidate on first import turned candidate discovery into administrative overhead and risked rubber-stamping. The implementation separates **`triage_candidate` (`defer`, `screen`, `restore`)** recorded via `ReviewEvent(type="triage")` from substantive **`record_judgment` (`confirm`, `reject`, `reconfirm`, `retire`)**. Initial candidates retain optional rationale plus explicit clickable rationale presets (never fabricated or auto-submitted), while change-triggered revalidation, correction, retirement, reversal, and record revisions strictly retain mandatory rationale.
2. **Per-item batch inspection and scoped completion (`§3.7.5(3–4)`, `§3.7.6`):** `BatchConfirmDialog` enforces individual evidence-inspection checkboxes synced with a master control so batch confirmation cannot claim uninspected verification. `complete_cycle` adds `scope="scoped"` (`completionScope: "scoped_review"`) whenever change-triggered `stale` reviews are `0`, allowing sign-off on active revisions while retaining and disclosing unconfirmed (`open`, `deferred`, `screened`) candidates across snapshots, audit reports, and JSON exports rather than forcing bulk dismissals.
3. **Technology and scope substitutions (`§3.7.3` Table 5):** As recorded in [architecture-reconciliation.md](architecture-reconciliation.md), React 19 + Vite (SPA) substitutes for Next.js SSR, PostgreSQL 17 provides ACID transaction/receipt authority alongside Neo4j 5 Community graph projections, Redis/RQ + FastAPI handle API and background workers, and Tree-sitter + Docling remain scoped to Python, Markdown, plain text, and authored records within bounded repository inventories rather than full multi-language runtime execution. Relevant manuscript passages in Chapter 3 (`§3.7.3`–`§3.7.5`) and Chapter 4 should reflect these verified boundaries.

## 106-Page Manuscript & Appendix 1 Alignment Update (2026-11-18)

Verification against the full **106-page** manuscript PDF supplied on 2026-11-17 (Chapters 1–3, References, and Appendix 1 Research Instruments on PDF pp. 95–106) and live release `continuity-core-41f8d388bea9d9a1e03f1ddd` identifies five concrete manuscript/documentation alignments to maintain across Chapter 3, Chapter 4, and participant demonstrations:

1. **Relationship state naming (`Appendix 1 Form A Key Terms`, PDF p. 95; Item 2.2 #10, PDF p. 98):** Form A summarizes four lifecycle terms (`proposed—awaiting review; confirmed—accepted through review; stale—needs review after a relevant change; retired—no longer treated as current`), whereas `§3.7.5` and the implemented UI/API use **`candidate`** (`≡ proposed`), **`confirmed`**, **`rejected`**, **`stale`**, and **`retired`**, alongside triage queue states (`open`, `deferred`, `screened`, `resolved`, `superseded`). Demonstration briefs map `candidate` explicitly to Form A's `proposed`.
2. **Relation-type core subset (`§1.7`, MS p. 28 / PDF p. 38):** Text mentions examples *"implements, verifies, depends on, explains, and supersedes where supported."* The implemented core fixes three typed directed relations: **`documents`** (document → code), **`implements`** (code → requirement), and **`motivates`** (decision → code), while assertion/record supersession is represented via `supersedes_revision_id` and `predecessor_context_id`. Additional relation names (`verifies`, `depends_on`) remain extension examples under Form B Item 14.
3. **Code-artifact revision retrieval (`Appendix 1 Form A Item 2.1 #5`, PDF p. 98):** Practitioners can switch captured revisions (`Selected revision`), run `Compare revisions`, inspect source diffs in `Inspector`, and read per-context revision `history`. A standalone file-level commit log inside `Code explorer` is not implemented; artifacts are inspected per selected revision/snapshot.
4. **Table 5 & Figure 7 exact technology parity (`PDF pp. 79–83`):** Beyond substituting React 19 + Vite (JavaScript) for Next.js/TypeScript/shadcn/ui and adding PostgreSQL 17 as ACID store beside Neo4j 5 Community, **LSP/SCIP**, **Django/FastAPI framework-aware analysis**, **JS/TS/HTML/CSS** AST parsing, **JSON/YAML/DOCX/PDF** file ingestion, **vector embeddings**, and **local/hosted LLMs** remain unimplemented and outside live service claims.
5. **SOP 3 Common Demonstration Evidence (`§3.5(7)`, PDF p. 72; `Appendix 1`, PDF p. 104):** Extensibility Items `13–16` and Feasibility Item `19` require walking every SOP 3 participant through a consistent pre-survey explanation of extension seams and operating setup. Concrete walkthrough examples anchored to the implemented codebase are documented in [GUIDED-TASKS.md](../services/api/GUIDED-TASKS.md).
