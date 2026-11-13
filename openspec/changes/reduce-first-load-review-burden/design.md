# Design

## Context

Read-only source inspection on 2026-11-14 found a heavily dirty working tree. Preserve it; re-read affected files before implementation. No runtime checks were performed for this plan.

Observed sources:
- `ServiceApp.jsx` has Workspace, comparison controls, required reason input and blank-looking history paragraphs. `serviceModel.js` rejects blank reasons before building judgment envelopes.
- `schemas.py` requires Note for every Judgment; `review.py` enforces transitions, exact context, evidence, projection/snapshot versions and receipts.
- `models.py` ReviewEvent.reason is non-nullable. `access.py` calls reason.casefold() and slices it. `cycle.py` exports raw reasons and completion records.
- `cycle.py` completion requires current active snapshot, settled capture/discovery, zero pending reviews and exact limitation acknowledgment. Open follow-ups are separate. `comparison.py` requires fully captured inventories, not completion of baseline review.
- `pipeline.py` builds snapshot coverage and comparison data; operation status is available through operation queries. Progress must survive reload rather than depend on the provider's in-memory admitted operations.

Research: `specs/manuscript-source.md` designates the highlighted PDF; its exact path is currently absent. The retained `outputs/manuscript-audit/requested-manuscript.txt`, PDF p. 84, §3.7.5(3), says practitioners confirm/reject/correct “with a reason”; appendix item 14 (lines around 4006) also asks about recording decision and reason. `backend-conformance.md` identifies that other source as 106 pages, SHA-256 531d260782300d8814ae9bca14c71c5406beae8b03c89720f4ec8accffb25eba, and expressly does not replace canonical designation. These are retained evidence, not a fresh reading of the unavailable PDF. Optional rationale is the user's proposed product exception to C-05a; manuscript alignment is unresolved, not established. Do not alter prior audit records or evaluation instruments silently.

## Goals / Non-Goals

Goals: truthful first-load guidance and fewer required inputs for ordinary initial decisions, retaining trust and exact history.

Non-goals: batch writes, semantic verification, new discovery scope, new UI language, acquisition, migration execution, deployment or measured practitioner outcomes.

## Decisions

### Progress is a projection of exact service facts

Add a bounded progress object to `read_workspace`, assembled server-side using the selected snapshot, its selection, operations and retained comparison/completion. Include snapshot ID/version, each step's state (`not_started`, `running`, `blocked`, `partial`, `ready`, `complete`, `unknown`), counts, blockers and available action identifiers. Keep historical facts bound to their snapshot high-water mark; never overlay today's processing success on old snapshots. Current processing failure may be shown separately and clearly as current. If historical processing provenance cannot be recovered, return unknown.

| Step | Service facts and action |
| --- | --- |
| Capture | Accepted inventory captured successfully for selected revision; disclose partial, failed, queued and unknown. Capture or inspect sources. |
| Discover | Published discovery outcome for exact inputs and frozen profile; distinguish completed execution with partial coverage from comprehensive discovery. Run discovery or inspect results. |
| Baseline review | Count effective reviewed and pending relationships, with confirmed/rejected separate. Complete only using current-version completion record; otherwise show eligibility and exact blockers, including limitation acknowledgment. Continue review or record completion. |
| Compare | Captured baseline and target inventories ready plus baseline selected means ready, even with pending reviews. Completed only when comparison is published. Compare revisions. |
| Revalidate | Published comparison exposes incoming stale/candidate counts, unresolved evidence and pending reviews. Zero affected is explicit; pending zero alone is not evidence that comparison ran. Inspect affected queue. |

The current step is the earliest unfinished applicable step; later independent actions stay visible. The main next action is enabled only by actual service eligibility and actor permissions. A comparison can be ready while baseline review remains incomplete. Refresh projection after operation publication, decisions, comparison, selection/snapshot switches and reload. Reset facts to the new context, preserving earlier completion records. Show unavailable service state as unknown/error, never a completed checklist.

Render a compact semantic ordered list in Workspace using current cards, chips and buttons, with textual status and inline blockers. Stack on mobile; no percentage or new design system. Copy: Git compares the captured revisions; only directly affected relationships enter incoming review. Historical and viewer contexts provide inspect actions only.

### Optional means absent, with bounded eligibility

Proposed API: ordinary initial candidate confirm/reject accepts omitted or null `reason`; whitespace-only input is normalized to null, while supplied nonblank text is preserved and retains existing bounds/NUL rejection. Eligibility must be checked from persisted context and initial selection provenance, not client decision alone. Incoming candidates, reconfirmation, retirement, correction, reversal and follow-up retain their existing reason/note rules. Document this narrow default explicitly; widening it needs a deliberate contract change.

Use nullable ReviewEvent.reason storage. Do not invent prose or store “No reason provided” as actor explanation. The database currently prevents null: prepare a backward-compatible nullable-column migration for separate authorization; do not execute it, reset data, or claim production readiness here. Existing reasons are untouched. Fresh isolated test schemas can exercise the new model. The rollout is blocked on migration authorization/application for an existing service database.

For reads, reason is text or null. History renders “No reason provided” for absent reasons. JSON exports retain `reason: null` plus an explicit `reasonStatus: not_provided` (provided for nonblank text), with documented display label “No reason provided”; never replace raw reason with that label. Make search null-safe and do not index the display label as reviewer rationale. Existing text remains searchable; tolerate legacy missing/null/blank values on reads without rewriting them. Retained exports remain immutable.

Preserve input envelope bytes and request IDs for uncertain retries; do not regenerate older persisted envelopes when normalization changes. Receipt fingerprinting continues using the original envelope. UI drafts keep text; payload construction alone normalizes absent text. Existing evidence inspection/acknowledgment, actor, time, sequence, assertion/evidence versions, authorization and concurrency checks remain mandatory.

### Batch review is deferred

Current writes bind one view/context/assertion revision and expected projection version. A shared checkbox cannot establish per-item evidence inspection. Safe batching needs per-item inspected evidence, independent authorization/concurrency/idempotency and explicit partial outcomes. Keep it as a separate proposed follow-up; no batch endpoint or selection UI in this change.

## Risks / Trade-offs

- Research conflict and unavailable designated manuscript block any claim of manuscript conformance; reconcile before changing rationale policy in implementation.
- Nullable schema rollout needs separate authorization. Do progress work independently; do not hide the storage blocker with a fabricated default reason.
- Snapshot provenance may need additive projection metadata; test reload and old snapshots rather than relying on current operation lists alone.
- Existing current specs are older observed evidence; only promote these deltas after verified implementation. Do not rewrite the prior change's C-05a history.
