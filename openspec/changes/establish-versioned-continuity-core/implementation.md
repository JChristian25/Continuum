# Implementation start

Date: 2026-11-13.

The user requested implementation ("go build continuum") and selected FastAPI,
PostgreSQL, provisioned accounts and server-side sessions. This supersedes the
earlier planning-only authorization for this build. Earlier proposed contracts
and review decisions remain retained in design.md, including uncommitted edits.

## First executable boundary

Implement the versioned review service under services/api, using synchronous
SQLAlchemy transactions and Psycopg. Keep apps/web, PRODUCT.md and DESIGN.md as
the current visual baseline. No existing browser data is migrated. No default
accounts or passwords are installed; an operator tool provisions named accounts
using an interactive password prompt. Automated tests provision synthetic users
in an isolated test database.

The first boundary covers authenticated review, exact immutable source/evidence
reads, independent assertions, retained history, correction, reversal and
follow-up. It is not a claim that the entire continuity cycle is implemented.
The existing frontend remains explicitly synthetic until its adapter is built
and verified. Do not connect its client persona to service authority.

## Operating defaults for this build

These are engineering defaults selected for the initial implementation, not
measured research results or approved Healthchecks outcomes.

- Session idle/absolute lifetime: 30 minutes / 8 hours; pre-session: 10 minutes.
- Argon2id: memory 19,456 KiB, iterations 2, parallelism 1.
- Passwords: 12–128 characters. Login name: 1–120 characters.
- Login throttle: 5 failures per normalized login per 15 minutes, persisted in
  PostgreSQL. Unknown/disabled accounts share the invalid-credentials response.
- Future source-capture default: UTF-8, 1 MiB per file; no file-capture command or its enforcement is implemented by this boundary. Implemented reasons/notes are limited to 8,000 characters.
- Read pages: 1–100 entries. History retains a frozen high-water sequence.
- Write request body: 256 KiB. Transactions use a 5-second PostgreSQL lock timeout.
- HTTPS origin is mandatory for normal operation. A separately selected local
  HTTP development profile is limited to loopback, uses differently named cookies
  and does not count as secure-cookie browser acceptance.
- Records/events/source bytes are retained; no cleanup or retention migration is
  implemented by this slice. Storage capacity must be settled before a release.

## Remaining boundaries at initial implementation start

A-INPUT remains open: no Healthchecks source has been acquired, and no exact
revision pair or immutable inventory has been accepted. File capture, discovery,
comparison and their background-worker policies must not pretend to be complete.
The initial service accepts no arbitrary filesystem roots or remote URLs.

A-DISCOVERY remains open. Automatic and manual results must remain separate.
No lexical heuristic is silently selected or tuned against expected outcomes.

SCHEMA-01 is the source for the first service command subset. Unimplemented
SCHEMA-02 operations return no success placeholder. PostgreSQL integration tests,
source checks, browser/session checks and real-project evidence are separate
verification boundaries. See services/api/README.md for observed commands and
limits once that implementation lands.

## Source-processing continuation, 2026-11-13

The user accepted HC-UPSTREAM-2026-11-13-P1 by replying "alright, commit then
continue development", then explicitly selected the separately frozen P-08
profile. The proposed manifest/profile remain retained unchanged. Separate
input/profile acceptance records bind their exact SHA-256 values and scope.

A-INPUT's bounded acquisition and predeclared input expectations are settled for
this package. Eighteen exact upstream blobs were acquired and independently
verified; no clone, upstream execution or dependency installation occurred.
A-DISCOVERY now selects lexical-file-v1 under HC-LEXICAL-2026-11-13-P1. Additional
weak candidates are retained; no quality calibration or automatic confirmation
is implied.

The service now supports registered exact inputs/profiles, repository selections,
durable capture/discovery admission, fenced leased publication, immutable source
and activity provenance, snapshot-bound review, authored record versions and
manual candidates/terminal successors. Operation admission is not completion.
Manual captures cannot modify prior automatic result membership. The 1,024-ID
review-evidence cap accommodates the accepted profile's 512 two-ended matches.

Observed verification: 104 backend tests passed, then an additional embedded
worker TCP test passed separately. The standalone reports reproduced unchanged
on all four frozen revisions, including the predeclared UP-07 candidate at C0.
Use services/api/PROCESSING.md and healthchecks-processing-verification.json for
exact evidence boundaries. Tests use isolated synthetic accounts with real
accepted source; no semantic practitioner judgments or research results are
claimed.

Still pending: selected-revision comparison and incoming revalidation; complete
knowledge-access/search/graph/completion/export operations; frontend service
integration and browser verification; reproducible release/guided-task evidence.
The original proposed contracts and earlier verification artifacts remain
inspectable. No existing user data was migrated and no deployment occurred.

## Frontend integration continuation, 2026-11-13

The normal frontend now uses the service adapter, named server accounts and
immutable selected-revision snapshots. The prior synthetic application/provider
are loaded only at `?mode=demo`; service errors do not fall back to fixture data.
The existing shell, navigation and visual references are preserved.

The user confirmed localhost:5173 and login jc, then supplied a password through
a secure prompt. The local database now has that named reviewer account, four
independent initial-review selections, 40 captured version memberships and 76
unconfirmed contexts. No real practitioner judgments were seeded. The API runs
on loopback port 8787, proxied by the existing frontend. This is local HTTP
development access, not deployment or HTTPS acceptance.

The UI connects exact evidence/source inspection, version/projection identity,
judgments, independent content concerns/follow-up work, retained history,
historical snapshots, source browsing and authored record capture. Processing
admission/status and a snapshot relationship graph use service records. Review,
independent work-note and record drafts are scoped to the signed-in actor and
exact selected context. Uncertain writes retain the original envelope for
explicit retry; known conflicts preserve drafts for refresh and inspection.

Observed checks: 108 backend/integration tests, including the real browser/TCP
flow, and 11 frontend tests passed. The final browser regression was rerun after
UI changes. The browser uses real accepted source with isolated synthetic named
accounts and a generated PostgreSQL schema; it checks conflicts, historical and
viewer restrictions, identical retry after committed response loss, exact sources,
draft reload, logout and service/demo isolation. Desktop/mobile screenshots were
inspected and the collapsed dashboard-card sizing was corrected. The build passes;
large optional graph/language bundles and one pre-existing demo lint warning remain.
See services/api/FRONTEND.md and frontend-integration-verification.json for scope.

Tasks 3.3, 4.1 and 4.3 remain open. Selected-revision comparison/revalidation,
server search/graph traversal/completion/export, UI assertion correction and
manual candidate/record-revision forms, and guided research evidence are still
unfinished. Existing proposal IDs, input/profile bytes, earlier verification
artifacts and synthetic browser state are retained. No deployment or data
migration was performed.

## Bounded comparison and interface simplification continuation

The user authorized revision comparison and requested less clutter. The normal
home retains its workspace card and Continue review action; the duplicate queue
and filters now live only in Review relationships. Snapshot/commit identifiers,
full source text, version metadata and secondary review actions use disclosures.
PRODUCT.md and DESIGN.md are preserved.

The compare_revisions command takes two retained captured snapshot IDs under a
reviewer grant, validates matching accepted inventory/profile, verifies source
bytes and compares SHA-256 content under exact path identity. Its retained
activity names the base/target snapshots, changes, limitations and direct impacts.
An incoming selection is distinct from its base and ordinary initial selections.
Earlier assertions, decisions and snapshots are preserved. Confirmed base links
become stale; never-confirmed links stay candidates; terminal claims are skipped.
Identical retained inputs reuse contexts, including after decisions. The command
receipt handles uncertain retry. Incoming evidence requires an unchanged exact
excerpt at the original anchor; uncertain anchors remain unresolved.

Observed checks: 112 tests passed in the full backend/integration run, 11 frontend
tests passed, and the expanded browser flow separately verified the comparison
command and incoming selection. Build and lint passed with the previously recorded
optional bundle and demo-effect warnings. The mechanical design detector reported
no findings. All automated judgments use isolated synthetic accounts/schemas.

Task 3.3 is deliberately still open: the accepted source contains no deleted-path
fixture, and full deletion/rename, comparison chaining, reconfirmation/retirement
and race verification are not complete. Tasks 4.1 and 4.3 also remain open. No
new upstream acquisition, schema migration, deployment or practitioner judgment
was performed.


## Authorized continuity completion, 2026-11-13

The user authorized implementing the manuscript conformance findings and explicitly requested Git for change detection and reuse of existing software. Continue tasks 3.3, 4.1 and 4.3 without replacing the current UI or expanding accepted upstream acquisition. The current review source is the separately supplied 106-page `Chapter 1 - 3.pdf`, SHA-256 `531d260782300d8814ae9bca14c71c5406beae8b03c89720f4ec8accffb25eba`; the earlier highlighted file is unavailable at its recorded path. The read-only audit is under `outputs/manuscript-audit/`.

Implementation decisions: use installed Git's `diff --no-index` on exact retained snapshot bytes, with external diff/text conversion disabled and no rename inference. No nested Git repository or external checkout is required. Reuse the existing relation vocabulary (`documents`: document to code; `implements`: code to requirement; `motivates`: decision to code), schema validation, SQLAlchemy/PostgreSQL transactions, worker and retained result-page records. Automatic discovery remains the accepted frozen document-to-code lexical profile; additional typed relationships are explicit manual claims. Retain requirements/decisions through incoming selections and freeze prior decision context. Search is bounded lexical search over retained source and rationale; no new vector/LLM dependency is required. Use the same snapshot and permission boundaries for typed neighborhoods, completion and JSON export. No live schema migration, database reset, deployment or practitioner-result claim is authorized by this continuation.

## Observed completion, 2026-11-14

The authorized continuation is implemented. Native Git compares retained files;
typed manual claims and record versions enter exact-context review. Incoming
comparisons can be chained and preserve baseline ancestry. Earlier evidence is
read-only and unresolved anchors cannot be confirmed by substitution. Correction
can supply validated replacement anchors and requires a separate judgment.
Server snapshot search and typed graph neighborhoods retain bound pagination.
Completion conflicts with pending review or active processing; JSON exports use
the existing durable worker and remain frozen to the selected snapshot. The UI
connects these operations without replacing the repaired visual design.

Observed final verification: 132 PostgreSQL/backend/integration tests passed in
278.68 seconds, including real TCP/browser login and the expanded continuity
flow; 11 frontend tests passed. Separate library/demo and synthetic service-layout
browser checks passed at desktop/mobile sizes with no page errors. Production
build, lint, Python dependency check, strict OpenSpec validation and diff whitespace
check passed. Existing Starlette TestClient deprecation, demo effect lint and large
optional bundle warnings remain. The mechanical UI source scan found no regex
findings; that scan is not a complete accessibility assessment.

The release `continuity-core-76663ead5b7f9117f99a4654` is recorded in
services/api/RELEASE.json and its immutable releases/ archive. Its source hashes
matched the final working-tree bytes on generation; the base Git commit alone
does not identify this dirty-tree build. The record embeds observed verification,
input/profile acceptance and automated guided-task proof. The active local API
was restarted on 8787 with existing data/session tables, and both direct health
and the localhost:5173 frontend proxy returned ok. No schema setup was rerun.

This supersedes the earlier unfinished-task notes for tasks 3.3, 4.1 and 4.3.
Deletion handling uses a synthetic isolated retained snapshot because the accepted
upstream package contains no deletion case. The automated guided task retained an
earlier confirmation and reason, marked incoming evidence stale, then retired it
when incoming anchors were unresolved. Separate tests cover reconfirmation guards,
correction with new exact evidence, terminal decisions and concurrent comparison.
No semantic accuracy, productivity or practitioner usability findings are claimed.
No additional acquisition, deployment, live migration or user-data reset occurred.
See services/api/CONTINUITY.md and services/api/GUIDED-TASKS.md for reproduction.
