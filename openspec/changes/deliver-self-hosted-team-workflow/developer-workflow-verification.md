# Self-hosted developer workflow, November 2026

A disposable Docker Desktop Linux installation exposed only the gateway on loopback. A named reviewer captured two complete Healthchecks Git trees through the HTTPS service, recorded a judgment, then opened the comparison.

| Captured revision | Git entries | Retained UTF-8 files | Excluded | Retained file bytes |
| --- | ---: | ---: | ---: | ---: |
| `0f78e117eadb59a01dd51e09344479fa3eeb4187` | 1,263 | 1,111 | 152 | 4,617,172 |
| `c62d6648d81e1aebc65f80bddc72f165fba7320b` | 1,263 | 1,111 | 152 | 4,623,247 |

Independent Git reads matched every captured path, blob ID and content digest. Both the capture operation and snapshot reported 152 exclusions for each commit. Native Git and the Continuum comparison identified the same five changed paths. The email documentation relationship retained its earlier confirmation and became stale when the SMTP source changed. The source detail showed its commit metadata, line blame and file history.

Two recorded end-to-end runs took 70.71 and 94.79 seconds including client-side verification. The second run used the rebuilt API image `sha256:d3271f696219a4e978e5512f4be37ea264c7a424719e10956b3dca477339a52a` and web image `sha256:3879691390f150c18f17a10ef4bf63f7bb7f3e1e796793a3ba48a4c6a3579d25`. The API container's 240 memory samples during the local exercises ranged from 264.6 to 355.6 MiB. Sampling can miss peaks. The 250 MiB import budget covers distinct eligible bytes per request. Operators must also size for the Git clone, database, runtime and indexes. These figures describe this host and fixture.

Chromium dropped a successful workspace-creation reply, closed the tab and resumed the import in a new tab using the same signed-in browser profile. The replay used the original request and returned the same workspace, selection and capture operation. Exactly one workspace, capture and discovery resulted. After reload the browser displayed 1,111 captured files and 152 exclusions.

An authenticated API exercise against PostgreSQL and a loopback HTTP Git remote covered a pushed commit, a rewritten branch and a deleted branch. The old capture remained readable. Additional service regressions exercised concurrent receipts, rejected replay after access revocation, partial discovery and failed capture without a follow-up. External Git credentials, separate team infrastructure and independent developer use remain unverified.

Retained-file checks on Windows and on the Linux container's data volume injected a flush failure before publication, retried identical writes concurrently and attempted a conflicting write. The failed write left no published file, retries converged on one object and the conflicting write preserved the original bytes.

## Repeat the local workflow

Use a disposable installation following the [operator guide](../../../self-host/README.md). Mount the authorized Healthchecks checkout read-only and provision a test reviewer. From the repository root run the following with a private local JSON configuration on stdin.

```sh
python self-host/tests/healthchecks-workflow.py < local-test-config.json
node self-host/tests/interrupted-import.mjs < local-test-config.json
```

Both programs take `origin` (loopback HTTPS), `login`, `password` and `repoPath` (the container mount). The Python check also takes `checkout` (the host path to the same repository) and `caFile` (the exported gateway CA). The Chromium check needs the web package dependencies, Playwright Chromium, the baseline SHA in `commit`, and numeric `expectedCaptured` and `expectedExcluded` set to 1111 and 152. Each execution creates fresh workspace data. Remove the temporary credentials and test project after the exercise.
