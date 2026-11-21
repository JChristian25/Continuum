# Developer release tasks

## First installation and return visits

- [x] 1.1 Package the built UI, HTTPS gateway, API, PostgreSQL, Redis and Neo4j with private service ports and persistent storage.
- [x] 1.2 Provide named-account setup, repository lookup and role-grant instructions. Mount operator-selected Git checkouts read-only.
- [x] 1.3 Start new workspaces with the developer's source and resolve the last workspace against current grants on return.
- [x] 1.4 Exercise a fresh HTTPS installation with two accounts, one real repository, a saved judgment, a restart and a viewer grant. See the [installation and recovery run](verification.md).

## Developer workflow

- [ ] 2.1 Compare Git tree entries to the retained inventory. Include unknown UTF-8 file types and make omissions inspectable. Remove fixed Git path and revision caps that conflict with accepted product scope.
- [ ] 2.2 Bring in a newer commit from an already connected remote branch. Preserve earlier review evidence across the update.
- [ ] 2.3 Interrupt a large import, reopen the workspace and resume processing. Verify bounded resource use, partial results and retry behavior, including duplicate submissions.
- [ ] 2.4 Observe two developers complete the next-commit workflow without operator coaching. Record the time to the first useful relationship, misleading suggestions and navigation failures.

## Operating a team instance

- [x] 3.1 Restore a backup on a replacement instance and verify source, history and grants against the original. The exercise used a second Compose project on the same Docker host.
- [ ] 3.2 Rehearse a supported version upgrade and rollback with retained data. Publish tested version combinations and recovery steps.
- [ ] 3.3 Exercise revoked access, repository isolation, remote import permissions and private network exposure under the intended team configuration.
- [ ] 3.4 Validate an installation on a separate team host, including DNS, browser-trusted HTTPS, disk usage, worker diagnostics and support instructions.
