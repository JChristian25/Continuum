## Context

The service already has server sessions, PostgreSQL repository grants, retained decisions, revision comparisons and an embedded worker. Its development setup runs several processes with host-specific paths. A team needs to operate those components and recover its data on its own infrastructure.

## Decisions

- Package the existing application as two images. Caddy serves the compiled frontend and proxies the API over one HTTPS origin. A single API process runs the existing worker. PostgreSQL, Redis and Neo4j use private Compose networking.
- Use a read-only mount for operator-selected Git checkouts. Keep retained inputs and managed Git clones on a persistent volume. Use the existing operator CLI to provision accounts and grant roles.
- Store the last successfully loaded selection under the authenticated account's browser key. Resolve it against the server's current grants and reopen comparisons through the existing authorization path.
- Read Git trees and blobs by object ID. Retain each accepted file's Git mode, blob ID and original bytes, plus a per-revision inventory of omissions. Stream blob validation and share identical objects across revisions during admission. The 250 MiB budget applies to distinct eligible file bytes in one request. Git history, metadata and service memory require additional capacity.
- Fetch managed remote branches, tags and the remote default into the instance's persistent clone. Pin accepted SHAs so a subsequent branch update cannot discard the Git history used by existing reviews.
- Write the exact import request to account-scoped IndexedDB before sending it. Store the server receipt transactionally with admission. On a replay, check the current grant before returning the previous result. The worker schedules requested discovery after successful capture. Returning browsers read progress from the service.
- Use a clean installation, a subsequent commit, a second developer and a recovered instance as release exercises. Record what each exercise establishes.

## Open operational work

The first distribution targets a single Linux Docker host. Capacity targets for larger repositories, supported version upgrades, team-network access and installation on an independent host remain open. The [release tasks](tasks.md) link to the measured exercises.
