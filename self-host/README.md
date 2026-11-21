# Run Continuum for a team

This installation serves one team's workspace over HTTPS. The operator provisions accounts. Developers connect a Git repository, inspect a revision, and record decisions. A reviewer can return to the same repository and revision in the same browser.

## Install on a new host

Use Docker Engine with Linux containers and Docker Compose v2 or later. Run the commands from the `self-host` directory of the Continuum checkout. The first build downloads container images and dependencies. Local Python, Node and Git installations are unnecessary for the application containers.

1. Create a directory for the repositories your team may import. Mount a **dedicated directory** containing only checkouts available to every provisioned user on this instance. The application mounts it read-only at `/repositories`. An empty directory works for remote URL imports.
2. Write the following values to `.env` in this directory. Generate **two independent secrets** with `openssl rand -hex 32`, once for each password. Use the hex strings directly. Protect `.env` with host filesystem permissions.

   ```dotenv
   CONTINUUM_HOST=localhost
   CONTINUUM_BIND_IP=127.0.0.1
   CONTINUUM_REPOS_DIR=/absolute/path/to/team-repositories
   POSTGRES_PASSWORD=
   NEO4J_PASSWORD=
   ```

   The defaults above serve the operator's host at `https://localhost`. On a team server, set the hostname to its DNS name and the bind IP to the intended server interface. Caddy serves the frontend and API at that single origin. For public certificate issuance, DNS must point to that server and the certificate authority must be able to reach it. Internal names use Caddy's local CA and require client trust configuration. [Caddy HTTPS documentation](https://caddyserver.com/docs/automatic-https)

3. Build, initialize a fresh database, and start the stack.

   ```sh
   docker compose build
   docker compose run --rm api continuum-admin init-db
   docker compose up -d --wait
   docker compose ps
   ```

4. For localhost, export the local root certificate and configure trust in the team browser or OS. For a command-line check on the same host, use the exported certificate directly.

   ```sh
   docker compose cp web:/data/caddy/pki/authorities/local/root.crt ./continuum-root.crt
   curl --cacert ./continuum-root.crt https://localhost/api/v1/health
   ```

   With a browser-trusted team certificate, open `https://YOUR-HOST/api/v1/health` directly. A successful response contains `"status":"ok"` and checks API access to PostgreSQL. Use `docker compose ps` and `docker compose logs --tail=100 api web` to diagnose startup.

## Connect a repository and invite a teammate

Create an individual account. The command prompts for a password twice.

```sh
docker compose exec api continuum-admin create-account alex "Alex Rivera"
```

Sign in and open **New custom workspace**. Choose how the instance will read the repository.

- **Clone Git URL**. Enter a URL reachable from the server. Enter a branch to follow, or leave it empty to use the remote's default branch. Select **Clone & browse**.
- **Local Git commits**. Enter a mounted path such as `/repositories/billing-service` and choose **Browse commits**. For private repositories, the operator can keep an authenticated clone on the host, update it with the team's usual Git credentials, and mount it read-only.

Select the baseline commit by its message, author and SHA. Leave **Specific relative paths** empty for the whole tree. Choose **Create & capture workspace**. The workspace opens when the server accepts the request. Check **Processing coverage** for the capture result. If you selected automatic candidate discovery, its results arrive in a separate operation. Open a suggested relationship, inspect the supporting lines and record your judgment.

To share that workspace, look up its ID, provision a second account, and grant the appropriate repository role.

```sh
docker compose exec api continuum-admin list-repositories
docker compose exec api continuum-admin create-account sam "Sam Chen"
docker compose exec api continuum-admin grant sam REPOSITORY_ID viewer
```

Use `reviewer` for a teammate who should record judgments. Use `none` to revoke repository access. A provisioned account can create its own workspace from any repository exposed to the instance's importer.

## Review the next commit

1. Open the same workspace and choose **Add revision to workspace**. For a managed remote, **Refresh commits** fetches the saved URL and branch. For a local checkout, update the host checkout first and select **Browse commits**.
2. Select the incoming commit and choose **Capture new revision**. Open **Revision & snapshot details** to inspect the commit SHA, number of captured files and reasons for individual exclusions.
3. Choose **Compare revisions** and select the previous reviewed snapshot and the incoming revision. Use the same path selection on both sides. Adding or dropping a path from your selection changes the compared inventory even if its Git content stayed the same. Open an affected relationship to see its earlier judgment and decide whether the changed source still supports it. Older captures remain accessible by their exact revision, including after the remote branch is rewritten.

### What a Git capture includes

A whole-tree capture reads the selected commit's regular UTF-8 text files directly from Git, including unknown extensions and files marked `export-ignore`. File modes and original blob contents are retained. Binary data containing NUL, invalid UTF-8, symbolic links, submodules and unsupported path names appear in the exclusion list. If you select individual paths, the list also identifies any missing from that commit. Candidate discovery has its own supported formats and coverage.

Git admission currently accepts up to 250 MiB of distinct eligible file content across the revisions in one request. Reused blobs count once. A request over that budget fails before a workspace or revision is admitted. Choose fewer commits or specific paths and resubmit. Allow additional memory and disk for Git history, manifests, snapshots and database indexes.

### Reopen an interrupted import

Return to the same origin in the same browser profile and sign in with the account that submitted the import. If the browser lost the server's reply, select **Resume import**. Continuum sends the saved request ID and original selection and opens the admitted workspace. After admission, capture and requested discovery run on the server. Reopening the workspace shows the current operation and coverage, including partial results. Clearing site data removes the browser's saved request, so check your granted workspaces before starting a fresh import.

## Operate the instance

- **Restart.** Use `docker compose stop` and `docker compose up -d --wait` from the same directory with the same project name. PostgreSQL, retained inputs and cloned repositories, Neo4j, Redis and Caddy state use named volumes. Host-mounted Git repositories must stay available at the same container path.
- **Recover account access.** Run `docker compose exec api continuum-admin reset-password LOGIN` or `disable-account LOGIN`. Password resets and disabled accounts invalidate existing sessions.
- **Back up and restore.** Follow the cold backup procedure below. The certificate volume contains private keys.
- **Upgrade.** The current `init-db` command initializes a new installation. Existing instances need a version-specific upgrade path. Keep the previous application version, inputs and database backup together. The [release tasks](../openspec/changes/deliver-self-hosted-team-workflow/tasks.md) track upgrade and recovery qualification.

## Cold backup and same-version recovery

Use Python 3.11+ on the operator host for this optional helper. Budget space for an uncompressed copy of all six volumes. From the installation directory, stop the stack, archive its volumes to a new protected directory, then restart it.

```sh
docker compose stop
python volumes.py backup /secure/backups/continuum-01
docker compose up -d --wait
```

Keep the matching `.env`, exact images or source checkout, and host-mounted Git repositories with the backup. The archive covers Docker volumes. On a replacement host, supply those items first, retain the container mount paths, and restore into a fresh Compose project.

```sh
docker compose build
python volumes.py restore /secure/backups/continuum-01
docker compose up -d --wait
```

Restore checks every archive digest before writing and requires new volume names. If an interruption leaves partially restored volumes, retry with a fresh project name. Sign in, open an earlier decision and its source, and check a teammate's role before reopening the service to the team.
