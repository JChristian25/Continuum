# Scope, requirements and decisions

Version 0.2.2. Date: 2026-11-09. Status: accepted product scope with proposed engineering details. Current work is specifications only.

## Product and boundary

Continuum helps a reviewer inspect supported software artifacts, the evidence behind proposed relationships, and decisions that need reassessment after a revision change. The retained history should explain what was reviewed, against which versions, by whom and why.

The implementation baseline is the frontend in this repository: React/Vite, synthetic artifacts, local/session browser storage and an interactive review journey. A rendered parser, service, graph or score label does not establish that the corresponding backend exists.

Accepted demonstration direction: one real project, Healthchecks, with Python at file scope and Markdown/plain-text document inputs. Plain text was explicitly added by the user during the latest-manuscript reconciliation. Structured requirements and decisions are captured records. Additional languages, formats, repositories, assistants and connectors remain extensions. The existing visual design is preserved.

The thesis anchors below refer to the latest source MS-2026-11-09 in manuscript-source.md and use PDF page numbers, not printed page numbers. The scoped check and limits are in manuscript-reconciliation.md. Source-derived scope does not select an implementation framework or prove a capability works. Practitioner necessity ratings have not been supplied; this is an initial requirements register, not their findings.

## Requirements register

| ID | Class | Requirement | Thesis anchor | Acceptance |
|---|---|---|---|---|
| C-01 | Core | Capture supported artifacts and structured requirement/decision records with identity, type, source, exact version and available authorship. | Chapter 1-3, §1.5 pp. 21-22; §3.7.5 p. 83 | T-10, T-15, T-16 |
| C-02 | Core | Report ingestion, extraction, evidence and change support separately; preserve unsupported, partial and unknown results. | §1.5 p. 22; §3.7.6 p. 86 | T-03, T-15, T-18 |
| C-03 | Core | Represent typed directed assertions separately from artifacts and retain version-specific evidence and discovery provenance. | §1.7 pp. 25-27; §3.7.5 pp. 83-84 | T-01, T-03, T-13 |
| C-04 | Core | Keep candidates unconfirmed until human review; show missing evidence and processing limitations. | §1.5 p. 21; §3.7.5 pp. 83-84 | T-03, T-13 |
| C-05 | Core | Require authorized decisions with a reason, accountable actor and exact reviewed context. | §1.5 p. 21; §3.7.5 p. 84 | T-02, T-03, T-04, T-05, T-06, T-07 |
| C-06 | Core | Compare selected Git revisions and surface justified candidate inspection from either endpoint under documented relation semantics. | §1.5 p. 22; §1.7 p. 25; §3.7.5 p. 84 | T-13, T-14, T-15 |
| C-07 | Core | Trigger reassessment for relevant supported changes and retain earlier assertions, evidence and decisions. | §1.7 p. 27; §3.7.5 pp. 84-85 | T-02, T-09, T-11, T-14 |
| C-08 | Core | Retrieve current and historical context, evidence and rationale through search and graph inspection. | §1.5 p. 21; §3.7.5 p. 85 | T-08, T-11, T-16, T-17 |
| C-09 | Core | Record a fixed demonstration build, project/revisions, supported inventory, configuration, reset procedure and limitations. | §1.5 p. 22; §3.7.6 pp. 85-86 | T-12, T-15, T-16, T-18 |
| C-10 | Core | Keep relationship judgment, possible content issues and follow-up work distinct. A review candidate does not itself prescribe an edit. | §1.7 pp. 25-27; §3.7.5 p. 84 | T-09, T-12, T-14 |
| X-01 | Extension | Additional repositories, connectors and push/PR event integrations. | §1.5 p. 22; §3.7.4 pp. 81-82 | Separate future spec |
| X-02 | Extension | Conversational assistance grounded in identifiable sources and revisions, with visible uncertainty. | §1.5 pp. 22-23; §3.7.5 p. 85 | Separate future spec |
| X-03 | Extension | Additional languages/formats, role-specific views and automated onboarding. | §1.5 pp. 21-22; §3.7.5 p. 85 | Separate future spec |

The adequacy study and implementation checks remain distinct. The thesis does not establish independent recommendation accuracy, productivity improvements or long-term retention from this demonstration (§1.5 p. 23; §3.7.6 pp. 85-86).

## Decision register

| ID | Status | Decision or proposal | Reason / dependency |
|---|---|---|---|
| D-01 | Accepted | This prototype is the sole implementation source of truth. Work in the current stage is specs only. | User instruction and clarification. |
| D-02 | Accepted | Preserve the current visual design and use its review journey as the interaction reference. | User instruction; PRODUCT.md and DESIGN.md. |
| D-03 | Accepted | Use Healthchecks as the real test-project identity, Python at file scope, and Markdown/plain-text documents. Plain text was explicitly approved in the reconciliation. | User accepted the reviewed baseline. Exact executable integration inputs are not frozen. |
| D-04 | Accepted behavioral direction | Reviews bind to exact assertion/evidence versions; earlier decisions remain historical; follow-up is independent. | Accepted continuity-cycle draft and C-03/C-05/C-07/C-10. |
| P-01 | Proposed | Introduce a frontend data boundary with separate demo/service adapters and assertion-specific queue items. | Avoid making fixture-shaped browser state the backend schema. |
| P-02 | Proposed | Save acknowledgment follows a successful persistence result; preserve drafts on failure. | Existing storage failures are suppressed. |
| P-03 | Proposed | Reverse committed judgments with accountable events; retain unrelated activity. | Existing local undo has different semantics from durable history. |
| P-04 | Proposed | Normalize historical records into one lossless view model and derive rendered counts from it. | Fixture history and inspector fields differ. |
| P-05 | Proposed | Capture authored records separately from confirming linked assertions. | Authorship alone does not validate a relationship. |
| P-06 | Proposed | Derive summary, export and completion from the selected context snapshot. | Current summary uses fixed fixture labels and one completion timestamp. |
| P-07 | Open policy | Declare file/byte/candidate/page/time limits and explicit incomplete outcomes. | Values depend on approved inventory and deployment. |
| P-08 | Proposed | Deterministic lexical discovery with inspectable matches and separate co-change evidence. | First discovery rule is specified in continuity-contract.md; no measured quality claimed. |
| P-09 | Proposed | One fail-closed permission decision for every write; reviewer/viewer roles for the bounded demonstration. | Current commands do not all handle unknown personas alike; authentication remains open. |
| A-STACK | Open | Backend language/framework and storage. | Select through architecture review; no installed backend is assumed. |
| A-AUTH | Open | Trusted identity/session mechanism and repository permissions. | Needed before real review commands can be implemented. |
| A-INPUT | Open | Authorized real-source acquisition, immutable revision pair, inventory and expected outcomes. | Needed before integration execution. |

## Specification completion checklist

The earlier continuity-cycle acceptance IDs remain stable:

| ID | Intended acceptance outcome |
|---|---|
| HC-01 | Real revision identities, source inventory and missing-history behavior are reproducible. |
| HC-02 | Evidence and manual capture preserve exact version context without future-revision leakage. |
| HC-02D | Automatic discovery has its own result and cannot pass through manual substitution. |
| HC-03 | Initial review and historical access have distinct write rules; authorized decisions retain reasons and exact context. |
| HC-04 | A supported change requests reassessment without inheriting old confirmation. |
| HC-05 | Review, correction, retirement and reversal obey declared transitions; follow-up remains separate. |
| HC-06 | Earlier/current source and decisions remain retrievable after service restart. |
| HC-07 | Retries, concurrency and failures preserve atomic history and projections. |
| HC-08 | Documentation-origin changes and unchanged/unknown controls have explicit outcomes. |

These are planned outcomes, not passed scenarios. T-01 through T-18 refine them into implementation checks.

### Remaining specification work

1. Reconcile every state transition and command with the accepted cycle and its error cases.
2. Review proposed P-01 through P-09 without treating them as implemented or silently approved.
3. Resolve stack, storage, authentication and source-input decisions at the appropriate implementation boundary.
4. Define exact request/response schemas and test fixtures for the first selected slice.
5. Link requirements to planned checks and a demonstration guide; record every remaining unsupported case.
6. Approve the bounded implementation task only after its specification is complete. Until then, continue documentation work.

## Per-requirement planning metadata

The fields below address the identified requirement/source/rationale/priority record in MS-2026-11-09, §3.7.1/Table 4 (PDF pp. 76-77) and §3.7.2 (pp. 77-78). Concern mappings and sequencing are provisional engineering interpretations of §1.4's categories (PDF p. 20), not practitioner findings. Every C- requirement remains required for the full committed core; a later sequence number does not make it optional.

Practitioner concern/necessity input: unavailable for every row. Do not infer ratings, sample results or empirically validated priorities. The thesis calls for ratings to inform selection alongside scope, feasibility and dependencies (§3.5, PDF p. 71).

| ID | Rationale | Provisional concern mapping | Provisional sequence / dependency | Decision/feasibility status |
|---|---|---|---|---|
| C-01 | A reviewer needs identifiable source records before assessing a link. | Discoverability; version context | 1: capture and identity | Accepted core; exact schema open. |
| C-02 | Registered records must not hide unsupported processing or unknown coverage. | Currency/version context; traceability | 1: support profile with capture | Accepted core; limits/processing depth open. |
| C-03 | A file may participate in multiple distinct typed claims with separate evidence. | Traceability; retained rationale | 2: after C-01 | Accepted core; typed schema and provenance mechanisms proposed. |
| C-04 | Evidence-based proposals need inspection before they become retained judgments. | Traceability; governance | 2: after C-01/C-02/C-03 | Accepted core; discovery method open. |
| C-05 | Reasons and accountable actors make decisions interpretable later. | Rationale/governance | 3: after C-03/C-04 | Accepted core; identity and transaction mechanisms open. |
| C-06 | A supported source change should identify related context warranting inspection. | Change impact; currency | 4: after source versions and typed claims | Accepted core; exact revision inputs open. |
| C-07 | Changed evidence must not inherit an old affirmative judgment. | Version context; governance | 4: after C-05/C-06 | Accepted core; detailed state/command mechanics proposed. |
| C-08 | Retained records are useful only when practitioners can find and inspect them. | Discoverability; rationale retention | 5: graph/search built alongside capture, relation and review views | Accepted core; knowledge-access delta now covers missing behavior. |
| C-09 | A common build, inputs and disclosed limits make demonstration conditions inspectable. | Cross-cutting reproducibility/readiness | 6: release after relevant core checks | Accepted core; actual build/input manifest pending. |
| C-10 | Link validity, content defects and required work answer different questions. | Currency; governance | Cross-cutting: with C-05/C-07 | Accepted behavior; follow-up/event projection design proposed. |

Per-capability source and acceptance links remain in the register above and the reconciliation index. Exact implementation evidence will be recorded only after a future authorized slice is verified. No source recommendation or proposed technology is treated as implementation authorization.
