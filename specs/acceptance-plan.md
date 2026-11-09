# Acceptance and implementation-test plan v0.2

Status: proposed checks, reconciled with MS-2026-11-09. Five pre-existing workflow tests passed in an earlier frontend inspection; no functional tests were run during this manuscript reconciliation. No new test suite, integration service or real-repository scenario was run.

## Mapping and execution layers

Retain foundation IDs C-01 through C-10 and HC-01 through HC-08, including HC-02D. Research obligations use MS-2026-11-09 and the rechecked thesis anchors: §3.7.2, PDF p. 78, and §§3.7.5-3.7.6, pp. 83-86. Exact checks below are engineering proposals and implementation readiness evidence, not research findings on recommendation accuracy or productivity.

| Check | Setup / action / required observation | Mapping | Execution layer |
|---|---|---|---|
| T-01 | Two assertions share one artifact. Review one; the other remains open, and its draft and history remain separate. | E-01, C-03/C-05, HC-03 | Domain + adapter + browser |
| T-02 | Initial review targets B0, then compare B0/B1. Historical B0 pane rejects writes; B1 cannot inherit an old confirmation. | C-07, HC-03/04 | Domain + API |
| T-03 | Available evidence confirms successfully. Blank reason, mismatched artifact version, unavailable anchor or cross-repository reference fails without mutation. | C-04/C-05, HC-02/03 | Domain + API |
| T-04 | Deny unknown/revoked actor for judgment, correction, reversal, intent capture, follow-up completion and cycle completion. Client persona cannot grant permission. | E-04, P-09, HC-03 | API + browser recovery |
| T-05 | Inject actual storage rejection into the adapter, then service transaction failure. Preserve draft/projection and show retry; no saved acknowledgment or ghost event. | E-02, HC-07 | Adapter + isolated storage |
| T-06 | Replay identical request/key; receive original event. Reuse key with different input conflicts. Retry after timeout preserves one event and one context. | HC-07 | API + isolated storage |
| T-07 | Two reviewers submit with the same expected version; one commits and one conflicts. Event/projection/receipt never diverge after a failed write. | C-05/C-07, HC-07 | Concurrent API/storage |
| T-08 | Normalize baseline fixture history and multiple incoming reviews. Display original rationale/source, accurate count and unavailable fields without an invented actor/time. | E-05, C-08, HC-06 | Adapter + browser |
| T-09 | Reverse latest judgment after a follow-up note. Keep the note and all prior events, recompute validity and reopen current completion if needed. Reversing older judgment conflicts. | E-03, C-07/C-10, HC-05/07 | Domain + API + browser |
| T-10 | Create requirement and decision records. Correct kind and source/version persist; link remains candidate until reviewed. | E-06, C-01/C-05 | Domain + API |
| T-11 | Evidence/version correction creates a new revision; endpoint/type correction creates replacement assertion. Earlier decision and exact source remain retrievable. | C-07/C-08, HC-05/06 | Domain + storage |
| T-12 | Export selected context after navigating between contexts. Repository/revisions, progress and decisions match the chosen snapshot. A new cycle cannot inherit prior completion. | E-07, C-09/C-10, HC-08 | Adapter + browser |
| T-13 | For frozen real inputs, automatic discovery reports its own expected typed pair, method and exact-version evidence. Manual capture cannot convert an automatic miss into a pass. | P-08, C-03/C-04, HC-02D | Git reader + discovery |
| T-14 | Change either endpoint in a registered document/code relation. One direct review context contains exact trigger/path/reason. Unconfirmed changes remain candidates; confirmed ones become stale. | C-06/C-07, HC-04/08 | Domain + real Git inputs |
| T-15 | Equal commits, unchanged disconnected control, missing parent, unsupported format/encoding, deletion and ambiguous rename each produce their declared outcome. Incomplete processing cannot claim no impact. | C-02/C-06, HC-01/08 | Git reader + domain |
| T-16 | Restart service and reopen earlier/current versions, decisions and limitations. Source unavailable after restart is reported; current content is never substituted. | C-08/C-09, HC-06 | Isolated integration |
| T-17 | Use keyboard to select queue item, inspect evidence/history, submit, recover from conflict and return to queue. Preserve focus, existing layout, responsive access and reduced motion. | C-08, frontend DESIGN.md | Browser + manual visual check |
| T-18 | Reach each approved inventory/byte/candidate/time bound. Exceed it and observe partial/failed scope plus counts and reason, without silently dropping supported work. | P-07, C-02/C-09 | Domain + integration |
| T-19 | Find a supported artifact by search and open its exact source/version. No-match and incomplete scope remain distinguishable. | C-08b/d; G-01 | API/read model + browser |
| T-20 | Inspect the common typed graph, follow a directed assertion to evidence/rationale and distinguish candidate, confirmed, historical and represented-only records. | C-03c, C-08c/d; G-01/G-04 | Read model + browser |
| T-21 | Retire an incoming relationship with an authorized reason. Current confirmed support ends; earlier confirmation/evidence remain retrievable. | C-07e; HC-05 | Domain + API + history |
| T-22 | Inspect a release record with version/configuration, language/formats, dependencies, operating requirements and per-function support. Unverified support is not marked implemented. | C-02a, C-09b; G-01 to G-04 | Release/readiness inspection |
| T-23 | Inspect evidence provenance and identify its source versions, producing activity/method and responsible agent. Provenance is not displayed as semantic proof. | C-03d | Domain + API/read model |
| T-24 | Capture a supported plain-text document, inspect revision-pinned content/evidence and process a prepared change under the declared support policy. | C-02b, C-06a/b | Git reader + processing |
| T-25 | Automatic discovery produces its expected candidate on a frozen qualifying example; insufficient evidence returns the declared no-match/unknown result. Manual capture stays separate. | C-04a/b; HC-02D | Discovery + API/read model |

Future tests must assert behavior through the relevant command or UI action and observe domain state/storage. Merely comparing strings or replaying a hand-authored expected event list cannot prove implementation. Fixture adapters test presentation; service/storage checks test actual durability and permission enforcement.

## Real-project evidence freeze

Healthchecks is accepted as the test-project identity. Before T-13 through T-16, record an authorized acquisition source, exact repository identity and commit pair, all selected file paths/blob IDs, processing configuration, expected outputs and limitations. Establish expectations independently of the candidate engine's output. This specification does not establish an accessible local checkout or claim that integration execution has occurred.

Include a code-origin change, documentation-origin change and unrelated/unknown boundary. If either proposed scenario is unsuitable, record why and select another real case within the accepted project scope. No fictional `createRequest()` record or fixture revision may be relabeled as a Healthchecks fact. Researcher-authored requirement/decision records must disclose their authorship.

Reset replays an explicitly named isolated test dataset. It must not reset a user's working repository or erase demonstration decisions without a separately authorized action. Keep build, configuration and scenario identity on every result.

## Future first slice and checkpoints

After the specification stage is completed and implementation is separately authorized, a proposed first slice is a frontend data boundary and normalized fixture read models, preserving existing CSS/layout and retaining synthetic labels. Its acceptance subset is T-01, T-05 at adapter scope, T-08, T-12 and T-17, plus the existing workflow tests. This does not count as real-repository integration or backend completion. Current work defines that task on paper only.

Before that slice is implemented, review P-01 through P-06 and agree the exact changed files. A future backend slice also needs stack/storage/authentication decisions and a concrete transaction test plan. Before an integration run, settle P-07 bounds, P-08 discovery and authorized source acquisition. Approve deployment separately when there is an actual runnable release to review.

## Release evidence record

For every check record ID, requirement IDs, source snapshot/build, configuration, input identity, command or UI steps, observed outcome, pass/fail/blocked status, evidence location and limitations. A skipped or unavailable check is never marked passed. Only claim the scope actually observed. Guided practitioner assessment remains distinct from these implementation checks.

## Manuscript-derived demonstration trace

Use demonstration-plan.md for the four guided tasks and common-starting-state requirements in MS-2026-11-09, §3.5 (PDF pp. 71-72). Link G-01 to T-19/20, G-02 to T-01/03/04/13/25, G-03 to T-14/15 and G-04 to T-02/11/16/21. This is a planned mapping, not task-completion evidence.

The release/readiness check includes software version, configuration, selected language/formats, dependencies, operating requirements, support by function and known limitations (§3.7.6, pp. 85-86). Plain text is now explicitly included in the proposed core by user decision. Actual support and real-project inputs remain unverified.
