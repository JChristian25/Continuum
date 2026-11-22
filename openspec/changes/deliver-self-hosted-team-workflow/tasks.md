# Developer release tasks

## First installation and return visits

- [x] 1.1 Package the built UI, HTTPS gateway, API, PostgreSQL, Redis and Neo4j with private service ports and persistent storage.
- [x] 1.2 Provide named-account setup, repository lookup and role-grant instructions. Mount operator-selected Git checkouts read-only.
- [x] 1.3 Start new workspaces with the developer's source and resolve the last workspace against current grants on return.
- [x] 1.4 Exercise a fresh HTTPS installation with two accounts, one real repository, a saved judgment, a restart and a viewer grant. See the [installation and recovery run](verification.md).

## Developer workflow

- [x] 2.1 Match retained paths and blob digests against two full Git trees, include unknown UTF-8 types and disclose exclusions. Exercise a real tree with 10,001 paths and request validation with 201 refs.
- [x] 2.2 Refresh a previously connected remote after a push, capture the new SHA and reopen retained content after a force-push. Verify earlier judgment retention in the two-revision Healthchecks comparison.
- [x] 2.3 Drop the admission response during a full import, close the tab, resume, and verify a single capture and discovery. Exercise concurrent retries, partial and failed processing, and the input byte budget. Resource samples and limits are recorded in the [developer workflow run](developer-workflow-verification.md).
- [ ] 2.4 Observe two developers complete the next-commit workflow without operator coaching. Record the time to the first useful relationship, misleading suggestions and navigation failures.

## Operating a team instance

- [x] 3.1 Restore a backup on a replacement instance and verify source, history and grants against the original. The exercise used a second Compose project on the same Docker host.
- [ ] 3.2 Rehearse a supported version upgrade and rollback with retained data. Publish tested version combinations and recovery steps.
- [ ] 3.3 Exercise revoked access, repository isolation, remote import permissions and private network exposure under the intended team configuration.
- [ ] 3.4 Validate an installation on a separate team host, including DNS, browser-trusted HTTPS, disk usage, worker diagnostics and support instructions.
