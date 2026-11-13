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

## Remaining boundaries

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
