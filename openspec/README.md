# OpenSpec in Continuum

OpenSpec 1.16.1 was initialized for Codex on 2026-11-09. Its six generated core skills are under `../.agents/skills/`. The CLI is available through the pinned npm-exec command in `../AGENTS.md`; it was not added to the frontend dependencies or installed globally.

## Project layout

- `specs/frontend-demo/spec.md` records the observed synthetic frontend workflow.
- `changes/establish-versioned-continuity-core/` contains a proposed continuity capability. It is planning material, not implemented behavior.
- `config.yaml` carries project context and artifact-writing rules.
- `../specs/` retains the existing thesis traceability, inventory, domain proposals and verification plan as background.

Use `openspec list`, `openspec status --change establish-versioned-continuity-core` and `openspec validate --all --strict` through the pinned runner to inspect this setup. Codex loads the generated skills from this project; whether they appear in an already-open session depends on the host's skill refresh. Generated files alone do not prove a skill has been invoked.

We are building specs first. Do not run apply, sync unimplemented deltas, or archive this proposal as completed. Resolve the open design decisions and review the planning artifacts before requesting implementation.

Validation checks structure and scenarios. It does not prove the frontend, backend or a real test repository satisfies them.

## Current manuscript reconciliation

Use [the reconciliation record](../specs/manuscript-reconciliation.md) for MS-2026-11-09 page anchors and reviewed core obligations. The active proposal now contains four capability deltas, including knowledge-access. The user explicitly added plain-text documents to the proposed core. The main frontend-demo capability remains the observed synthetic baseline. No implementation task or functional pass follows from these documentation changes.
