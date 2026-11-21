"""A cached team remote advances independently of Continuum's working tree."""
import subprocess
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from conftest import sign_in
from continuum.acquisition import WORKSPACE
from continuum.local_repo import GitCloneImportInput, GitInspectInput, _remote_revisions, inspect_git_repository, remote_connection
from continuum.worker import run_operation
from test_custom_workspace import custom_setup, _ask


@pytest.fixture
def team_remote():
    def git(directory, *args):
        return subprocess.check_output(
            ["git", "-C", str(directory), "-c", "user.name=Reviewer", "-c", "user.email=reviewer@example.invalid", *args],
            text=True, encoding="utf-8",
        ).strip()

    base = WORKSPACE / "outputs"
    base.mkdir(exist_ok=True)
    with TemporaryDirectory(dir=base) as folder:
        root = Path(folder)
        served, work = root / "served", root / "work"
        served.mkdir()
        work.mkdir()
        git(served, "init", "--bare", "--initial-branch=main", "team.git")
        remote = served / "team.git"
        git(work, "init", "--initial-branch=main")
        readme = work / "README.md"
        readme.write_text("baseline\n", encoding="utf-8")
        git(work, "add", "README.md")
        git(work, "commit", "-qm", "Baseline")
        baseline = git(work, "rev-parse", "HEAD")
        git(work, "branch", "maintenance")
        git(work, "push", str(remote), "main", "maintenance")
        git(remote, "update-server-info")
        handler = partial(SimpleHTTPRequestHandler, directory=str(served))
        with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                url = f"http://127.0.0.1:{server.server_port}/team.git"
                yield root, work, remote, git, baseline, url
            finally:
                server.shutdown()
                thread.join(5)


def test_remote_branch_refresh_resolves_current_tip_and_retains_previous_revision(team_remote):
    root, work, remote, git, baseline, url = team_remote
    readme = work / "README.md"
    settings = SimpleNamespace(allow_local_git=True, custom_inputs_root=str(root / "inputs"))
    source = GitCloneImportInput(repoUrl=url, branch="maintenance", maxCommits=1)
    _, first = _remote_revisions(source, settings)
    assert first[0]["commitId"] == baseline
    cache = Path(first[0]["gitRepoPath"])
    assert remote_connection({"sourceMode": "git_clone", **first[0]}, cache, settings) == {
        "gitRemoteUrl": url, "gitBranch": "maintenance",
    }
    assert remote_connection({"sourceMode": "git_clone"}, cache, settings)["gitRemoteUrl"] == url

    git(work, "switch", "maintenance")
    readme.write_text("changed on maintenance\n", encoding="utf-8")
    git(work, "commit", "-qam", "Update maintenance")
    incoming = git(work, "rev-parse", "HEAD")
    git(work, "push", str(remote), "maintenance")
    git(work, "tag", "weekly", incoming)
    git(work, "push", str(remote), "refs/tags/weekly")
    git(remote, "update-server-info")
    inspect = GitInspectInput(repoUrl=url, branch="maintenance", requestId="inspect")
    history = inspect_git_repository(inspect, settings)
    assert history["repoPath"] == str(cache)
    assert [item["commitId"] for item in history["commits"]] == [incoming, baseline]
    assert inspect_git_repository(inspect.model_copy(update={"branch": None}), settings)["commits"][0]["commitId"] == baseline
    for commits in (None, ["HEAD"], ["maintenance"], ["refs/heads/maintenance"], ["origin/maintenance"], ["weekly"]):
        _, added = _remote_revisions(source.model_copy(update={"commits": commits}), settings)
        assert added[0]["commitId"] == incoming

    git(work, "push", "--force", str(remote), "main:maintenance")
    git(remote, "update-ref", "-d", "refs/tags/weekly")
    git(remote, "update-server-info")
    _, rewound = _remote_revisions(source, settings)
    assert rewound[0]["commitId"] == baseline
    assert git(cache, "rev-parse", f"refs/continuum/retained/{incoming}") == incoming
    assert git(cache, "show", f"{incoming}:README.md") == "changed on maintenance"
    with pytest.raises(HTTPException):
        inspect_git_repository(inspect.model_copy(update={"branch": "removed"}), settings)
    with pytest.raises(HTTPException):
        _remote_revisions(source.model_copy(update={"commits": ["weekly"]}), settings)


def test_authenticated_team_can_browse_import_and_reopen_remote_history(custom_setup, team_remote):
    _, work, remote, git, baseline, url = team_remote
    client = custom_setup["client"]
    headers = sign_in(custom_setup, login="alice", client=client)
    source = {"repoUrl": url, "branch": "maintenance", "maxCommits": 1}

    def post(route, body, status=200):
        res = client.post("/api/v1/" + route, headers=headers,
                          json={"requestId": uuid4().hex, "schemaVersion": "0.1.0", **body})
        assert res.status_code == status, res.text
        return res.json()

    def captured_version(admission):
        operation = admission["captureOperations"][0]
        assert run_operation(custom_setup["db"], operation["operationId"])
        op = _ask(client, headers, admission["repositoryId"], "read_operation", {"operationId": operation["operationId"]})
        workspace = _ask(client, headers, admission["repositoryId"], "read_workspace", {"snapshotId": op["resultSnapshotId"]})
        return workspace["artifacts"][0]["versionId"]

    assert post("git/inspect", {"repoUrl": url, "branch": "maintenance"})["result"]["commits"][0]["commitId"] == baseline
    created = post("workspaces", {"name": "Team", "mode": "git_clone", "gitClone": source})["result"]
    assert created["selection"]["targetRevision"]["commitId"] == baseline
    repo_id, previous_version = created["repositoryId"], captured_version(created)
    connection = client.get("/api/v1/workspace").json()["repositories"][0]["inputs"][0]
    assert connection["gitRemoteUrl"] == url and connection["gitBranch"] == "maintenance"

    git(work, "switch", "maintenance")
    (work / "README.md").write_text("next week\n", encoding="utf-8")
    git(work, "commit", "-qam", "Next week")
    tip = git(work, "rev-parse", "HEAD")
    git(work, "push", str(remote), "maintenance")
    git(remote, "update-server-info")
    assert post("git/inspect", {"repoUrl": url, "branch": "maintenance"})["result"]["commits"][0]["commitId"] == tip
    added = post(f"repositories/{repo_id}/revisions", {"mode": "git_clone", "gitClone": source})["result"]
    assert added["selection"]["targetRevision"]["commitId"] == tip
    new_version = captured_version(added)

    git(work, "push", "--force", str(remote), "main:maintenance")
    git(remote, "update-server-info")
    assert post("git/inspect", {"repoUrl": url, "branch": "maintenance"})["result"]["commits"][0]["commitId"] == baseline
    for version, expected in ((previous_version, "baseline\n"), (new_version, "next week\n")):
        data = client.get(f"/api/v1/repositories/{repo_id}/versions/{version}")
        assert data.status_code == 200, data.text
        assert data.json()["content"] == expected

    git(remote, "symbolic-ref", "HEAD", "refs/heads/maintenance")
    git(remote, "update-ref", "-d", "refs/heads/main")
    git(remote, "update-server-info")
    assert post("git/inspect", {"repoUrl": url})["result"]["branches"] == ["maintenance"]
    post("git/inspect", {"repoUrl": url, "branch": "main"}, 422)
    post(f"repositories/{repo_id}/revisions", {"mode": "git_clone",
         "gitClone": {**source, "commits": ["main"]}}, 422)
