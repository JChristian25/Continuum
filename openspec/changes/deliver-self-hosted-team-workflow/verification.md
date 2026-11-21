# Team installation and recovery, 2026-11-20

Built both self-host images from the working tree and installed on Docker Desktop's Linux engine 29.6.1 using Compose 5.2.0. The original and recovery installations used separately named volumes. Only the gateway published ports, bound to 127.0.0.1. The repository mount held the existing authorized Healthchecks checkout read-only.

| Exercise | Observation |
| --- | --- |
| Installation | Fresh database initialization succeeded. The HTTPS frontend and health endpoint returned 200 with the exported local CA trusted by the test client. Chromium used an isolated test context with certificate errors ignored. The authenticated session cookie carried Secure and HttpOnly. |
| First repository | A named reviewer browsed actual Git history from the mounted checkout and captured `templates/docs/email.md` and `hc/api/management/commands/smtpd.py` at `0f78e117eadb59a01dd51e09344479fa3eeb4187`. Discovery produced a relationship. The reviewer inspected the evidence and saved a confirmation. |
| Team access | The operator located the workspace with `list-repositories` and granted a second named account viewer access. That account could read the confirmation. Its judgment submission control was disabled. |
| Return visit | The reviewer added commit `c62d6648d81e1aebc65f80bddc72f165fba7320b` for the same two paths. Comparison marked the confirmed relationship stale. Reloading the app reopened that comparison. |
| Recovery | After stopping the original stack, the operator archived six volumes and restored them into a new Compose project. The existing reviewer session reopened the incoming review and its prior decision. The two historical source texts matched the baseline Git blobs byte for byte. The second user signed in again and retained the viewer grant. |
| Recovery safeguards | A restore into an existing volume set and a backup attempt on running volumes both exited with an error before writing. |

The run exposed a Git ownership check on a host-mounted read-only checkout and an RQ timeout handler that required the Linux main thread. Both fixes were included in the tested images. PostgreSQL reported three completed capture operations and one completed discovery operation across the rehearsal and retry. The frontend unit suites passed 23 tests. Lint reported one existing warning in the demo provider.

The API image ID was `sha256:e5c919a2f81cbc0447b64a607fe7109950b2bd925d7284bbcb37e93dec8fdf71`. The web image ID was `sha256:761f5481b931873a50c4f2d9c4ca768e199eb183fdafad19f743aa4a6bd6a8b4`. Historical source SHA-256 values were `2953666baa50db56fce7008a603b36c55d6b45fec3be84da0746ed5bbf5e7351` for the email document and `51f33d5fcebdc5b59dc9fc4f3648d8e865b18f12caab39e2fc1da7f9ee2a74f3` for the SMTP command.

This evidence covers a same-version restore on one physical host with the original Git checkout mounted at the same path. Full-tree import, managed remote updates, version upgrades, a separate host and independent team usage remain open in the [developer release tasks](tasks.md).
