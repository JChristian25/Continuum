# Continuity core continuation

First-load review continuation (2026-11-14): Workspace now projects capture,
discovery, baseline review, comparison and incoming queue state from exact
service records. Partial lexical scope and failed processing stay visible;
comparison does not depend on finishing baseline reviews. Historical snapshots
retain their processing provenance; older provenance gaps remain unknown.
Ordinary initial candidate confirmation/rejection can omit rationale while
retaining evidence acknowledgment and exact accountable history. History and
new exports expose null plus `reasonStatus: not_provided`; UI display is “No
reason provided”. Search skips absent rationale. Exceptional reasons remain
required. See FRONTEND.md and the new change's implementation.md for the
research conflict and rollout boundary. The prepared migration has not been
applied to user data; live existing-database acceptance remains pending.

This development implementation preserves the existing frontend and accepted
Healthchecks package. It introduces no new service, database table or application
dependency. Existing accounts and local data are retained.

## Reused technology

Native Git performs change detection with `diff --no-index --no-renames` against
temporary copies of the exact retained UTF-8 file bytes. External diff drivers,
text conversion and global configuration are disabled. Git is required on PATH;
unavailability returns an explicit service error. No clone, checkout, fetch or
nested repository is involved. SHA-256 verifies source integrity; it is not the
change detection engine. A move is an addition and deletion, with no inferred
identity or automatic transfer of a judgment.

The accepted Python tokenizer and frozen lexical discovery profile remain in
place. SQLAlchemy/PostgreSQL transactions, Pydantic validation, the durable worker
and immutable result pages provide persistence and job handling. Search uses
Python's Unicode case folding and literal substring matching within the bounded
captured snapshot. React Flow/ELK render the graph. Existing shadcn-style controls,
Radix and Base UI provide frontend primitives. These libraries do not determine
whether a research claim is correct; Continuum retains that domain decision.

## Connected behavior

- Manual anchored claims support `documents` (document to code), `implements`
  (code to requirement) and `motivates` (decision to code). Automatic discovery
  continues to propose only the accepted lexical document-to-code candidates.
- Record edits create a new exact version. Linked claims enter an incoming
  review context; an earlier confirmation does not confirm changed content.
- Comparisons accept captured initial or incoming selections, retain authored
  records and baseline ancestry, and queue directly affected nonterminal claims.
  Confirmed claims become stale; unconfirmed claims remain candidates. Missing
  endpoints and changed evidence ranges remain explicit unresolved evidence.
- The inspector opens the earlier decision and exact source in read-only mode,
  then returns to incoming review. Corrections can introduce validated new line
  anchors. Corrections and successors require a separate judgment. Further
  retained history pages can be loaded.
- `search_records` searches exact retained paths, titles, contents and rationale
  at the snapshot's history high-water marks. `read_graph` returns typed one-hop
  neighborhoods, exact endpoint versions and unresolved outcomes. Both bind
  pagination to the complete query and snapshot. Limits are 1,000 artifacts,
  5,000 assertions and 100 results per page; they are operating limits, not
  measured performance findings.
- `complete_cycle` requires an active, settled current snapshot, no pending
  review and acknowledgment of its exact limitations. Follow-up work remains
  independently visible. Later changes invalidate the old completion for the
  current version while preserving its record.
- `export_snapshot` queues an immutable JSON document through the existing
  worker. Viewer grants may export readable snapshots but cannot complete them.
  `read_export` returns status and, after publication, the frozen document and
  SHA-256. The 4 MiB export contains version references, decisions, evidence,
  follow-ups and coverage rather than a complete source archive. An unattached
  release record is explicitly disclosed as null.
- `read_release_record` returns the current or named archived development
  release, including source hashes and a source-drift check.

The command envelope, sessions, CSRF, repository grants, optimistic projection
versions and idempotency receipts remain mandatory. No additional public account
or fallback demonstration data is introduced.

## Reproduce development checks

From the repository root, with the existing local PostgreSQL test configuration:

```powershell
& services/api/.venv/Scripts/python.exe -m pytest services/api/tests -q
node --test apps/web/src/data/service.test.js apps/web/src/data/workflow.test.js
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

Pytest creates and removes its own uniquely named test schemas. Do not reset the
operator's database. The real browser test starts temporary loopback API/Vite
servers, uses synthetic named accounts and the accepted retained source, and
does not read another checkout. Browser dependencies must already be installed.

`GUIDED-TASKS.md` maps the development walkthrough to the research tasks. The
observed verification summary is copied into the versioned release record:

```powershell
& services/api/.venv/Scripts/python.exe -m continuum.release --verification outputs/continuity-completion/verification.json
```

Generate only after the checks and final source changes. The record hashes source,
tests and dependency lockfiles, identifies the base Git commit separately, lists
installed Python distributions and preserves an immutable archive under
`services/api/releases/`. Dirty source bytes are part of the build identity.

## Evidence boundaries

This is bounded file-scope development verification, not full-project semantic
analysis. There is no transitive dependency inference, automatic rename identity,
runtime execution of Healthchecks, AI-generated answer or measured accuracy claim.
The accepted package contains no deleted-path revision; deletion handling is
tested with an explicitly synthetic retained snapshot in an isolated test schema.

No practitioner evaluation, participant results, live schema migration, production
deployment or HTTPS acceptance follows from these tests. Those activities require
their own authorization, procedures and observed evidence.
