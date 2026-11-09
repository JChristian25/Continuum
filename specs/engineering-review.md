# Engineering review of the frontend baseline

> Path note (2026-11-09): this review predates the repository restructure. Its `src/` and package paths refer to the original root-level frontend, now under `apps/web/`. Original hashes, commands and observed results below are retained as historical evidence.

Date: 2026-11-09. Target: the accepted continuity cycle in the current frontend. Proposed work in this round is documentation only. Implementation is not authorized. Runtime design and delivery estimates below remain proposals until reviewed.

## Scope and evidence

Only `D:\[Research] SKCF\prototype` was inspected. Relevant authored sources are `PRODUCT.md`, `DESIGN.md`, `package.json`, `src/main.jsx`, `src/App.jsx`, `src/context/ContinuumContext.jsx`, `src/data/state.js`, `src/data/workflow.js`, `src/data/workflow.test.js`, `src/data/helpers.js`, `src/components/Inspector.jsx` and `src/components/ReviewSummary.jsx`. A text search under `src` and package.json found no fetch, axios, XMLHttpRequest, WebSocket or React Router references. That is static evidence, not a browser network audit.

`node --test src/data/workflow.test.js` passed all five existing tests on 2026-11-09. They cover the initial pending count, historical/viewer/empty/unconfirmed-draft guards, candidate rejection, targeted undo and failed-save simulation/history. They do not exercise real browser storage failure, backend authorization or a real Git repository.

Content fingerprints, SHA-256:

| Source | Hash |
|---|---|
| `src/data/workflow.js` | `A579EC50FF0C57CC77A23A3945D1C0D997AD8333E001664580C953E07C7CF661` |
| `src/context/ContinuumContext.jsx` | `AFC596DD948B135456B07ADF4B38FC34547DDC2B1AC43D5E8BAE6451B051B3F5` |
| `src/components/Inspector.jsx` | `457E1D3750F2EBF2D8BBED1858BC26D5F5C90A3CD509DFADFD9BCCF2B918726C` |
| `src/data/state.js` | `4DFA506AC58B46EF2A886CDCE86DF7387AB70915CFBCF22110256F7E756720A8` |

The frontend's shell, conditional modules, inspector, command palette, revision labels and review journey provide the interaction baseline. `DESIGN.md` specifies warm paper surfaces, forest-green actions, DM Sans, Georgia headings, responsive navigation and reduced motion. Preserve those choices. Neither JSX nor package dependencies establish an existing application backend.

## Scope challenge

The smallest useful sequence retains the existing screens and introduces a data boundary behind their actions before adding a backend. An isolated fixture adapter can preserve the synthetic demonstration; a future service adapter supplies real, versioned records. The UI consumes the same read models in either mode and displays their provenance.

Keep one backend application as the proposed initial runtime. Git reading, lexical discovery, comparisons and review rules can be modules in that application. An asynchronous API operation does not by itself require Redis, a separate worker deployment or a graph database. A deployment or throughput requirement may justify those later. Backend stack and storage remain open; no particular framework is inherited from another project.

This is a proposed arrangement, not an approved technology choice or a code scaffold. First implementable slice should be narrowed to one accepted behavior before estimating changed files/classes. This documentation review creates no runtime classes or services. No PR count or implementation-time estimate is claimed.

## Architecture findings

| ID | Evidence and confidence | Required behavior / proposed remedy |
|---|---|---|
| E-01 | `workflow.js:3-8` fixes queue membership to fixture artifact IDs; `workflow.js:26-40` stores the review on the selected artifact. Verified static, 10/10. | The accepted model reviews an assertion revision in a context. A file can have several relationships and judgments. P-01: queue and inspector read models identify both artifact and assertion/context; selection of a file must not implicitly review all its links. |
| E-02 | `ContinuumContext.jsx:252-263` calls commitReview and reports saved; `state.js:465-468` catches storage errors without reporting them. Verified static, 10/10. | Acknowledgment must reflect durable save. P-02: persistence returns success or an explicit error; failure preserves the draft and saved projection. A simulated save error is not proof of this real persistence path. |
| E-03 | `workflow.js:44-46` restores the original artifact and removes an activity event. `ContinuumContext.jsx:289-304` separately reopens a review while retaining saved values. Verified static, 10/10. | The accepted durable history requires accountable corrections. P-03: distinguish unsaved cancellation, saved reversal and opening a draft; committed history cannot be removed. Review validity after reversal comes from the preceding unsuperseded decision. |
| E-04 | `ContinuumContext.jsx:366-370` creates a demo session and chooses a fixture persona; workflow.js:12 checks that persona. Verified static, 10/10. | Keep persona switching in demo mode. Future real writes require a trusted server actor and repository permission. No authorization follows from a client-supplied name or role. |

Proposed flow:

```text
Existing screens / inspector / summary
       | query and command inputs (artifact + assertion + context)
       v
Application data boundary
       |-- demo adapter --> fixture records + explicit local save result
       |-- service adapter --> future backend application
                                  |-- revision-pinned source reader
                                  |-- candidate discovery / comparison rules
                                  |-- review transaction + history
                                  '-- durable store (selection pending)
```

One owner writes the domain projection and events; UI components request actions. Do not copy the entire browser-state object into the future database schema. Keep UI state (open panels, selected module, draft text) separate from retained domain records.

## Code quality findings

| ID | Evidence and confidence | Required behavior / proposed remedy |
|---|---|---|
| E-05 | `workflow.js:39` stores events as actor/time/action/detail/rationale; `Inspector.jsx:483-502` displays the latest artifact fields and earlier reviewHistory. The baseline fixture uses rev/actor/date/status/rationale/excerpt, but `Inspector.jsx:511-520` reads time/action/detail. Verified static reads, 9/10; browser appearance unverified. | P-04: normalize both fixture and service data into one typed history view before rendering. Missing actor, date or rationale displays unavailable, never a fallback person's name. Compute history counts from the same event list rendered. |
| E-06 | `ContinuumContext.jsx:337-360` records intent with `category: 'Decisions'` and `r1Status: 'reviewed'`. Verified static, 10/10. | P-05: authoring a requirement/decision record is distinct from confirming its relationship to code. Capture record kind, immutable record version and source reference; create any linked assertion as candidate until separately reviewed. |
| E-07 | `ReviewSummary.jsx:19,23` exports fixed checkout repository and revision labels. Verified static, 10/10. | P-06: summary, queue, export and history share the selected context identity. Switching repositories or revisions must not export fixture labels as real-project evidence. |
| E-08 | `ContinuumContext.jsx:144-149` falls back to the first team member for an unknown activeUserId, while `workflow.js:12` rejects an unknown reviewer. Follow-up and intent commands use the former authorization path. Verified static, 10/10; runtime effects not exercised. | P-09: one fail-closed permission decision for every write. Unknown identity cannot inherit the first persona's authority. T-04 covers all affected commands. |

No shared-library extraction is proposed. Existing workflow selectors and view helpers are reuse candidates within this frontend, but their current fixture assumptions need explicit adapter tests. There is no reason to replace the UI library, renderer or styling to introduce a backend boundary.

## Test review

The detected test runner for existing workflow logic is Node's built-in `node:test`. Keep those five checks while moving domain behavior behind a contract. Add tests only when implementing the behavior they protect; do not write a mirror of this specification as if that proved a backend works.

```text
Review submission
  |-- historical / viewer / missing reason / unreadable evidence --> reject unchanged
  |-- stale projection ------------------------------------------> conflict + retained draft
  '-- valid request
       |-- persistence fails ------------------------------------> error + no saved acknowledgment
       '-- transaction commits event + projection + retry receipt --> saved result

Comparison
  |-- missing revision / unsupported source --> explicit incomplete or failed result
  |-- equal commits / unchanged endpoint and evidence --> no new review from this rule
  '-- endpoint/evidence changed
       |-- prior confirmed --> stale context; prior history retained
       '-- prior unconfirmed --> candidate context; never an old confirmation
```

The [acceptance plan](acceptance-plan.md) maps each branch to a meaningful regression. Needed UI cases include two links on one artifact, navigation during a save, duplicate submission, session expiry, retry after uncertain delivery, storage failure, missing historical fields and a new pending context after cycle completion. Fixture success cannot satisfy real-repository checks.

## Performance and operating bounds

No load benchmark was run, and no response-time claim is made. For the bounded first slice, avoid unbounded source reads or an all-pairs in-memory graph. Query file metadata first, fetch evidence on demand, paginate history and cache immutable blobs by repository/object identity. Cache permissions and view context separately so content reuse cannot leak inaccessible records.

P-07 proposes explicit configurable bounds: selected file count, bytes per blob, total captured bytes, candidate pairs per run, history page size and operation duration. Values remain pending until the real inventory and deployment are available. Exceeding a bound yields partial/unsupported with counts and reasons; truncation cannot appear complete. These are required operating-policy decisions before an integration run, not measured limits.

The discovery procedure in the contract is deterministic within its declared input inventory. A stable result is not evidence that candidate relationships are accurate. Broader accuracy/productivity claims remain outside these implementation checks.

## Delivery order

| Stage | Proposed deliverable | Exit evidence |
|---|---|---|
| 1 | Normalize fixture reads and isolate commands behind the frontend data boundary; keep design and workflow. | Existing five tests; two-links-per-artifact, failure and history presentation checks. |
| 2 | Establish exact artifact/version/assertion/evidence records and immutable source reads for approved real revisions. | Source identity and unavailable/unsupported-source tests. |
| 3 | Implement trusted review transactions, retry/conflict rules, initial review, history, correction and reversal. | Direct permission tests, atomic failure/retry/concurrency and historical retrieval checks. |
| 4 | Add lexical candidate discovery and selected-revision direct impact using approved inventory/rules. | Distinct automatic-discovery result, code-to-doc and doc-to-code cases, unchanged/unknown controls. |
| 5 | Connect service adapter to existing screens and freeze a reproducible demonstration. | Full acceptance plan on named build/configuration, design/keyboard checks and limitations record. |

A stage is not Done from files existing. Approval and observed verification are separate. Stop a slice at its acceptance boundary before dependent features begin. Backout of the first adapter slice can return the UI to demo mode; backout of later storage changes must preserve prior records and needs a reviewed migration plan before implementation.

## Review disposition

Observed: frontend inspection and five passing existing workflow tests. Proposed: P-01 through P-09 across this review and the continuity contract, the application boundary and future delivery sequence. Unverified: browser walkthrough, accessibility, build, live services, persistence under failure, real Git processing and deployment. Backend stack, authentication mechanism and operating bounds remain open. Current work stays in specs/: finalize schema examples, resolve review decisions and document a bounded first task. No adapter or backend is being implemented at this stage.

The current thesis basis remains the excerpts previously supplied in this conversation: §1.5 (PDF pp. 21-23) bounds the demonstration; §3.7.5 (pp. 83-85) requires version-specific evidence and retained decisions; §3.7.6 (pp. 85-86) requires verification and explicit limits. These sources were not reopened in this round. P-01 through P-09 are engineering proposals to meet the accepted behavior, not quotations from the thesis.

Supplementary source review independently identified E-01, E-02, E-03, E-05, E-07 and E-08 using only files inside the prototype. It made no changes and executed no code. Its agreement is source-review evidence, not a live test or a completed gstack quality gate.
