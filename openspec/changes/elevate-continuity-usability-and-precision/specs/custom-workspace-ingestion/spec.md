# Custom workspace ingestion

## Purpose
Enable authenticated users to create and version-compare their own bounded `.py`, `.md`, and `.txt` workspaces (via uploaded file bundles or opted-in local Git directories) through the full Continuum pipeline while preserving the Healthchecks baseline isolation.

## ADDED Requirements

### Requirement: CW-01 Bounded custom file-bundle workspace registration
The system SHALL allow an authenticated actor, when custom workspace creation is enabled, to create a repository workspace or add a new revision snapshot from a bounded bundle of `.py`, `.md`, and `.txt` files and process it through capture, discovery, and Neo4j projection.

#### Scenario: Create and compare a custom two-revision workspace
- **WHEN** an authenticated actor submits a valid custom bundle of up to 25 `.py`, `.md`, and `.txt` files (`<= 1 MiB` per file, `<= 4 MiB` total, strict UTF-8, normalized relative POSIX paths) for revision `R0` and later submits a modified bundle for revision `R1`
- **THEN** the service stores immutable content-addressed artifacts under `inputs/custom/`, grants `reviewer` role solely to the creating actor on that new repository, executes `capture_files` and `discover_candidates` via the durable RQ/PostgreSQL worker, and projects snapshots into Neo4j
- **AND** comparing `R0` and `R1` via native `git diff --no-index --no-renames` queues directly affected nonterminal relationships as incoming stale/candidate reviews

#### Scenario: Reject unsafe or out-of-bounds bundle inputs
- **WHEN** a bundle contains paths with `..`, backslashes, absolute paths, NUL bytes, unsupported extensions, invalid UTF-8, more than 25 files, or exceeds `1 MiB` per file / `4 MiB` total
- **THEN** the service rejects the request with `422 invalid_input` or `limit_exceeded` without creating partial repository records or exposing files outside `inputs/custom/`

### Requirement: CW-02 Opt-in local Git commit import without checkout or execution
The system SHALL support importing up to 25 `.py`, `.md`, and `.txt` files across up to 4 immutable commits from an allowlisted local Git repository only when explicitly enabled, without executing hooks, modifying the source repository, or reading outside configured roots.

#### Scenario: Import bounded commits from an allowlisted local Git repo
- **WHEN** `CONTINUUM_ALLOW_LOCAL_GIT=1` and `CONTINUUM_LOCAL_GIT_ROOTS` include the target repository path, and an authenticated user requests import of declared commit SHAs and eligible paths
- **THEN** the service reads immutable Git tree/blob bytes via `git` with system/global config and terminal prompts disabled (`GIT_CONFIG_NOSYSTEM=1`), verifies UTF-8 and byte caps, and records exact commit/blob provenance
- **AND** rejects symlinks, path traversal outside `CONTINUUM_LOCAL_GIT_ROOTS`, or requests when local Git import is disabled

### Requirement: CW-03 Strict tenant isolation and Healthchecks preservation
Custom workspace creation SHALL enforce repository-level grant isolation and SHALL NOT alter, migrate, or overwrite the accepted `healthchecks/healthchecks` manifest, objects, or discovery baseline.

#### Scenario: Other accounts cannot access a user's custom workspace
- **WHEN** Account A creates a custom workspace and Account B (without an explicit grant on that repository) queries `GET /api/v1/workspace` or attempts to read/mutate Account A's repository ID
- **THEN** Account B does not see Account A's custom workspace and receives `404 not_found` or `403 forbidden` on direct access attempts
- **AND** the pre-registered `healthchecks/healthchecks` repository and its accepted artifacts remain unchanged
