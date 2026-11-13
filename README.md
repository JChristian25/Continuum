<div align="center">

<img src="docs/assets/continuum-logo.png" alt="Continuum logo: a mint infinity symbol above the Continuum wordmark" width="260" />

# Continuum

**Keeping software knowledge connected as projects evolve.**

An integrated software knowledge continuity research prototype.

![Status: Work in progress](https://img.shields.io/badge/status-work_in_progress-f59e0b?style=flat-square)
![Research: Undergraduate thesis](https://img.shields.io/badge/research-undergraduate_thesis-7f1d1d?style=flat-square)
![React 19](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white)
![Vite 8](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)
![OpenSpec 1.16.1](https://img.shields.io/badge/OpenSpec-1.16.1-475569?style=flat-square)

[Overview](#overview) &nbsp; · &nbsp; [Proposed system](#proposed-system) &nbsp; · &nbsp; [Research](#research) &nbsp; · &nbsp; [Project guide](#project-guide) &nbsp; · &nbsp; [Local commands](#local-commands) &nbsp; · &nbsp; [Agent skills](#agent-skills)

</div>

> [!IMPORTANT]
> **Work in progress.** Continuum is under active specification and development as part of an ongoing thesis. The normal frontend uses named server accounts and real captured Healthchecks data. An explicit `?mode=demo` retains the synthetic demonstration. Incoming revision comparison and the complete continuity cycle remain unfinished.

## Overview

Continuum is a software knowledge continuity research prototype guided by the Software Knowledge Continuity Framework (SKCF). The proposed system connects project artifacts, relationship evidence, human review decisions and their revision history.

| Focus | Intended outcome |
| --- | --- |
| Artifact context | Identify project artifacts and the exact versions behind them. |
| Relationship evidence | Make candidate links inspectable before a human accepts or rejects them. |
| Accountable review | Retain decisions, reasons and earlier review context. |
| Change and continuity | Revisit affected relationships and retrieve current or historical knowledge. |

These outcomes describe the proposed system. See the current status below for implementation boundaries.

## Proposed system

The diagrams below summarize the [active continuity proposal](openspec/changes/establish-versioned-continuity-core/proposal.md). They describe the intended complete system. FastAPI, PostgreSQL and server-side sessions were selected for implementation; the bounded Healthchecks input and frozen lexical discovery profile have also been accepted. See the [processing guide](services/api/PROCESSING.md) for the implemented subset and evidence.

### How the parts fit together

Supported project files and captured requirements/decisions provide versioned context. Proposed services connect that context to evidence-backed candidates, accountable review and current/historical knowledge access. The service integration preserves the existing frontend shell and visual references.

![Proposed system structure: supported inputs feed versioned artifact context, candidate discovery, human review and current or historical knowledge access.](docs/diagrams/proposed-system.svg)

[Editable Mermaid source](docs/diagrams/proposed-system.mmd) · [Artifact context](openspec/changes/establish-versioned-continuity-core/specs/artifact-context/spec.md) · [Knowledge access](openspec/changes/establish-versioned-continuity-core/specs/knowledge-access/spec.md)

### How knowledge stays connected after a change

A relationship starts as a candidate. An authorized reviewer inspects exact versions and evidence before recording a decision and reason. Selected revision comparisons can open new review contexts; earlier confirmations stay attached to their original versions. Content concerns and follow-up completion remain separate from relationship validity.

![Proposed continuity cycle: capture, discover, review and preserve decisions; compare selected revisions and revalidate affected relationships without overwriting earlier judgments.](docs/diagrams/continuity-cycle.svg)

[Editable Mermaid source](docs/diagrams/continuity-cycle.mmd) · [Relationship review](openspec/changes/establish-versioned-continuity-core/specs/relationship-review/spec.md) · [Revision revalidation](openspec/changes/establish-versioned-continuity-core/specs/revision-revalidation/spec.md)

## Research

This repository is part of an ongoing thesis by **Linaban, Jimenez, and Marasigan** from the **Polytechnic University of the Philippines, Quezon City Campus (PUP Quezon City)**.

> **Continuum: Development and Evaluation of an Integrated Software Knowledge Continuity System**

The project supports the thesis's development and evaluation work. It remains a research prototype; this repository does not represent a completed thesis or final evaluation results.

## Current status

Implementation began on 2026-11-13. The normal React/Vite frontend now connects to FastAPI/PostgreSQL for named-account sessions, exact snapshot/source/evidence reads, judgments, history, follow-up work and authored record capture. Synthetic browser state is isolated behind `?mode=demo`. See the [local frontend guide](services/api/FRONTEND.md) for login, startup commands, observed browser evidence and remaining UI limits.

The complete continuity cycle still requires selected Git revision comparisons, incoming revalidation, complete server knowledge-access/completion/export operations and the remaining authoring forms. Remaining work is tracked in the [implementation tasks](openspec/changes/establish-versioned-continuity-core/tasks.md).

Healthchecks is the accepted demonstration input, with Python and Markdown/plain-text documents at file scope. Its [bounded input package](openspec/changes/establish-versioned-continuity-core/healthchecks-input-proposal.md) and separate frozen discovery profile were accepted; eighteen declared blobs have been acquired and verified. Scoped processing tests use those real bytes with isolated synthetic service users. This does not establish a completed demonstration, full-project coverage or semantic discovery accuracy.

## Repository layout

```text
.
├── apps/web/          # Existing React/Vite frontend, package files and lockfiles
├── services/api/      # FastAPI/PostgreSQL review service and isolated integration tests
├── docs/              # Logo, system diagrams and repository guidance
├── openspec/          # Observed behavior and proposed capability changes
├── specs/             # Research context, traceability and review evidence
├── scripts/legacy/    # Retained one-time prototype editing helpers
├── .agents/skills/    # Project-local agent skills and installation records
├── AGENTS.md          # Project scope and agent instructions
├── PRODUCT.md         # Product reference
├── DESIGN.md          # Visual design reference
└── README.md
```

The frontend is a standalone npm package in `apps/web/`; there is no root npm package or workspace setup. The npm lockfile tracks the current frontend and browser-test dependencies; the legacy pnpm lockfile is retained. Use npm for the commands below. Keep root-level OpenSpec and skill commands at the repository root.

The authorized backend lives under `services/api/`, with its own virtual environment, dependency lock and PostgreSQL setup. See the [service guide](services/api/README.md). Earlier [repository layout and migration notes](docs/repository-layout.md) describe the planning baseline; no browser-data migration has been performed.

## Project guide

| Document | Start here for |
| --- | --- |
| [Project instructions](AGENTS.md) | Scope, permissions and evidence rules |
| [Product context](PRODUCT.md) · [Design reference](DESIGN.md) | Product direction and the existing visual system |
| [OpenSpec guide](openspec/README.md) | Planning workflow and capability layout |
| [Observed service frontend](openspec/specs/frontend-service/spec.md) | Connected local behavior and evidence |
| [Explicit demo behavior](openspec/specs/frontend-demo/spec.md) | Synthetic mode at `?mode=demo` |
| [Active continuity proposal](openspec/changes/establish-versioned-continuity-core/proposal.md) | Proposed requirements and design |
| [Research and traceability index](specs/README.md) | Background contracts, requirements and verification plans |
| [Recorded manuscript source](specs/manuscript-source.md) | PDF identity and checked anchors |

The user also supplied the [Google Docs manuscript](https://docs.google.com/document/d/1pryZil7KuXRVWHY_rqvegNWvpVQ7THc3yylj5g7srNs/edit?tab=t.gi0irrwhheuz). Its relationship to the recorded PDF snapshot still needs revision reconciliation; the two sources must not be assumed identical.

## Local commands

The following commands are available for separately authorized development and verification. This README does not start services or authorize implementation.

```powershell
npm --prefix apps/web ci
npm --prefix apps/web run dev
npm --prefix apps/web run build
npm --prefix apps/web run lint
node --test apps/web/src/data/workflow.test.js
```

OpenSpec is pinned to 1.16.1 and runs without adding an application dependency:

```powershell
npm exec --offline --yes --package=@fission-ai/openspec@1.16.1 -- openspec list --json
npm exec --offline --yes --package=@fission-ai/openspec@1.16.1 -- openspec list --specs --json
npm exec --offline --yes --package=@fission-ai/openspec@1.16.1 -- openspec validate --all --strict
```

If the pinned CLI is not cached, omit `--offline`. Structural specification validation does not prove functional behavior. Keep unimplemented requirements under `openspec/changes/`; `openspec/specs/` describes observed behavior.

## Agent skills

Project-local skills live under `.agents/skills/` and load when relevant to a task:

- OpenSpec: exploration, proposals, artifact updates and later implementation workflows.
- Ponytail: bounded changes and reuse of existing code.
- Graphify: optional repository knowledge graphs for development navigation. The [Codex skill and references](.agents/skills/graphify/SKILL.md) are installed; the CLI runtime and graph generation are not set up by this installation. Generated graph data belongs in ignored `graphify-out/` and is not evidence that Continuum's proposed capabilities work.
- Impeccable: targeted interface review and refinement within the existing design.
- Vercel React Best Practices and Composition Patterns: React performance and component structure.
- API Design Principles and Auth Implementation Patterns: API contracts, identity and authorization.
- Python Testing Patterns and Property-Based Testing: example tests and domain invariants.
- FastAPI Templates: guidance if FastAPI is selected.
- Neo4j modeling, Cypher and Python driver skills: guidance if Neo4j is selected.

Source commits and entrypoint hashes are recorded in the [development skill manifest](.agents/skills/development-install-manifest.json) and [backend skill manifest](.agents/skills/backend-install-manifest.json). Skill installation does not select a backend stack, enable hooks or implement a capability. Project instructions and explicit user scope take precedence over skill defaults.

## Verification boundaries

Report source checks, automated tests, browser behavior, backend integration and demonstration results separately. Preserve exact artifact/evidence versions and earlier review decisions. No functional pass follows from installing skills, creating Git metadata or writing this README.
