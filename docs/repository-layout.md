# Repository layout

The repository separates the existing frontend from research and planning documents. The frontend lives in `apps/web/`; a backend remains proposed.

## Frontend package

`apps/web/` contains `src/`, `public/`, `index.html`, Vite and Oxlint configuration, `package.json`, and the original npm and pnpm lockfiles. Local `node_modules/` and build output also live there and remain ignored. The move preserves application source, assets, package metadata and dependency versions.

There is no root package or workspace manager. From the repository root:

```powershell
npm --prefix apps/web ci
npm --prefix apps/web run dev
npm --prefix apps/web run build
npm --prefix apps/web run lint
node --test apps/web/src/data/workflow.test.js
```

Inside `apps/web/`, the original npm commands still work. Run OpenSpec from the repository root using its pinned command in `AGENTS.md`.

## Shared project context

`AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `openspec/`, `specs/`, `.agents/skills/` and the skill lockfile stay at the root. `docs/` contains presentation assets and repository guidance. `scripts/legacy/` retains the original source-editing helpers with their target paths adjusted; those scripts were not run.

`specs/engineering-review.md` retains its earlier paths and commands as historical evidence, with an explicit mapping to the new frontend location. Installation manifests retain their original recorded hashes; they describe installation-time files, not a refreshed checksum of later documentation edits.

## Future backend

`services/api/` is a possible future location. It is not created yet. Backend language, framework, persistence, trusted identity and operating limits remain open decisions in the active proposal.

## Inspecting or reversing the move

Baseline commit `8c05d07` records the project before restructuring. The following commit contains the move, path corrections and these instructions. Inspect that commit with `git show --stat` and `git show --summary` to distinguish file moves from edited documents. A later reversal can use Git history without deleting the preserved frontend.

## Verification of the move

Checked on 2026-11-09:

- All 57 moved frontend source, asset, configuration and package/lock files match the baseline Git blobs. Only their repository locations changed.
- `npm --prefix apps/web run build` passed. Vite reported large generated chunks; bundle optimization is outside this move.
- `node --test apps/web/src/data/workflow.test.js` passed all five tests, matching the five-test pass before the move.
- `npm --prefix apps/web run lint` exited successfully with one `set-state-in-effect` warning in the unchanged `ContinuumContext.jsx` source.
- OpenSpec 1.16.1 `validate --all --strict` passed the active change and observed frontend specification. This is structural validation only.
- Legacy helpers parse as Python, local README links resolve, and nested dependency/build/secret paths remain ignored. Legacy transformations were not executed.

No browser or live backend verification was performed. No service was started, backend scaffold created or application feature changed.
