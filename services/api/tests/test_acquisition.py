import base64
from copy import deepcopy
import json
from pathlib import Path
import tempfile

import pytest

from continuum.acquisition import (API, WORKSPACE, AcquisitionError, acquire, blob_sha,
                                   fetch_github, sha256)


@pytest.fixture
def inputs():
    base = WORKSPACE / "outputs" / "acquisition-tests"
    base.mkdir(parents=True, exist_ok=True)
    temporary = tempfile.TemporaryDirectory(dir=base)
    root = Path(temporary.name).resolve()
    assert root.is_relative_to(base.resolve())
    content = b"Synthetic source, never execute.\n"
    blob = blob_sha(content)
    revisions = {
        "base": {"objectAlgorithm": "sha1", "commitId": "1" * 40, "treeId": "2" * 40, "parentIds": []},
        "target": {"objectAlgorithm": "sha1", "commitId": "3" * 40, "treeId": "4" * 40, "parentIds": ["1" * 40]},
    }
    manifest = {"id": "synthetic-acquisition-fixture", "repository": {"fullName": "healthchecks/healthchecks", "githubId": 38067078},
        "revisions": revisions, "entries": [{"path": "README.md", "kind": "document", "format": "Markdown",
        "revisions": {label: {"commit": revision["commitId"], "blobId": blob, "sizeBytes": len(content),
                              "mode": "100644", "type": "blob"} for label, revision in revisions.items()}}]}
    acceptance = {"schemaVersion": "acceptance-0.1.0", "id": "synthetic-acceptance", "localAcquisition": True,
        "proposalId": manifest["id"], "repositoryFullName": "healthchecks/healthchecks", "repositoryId": 38067078,
        "maximumPaths": 10, "maximumRevisions": 4, "maximumFileBytes": 1048576, "maximumUniqueBlobBytes": 4194304}
    responses = {API: {"id": 38067078, "full_name": "healthchecks/healthchecks", "private": False},
        API + "/git/blobs/" + blob: {"sha": blob, "size": len(content), "encoding": "base64", "content": base64.b64encode(content).decode()}}
    for revision in revisions.values():
        responses[API + "/git/commits/" + revision["commitId"]] = {"sha": revision["commitId"], "tree": {"sha": revision["treeId"]},
            "parents": [{"sha": parent} for parent in revision["parentIds"]]}
        responses[API + "/git/trees/" + revision["treeId"] + "?recursive=1"] = {
            "sha": revision["treeId"], "truncated": False,
            "tree": [{"path": "README.md", "mode": "100644", "type": "blob", "sha": blob, "size": len(content)}]}
    calls = []

    def fetch(url):
        calls.append(url)
        return deepcopy(responses[url])

    manifest_path, acceptance_path = root / "manifest.json", root / "acceptance.json"

    def save():
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        acceptance["manifestSha256"] = sha256(manifest_path.read_bytes())
        acceptance_path.write_text(json.dumps(acceptance), encoding="utf-8")

    save()
    yield {"root": root, "manifest": manifest, "acceptance": acceptance, "responses": responses,
           "fetch": fetch, "calls": calls, "save": save, "blob": blob, "content": content,
           "manifest_path": manifest_path, "acceptance_path": acceptance_path}
    assert root.is_relative_to(base.resolve())
    temporary.cleanup()


def run(inputs):
    return acquire(inputs["manifest_path"], inputs["acceptance_path"], root=inputs["root"], fetch=inputs["fetch"])


def destination(inputs):
    return inputs["root"] / "inputs" / "healthchecks" / inputs["acceptance"]["manifestSha256"]


def test_exact_bytes_digests_and_idempotent_reacquisition(inputs):
    first = run(inputs)
    assert first["status"] == "acquired"
    assert first["objects"] == [{"blobId": inputs["blob"], "sizeBytes": len(inputs["content"]), "contentSha256": sha256(inputs["content"])}]
    assert (destination(inputs) / "objects" / inputs["blob"]).read_bytes() == inputs["content"]
    assert first["coverage"]["applicationCapture"] == "not_run"
    assert first["coverage"]["discovery"] == "not_run"
    blob_reads = sum("/git/blobs/" in call for call in inputs["calls"])
    assert run(inputs) == first
    assert sum("/git/blobs/" in call for call in inputs["calls"]) == blob_reads == 1
    assert not (destination(inputs) / ".acquisition.lock").exists()


@pytest.mark.parametrize("case", ["digest", "not-accepted", "wrong-repository", "traversal", "mode", "size", "duplicate", "binding"])
def test_invalid_scope_is_rejected_before_network(inputs, case):
    manifest, acceptance = inputs["manifest"], inputs["acceptance"]
    if case == "not-accepted":
        acceptance["localAcquisition"] = False
    elif case == "wrong-repository":
        manifest["repository"]["fullName"] = "elsewhere/project"
    elif case == "traversal":
        manifest["entries"][0]["path"] = "../README.md"
    elif case == "mode":
        manifest["entries"][0]["revisions"]["base"]["mode"] = "120000"
    elif case == "size":
        manifest["entries"][0]["revisions"]["base"]["sizeBytes"] = 1048577
    elif case == "duplicate":
        manifest["entries"].append(deepcopy(manifest["entries"][0]))
    elif case == "binding":
        manifest["entries"][0]["revisions"]["base"]["commit"] = "f" * 40
    inputs["save"]()
    if case == "digest":
        inputs["manifest_path"].write_text("{}", encoding="utf-8")
    with pytest.raises(AcquisitionError):
        run(inputs)
    assert inputs["calls"] == []


@pytest.mark.parametrize("case", ["identity", "commit", "parent", "truncated", "tree-entry", "blob-bytes", "base64", "encoding"])
def test_upstream_mismatch_never_publishes_success(inputs, case):
    responses = inputs["responses"]
    if case == "identity":
        responses[API]["id"] = 1
    elif case == "commit":
        responses[API + "/git/commits/" + "1" * 40]["tree"]["sha"] = "f" * 40
    elif case == "parent":
        responses[API + "/git/commits/" + "3" * 40]["parents"] = []
    elif case == "truncated":
        responses[API + "/git/trees/" + "2" * 40 + "?recursive=1"]["truncated"] = True
    elif case == "tree-entry":
        responses[API + "/git/trees/" + "2" * 40 + "?recursive=1"]["tree"][0]["sha"] = "f" * 40
    elif case == "blob-bytes":
        responses[API + "/git/blobs/" + inputs["blob"]]["content"] = base64.b64encode(b"wrong").decode()
    elif case == "base64":
        responses[API + "/git/blobs/" + inputs["blob"]]["content"] = "???"
    else:
        responses[API + "/git/blobs/" + inputs["blob"]]["encoding"] = "utf-8"
    with pytest.raises((AcquisitionError, ValueError)):
        run(inputs)
    assert not (destination(inputs) / "acquired.json").exists()
    assert not (destination(inputs) / ".acquisition.lock").exists()


def test_cached_byte_tampering_is_not_repaired_or_hidden(inputs):
    run(inputs)
    path = destination(inputs) / "objects" / inputs["blob"]
    path.write_bytes(b"x" * len(inputs["content"]))
    with pytest.raises(AcquisitionError, match="Source bytes"):
        run(inputs)
    assert path.read_bytes() == b"x" * len(inputs["content"])


def test_receipt_tampering_and_existing_lock_are_not_overwritten(inputs):
    run(inputs)
    receipt_path = destination(inputs) / "acquired.json"
    receipt = json.loads(receipt_path.read_text())
    receipt["objects"] = []
    receipt_path.write_text(json.dumps(receipt))
    with pytest.raises(AcquisitionError, match="receipt differs"):
        run(inputs)
    lock_path = destination(inputs) / ".acquisition.lock"
    lock_path.write_text("another acquisition")
    with pytest.raises(AcquisitionError, match="lock already exists"):
        run(inputs)
    assert lock_path.read_text() == "another acquisition"


def test_output_symlink_is_rejected(inputs):
    folder = destination(inputs)
    folder.mkdir(parents=True)
    unrelated = inputs["root"] / "unrelated"
    unrelated.mkdir()
    try:
        (folder / "objects").symlink_to(unrelated, target_is_directory=True)
    except OSError:
        pytest.skip("Creating directory symlinks requires developer mode on this Windows host")
    with pytest.raises(AcquisitionError, match="Symlinks"):
        run(inputs)
    assert list(unrelated.iterdir()) == []


def test_source_fetch_rejects_unapproved_hosts_without_network():
    with pytest.raises(AcquisitionError):
        fetch_github("https://example.com/repos/healthchecks/healthchecks")
