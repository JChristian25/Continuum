# Tasks

All tasks are proposed and unchecked. Artifact completeness is not implementation readiness. Progress work can proceed after implementation authorization; rationale rollout additionally requires the research reconciliation and existing-database migration gates below.

## 1. Readiness and contract record

- [ ] 1.1 Recheck working-tree status and affected source before edits; preserve concurrent changes and verify the final diff contains only authorized additions.
- [ ] 1.2 Record the rationale-policy decision against C-05a and manuscript §3.7.5 p. 84, explicitly retaining the conflict and unavailable canonical source; verify the decision does not claim manuscript conformance or modify earlier evidence. Reconcile the designated source with the user before changing rationale policy.
- [ ] 1.3 Document the nullable-column rollout and separate migration authorization prerequisite; verify no migration/reset runs against the user's database and existing reasons remain untouched. Optional-rationale runtime acceptance on an existing database stays blocked until authorized rollout.

## 2. Service progress (WP-01–03)

- [ ] 2.1 Add exact-snapshot progress projection in pipeline/workspace reads using operation, coverage, comparison and completion facts; add backend cases for empty/captured, queued/running/failed, partial/unknown, zero discoveries and reload. Verify API counts match retained records; document fields in FRONTEND.md/CONTINUITY.md.
- [ ] 2.2 Add cases for reviewed/rejected/pending counts, limitation acknowledgment, independent follow-ups, later snapshot invalidation, comparison with pending baseline reviews, zero affected results and incoming stale/candidate counts; verify historical snapshots never inherit current completion and viewer writes remain forbidden.
- [ ] 2.3 Render compact persistent Workspace steps with existing primitives; test current step, blockers, action eligibility, later available comparison and refresh after each state change. Verify desktop/mobile layout and screen-reader status labels; document progress semantics.

## 3. Optional rationale (IR-01–03; depends on 1.2)

- [ ] 3.1 Update nullable model and Judgment validation plus persisted initial-context eligibility in review.py; test omitted/null/blank/nonblank reasons, supplied-text preservation, bounds/NUL rejection and required exceptional reasons. Verify no production database alteration occurs.
- [ ] 3.2 Update history serialization, null-safe rationale search in access.py and cycle.py JSON export with reasonStatus; test mixed existing text/null/legacy blank data, search pagination/history boundaries, frozen exports and explicit absent presentation. Update API contract docs with request/response examples and schema compatibility decision.
- [ ] 3.3 Update serviceModel.js and ServiceApp.jsx to label eligible input “Reason (optional)”, preserve draft text, normalize only new payloads and show history absence. Test eligible confirmation/rejection, optional supplied text, exceptional actions, unreadable/unacknowledged evidence, viewer/historical reads and draft restoration.
- [ ] 3.4 Test uncertain-delivery retry with old and new persisted envelopes, request receipts, competing judgments and snapshot conflicts; verify exactly one outcome and unchanged drafts on failure. Document compatibility without rewriting retained receipts.

## 4. Integrated verification and release

- [ ] 4.1 Extend authenticated browser coverage using the existing isolated service-browser/test_frontend_browser harness and accepted retained package: capture, partial discovery disclosure, inspect/acknowledge evidence, reason-free initial confirm and reject, optional text, completion acknowledgment, target capture, comparison before/after finished reviews, incoming queue, history, search and export. Verify reload and read-only contexts; do not execute upstream Healthchecks or acquire source.
- [ ] 4.2 Inspect the running authenticated app at desktop and mobile widths, including long blockers, failed processing and reason-free history; retain screenshots and separate actual-service observations from mocked layout checks. Use isolated test schemas/accounts; never reset user data.
- [ ] 4.3 Run backend pytest through services/api/.venv/Scripts/python.exe, node --test apps/web/src/data/service.test.js apps/web/src/data/workflow.test.js, npm --prefix apps/web run lint, npm --prefix apps/web run build, and pinned OpenSpec strict validation; retain commands/results with automated, authenticated browser and live-service verification separately reported. Add new progress test files to the actual command.
- [ ] 4.4 After final source and checks, write verification evidence and generate the development release via the documented continuum.release command. Verify hashes, immutable archive, base commit and dirty-working-tree identity; report unperformed migration/deployment separately and make no practitioner-evaluation claim.

## Workflow follow-up

- Batch review needs a separate proposal for per-context evidence acknowledgment, authorization, optimistic versions, retry identity and individual partial outcomes.
- Promote verified behavior to current specs and archive only through a separately requested finalization workflow; preserve prior C-05a evidence and scope the new exception explicitly.
