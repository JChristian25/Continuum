from pathlib import Path
import subprocess
import tempfile

from fastapi import HTTPException
import pytest

from continuum.acquisition import WORKSPACE
from continuum import local_repo


def test_inventory_reads_git_objects_and_records_every_exclusion(monkeypatch):
    root = WORKSPACE / "outputs" / "inventory-tests"
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        repo = Path(temporary)

        def git(*args):
            return subprocess.check_output(["git", "-C", str(repo), *args]).decode().strip()

        git("init", "-q")
        (repo / ".gitattributes").write_text("contract export-ignore\nmessage export-subst\n", encoding="utf-8")
        (repo / "contract").write_bytes(b"a" * (2 * 1024 * 1024 + 10))
        (repo / "message").write_bytes(b"original $Format:%H$ bytes\n")
        (repo / "run.unknown").write_bytes(b"hello\n")
        (repo / "image").write_bytes(b"\0\1")
        (repo / "invalid").write_bytes(b"invalid\xff")
        git("add", ".")
        git("update-index", "--chmod=+x", "run.unknown")
        git("-c", "user.name=Inventory", "-c", "user.email=inventory@example.test", "commit", "-qm", "Inventory")
        _, (rev,) = local_repo._extract_git_repo_revisions(repo, ["HEAD"], 1, None)
        assert rev["gitInventory"] == {"treeEntries": 6, "capturedPaths": 4, "selectedPaths": None,
                                       "excluded": [{"path": "image", "reason": "binary"},
                                                    {"path": "invalid", "reason": "invalid UTF-8"}]}
        assert rev["fileModes"]["run.unknown"] == "100755"
        assert rev["blobs"]["contract"] == (repo / "contract").read_bytes()
        assert rev["blobs"]["message"] == b"original $Format:%H$ bytes\n"
        _, (subset,) = local_repo._extract_git_repo_revisions(repo, ["HEAD"], 1, ["message", "missing"])
        assert subset["gitInventory"]["excluded"] == [{"path": "missing", "reason": "path absent at revision"}]
        with pytest.raises(HTTPException) as empty:
            local_repo._extract_git_repo_revisions(repo, ["HEAD"], 1, ["image"])
        assert empty.value.detail["details"]["gitInventory"]["excluded"] == [{"path": "image", "reason": "binary"}]
        monkeypatch.setattr(local_repo, "GIT_MAX_TOTAL_BYTES", 64)
        with pytest.raises(HTTPException) as exc:
            local_repo._extract_git_repo_revisions(repo, ["HEAD"], 1, None)
        assert exc.value.detail["code"] == "limit_exceeded"


def test_requested_path_and_revision_counts_are_not_truncated():
    paths = [f"file-{i}.cfg" for i in range(10001)]
    commits = [f"HEAD~{i}" for i in range(201)]
    request = local_repo.LocalGitImportInput(repoPath="/repositories/team", paths=paths, commits=commits, maxCommits=201)
    assert request.paths == paths
    assert request.commits == commits


def test_whole_tree_includes_more_than_ten_thousand_paths(monkeypatch):
    root = WORKSPACE / "outputs" / "inventory-tests"
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        repo = Path(temporary)

        def git(*args, data=None):
            return subprocess.check_output(["git", "-C", str(repo), *args], input=data).decode().strip()

        git("init", "-q")
        content = b"shared text\n"
        blob = git("hash-object", "-w", "--stdin", data=content)
        paths = [f"artifact-{i:05d}.unknown" for i in range(10001)]
        tree = git("mktree", data="".join(f"100644 blob {blob}\t{path}\n" for path in paths).encode())
        commit = git("-c", "user.name=Inventory", "-c", "user.email=inventory@example.test",
                     "commit-tree", tree, "-m", "Inventory above ten thousand paths")
        monkeypatch.setattr(local_repo, "GIT_MAX_TOTAL_BYTES", len(content))
        _, (revision,) = local_repo._extract_git_repo_revisions(repo, [commit], 1, None)
        assert revision["gitInventory"] == {
            "treeEntries": len(paths), "selectedPaths": None, "capturedPaths": len(paths), "excluded": [],
        }
        assert list(revision["blobs"]) == paths
        assert all(raw == content for raw in revision["blobs"].values())
