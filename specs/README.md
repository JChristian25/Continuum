# Continuum specifications

Current manuscript: [MS-2026-11-09 source record](manuscript-source.md). Use the latest user-supplied manuscript for future scope/citation reconciliation; the scoped reconciliation and remaining limits are recorded in [manuscript reconciliation](manuscript-reconciliation.md), with a [demonstration guide specification](demonstration-plan.md).

OpenSpec is the current workflow. Start with [the OpenSpec index](../openspec/README.md): `openspec/specs/` describes observed behavior and `openspec/changes/` contains proposed changes. The documents below remain background research, traceability and engineering proposals; they are not a second copy of the normative OpenSpec capabilities.

Version 0.2.1. Date: 2026-11-09. Stage: specification development.

The working Continuum project is this frontend prototype. All implementation observations come from files in this repository. This specification set defines intended behavior and records decisions before implementation begins.

## Reading order

1. [Scope, requirements and decisions](requirements.md)
2. [Frontend baseline and engineering review](engineering-review.md)
3. [Domain, state and command contracts](continuity-contract.md)
4. [Acceptance and verification plan](acceptance-plan.md)

`../PRODUCT.md` describes the prototype's product purpose and demo boundaries. `../DESIGN.md` is the visual reference. Preserve its appearance and interaction patterns when planning integrations.

## Current work

Write and review focused requirements and design proposals under `openspec/changes/`, using `specs/` as background. The current stage does not include backend implementation, a frontend adapter, UI replacement, repository ingestion, deployment or source cleanup. Future implementation stages in these documents are plans, not authorization to execute them.

The user accepted the continuity cycle and Healthchecks as the real test-project identity, with Python and Markdown at file scope. That project is a future test input; it is not Continuum's implementation source. A revision pair, inventory, configuration and expected outcomes must be documented through an authorized evidence source before integration testing. No local checkout outside this project supplies evidence for this baseline.

## Evidence and status

- Observed: source inspection and named existing tests.
- Accepted: scope or behavior explicitly agreed with the user.
- Proposed: engineering detail awaiting review.
- Unknown: not verified or not selected.

The current frontend uses synthetic data and browser storage. Five existing workflow tests passed on 2026-11-09. No backend, real-source processing or new acceptance suite is verified by that result.

Research context comes from the Chapter 1-3 thesis and prototype screenshots supplied in the planning conversation. Exact thesis anchors are recorded in requirements.md. Those source documents are not stored in this repository by this change. Do not invent local paths for them.

## Change rules

Keep requirement IDs stable. Record the reason for a requirement, state or command change and update its linked acceptance checks. Distinguish approved product behavior from pending implementation choices. A specification is ready for a bounded implementation task only when its decisions, inputs, errors and observable acceptance outcomes are settled.

Before implementation, finish the domain/API review, select backend and persistence details, establish authentication and operating limits, and freeze the first task's exact file scope. This repository's code and visual design remain the baseline throughout that review.
