# Guided continuity tasks: development rehearsal

These steps rehearse the manuscript's guided continuity workflow using the
accepted Healthchecks package and frozen profile. They are not participant
instructions, collected responses or study findings. The manuscript source and
checked anchors are recorded in `outputs/manuscript-audit/backend-conformance.md`.

Use a synthetic reviewer and generated test schema for automated rehearsal. The
existing local operator account may inspect the same features, but the automated
commands below never clear its data or install research judgments.

| Task | Action | Inspectable result |
| --- | --- | --- |
| G-01 | Capture/discover an accepted initial revision and inspect a candidate's exact endpoints and evidence. | Snapshot, input/profile identity, assertion revision, source and evidence version references. |
| G-02 | Record a reasoned baseline judgment. Submit the identical envelope again. | One effective decision and retained receipt; retry does not create another judgment. |
| G-03 | Compare the captured baseline with another accepted revision. | Native Git changed-path metadata, separate incoming selection, directly affected confirmed claims marked stale, candidates kept unconfirmed. |
| G-04 | Inspect the earlier read-only reason and evidence, then review incoming evidence and reconfirm or retire with a new reason. | Earlier exact source/decision retained; new decision bound to incoming context; unresolved anchors cannot be confirmed by substitution. |

Automated rehearsal:

```powershell
& services/api/.venv/Scripts/python.exe -m pytest services/api/tests/test_continuity.py -k guided -q
```

The test writes `outputs/continuity-completion/guided-task-result.json` only after
its assertions pass. It reports the actual accepted revisions, snapshot/assertion
identities, Git version and incoming decision. Its reason strings expressly label
the activity synthetic. The broader suite separately covers missing endpoints,
deletion/addition without rename inference, comparison chaining, terminal
decisions, concurrent writes, record revisions and independent follow-up work.

The authenticated browser rehearsal additionally covers login, review drafts,
response-loss retry, authored requirement capture, a manual typed link, a record
revision, prior evidence inspection, server content search, graph navigation,
viewer restrictions and logout. Its observed result is under
`outputs/frontend-integration/browser-result.json`.

Before a practitioner study, freeze the intended release and study configuration,
approve the actual participant procedure and collection instruments, and collect
results through that procedure. Development checks supply readiness evidence;
they do not supply participant scores, usability ratings or semantic ground truth.
