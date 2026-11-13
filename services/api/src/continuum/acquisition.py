"""Bounded operator acquisition; never runs on an HTTP request or executes source."""

import argparse
import base64
import binascii
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

WORKSPACE = Path(__file__).resolve().parents[4]
REPOSITORY = "healthchecks/healthchecks"
REPOSITORY_ID = 38067078
API = f"https://api.github.com/repos/{REPOSITORY}"
HEX40 = re.compile(r"[0-9a-f]{40}\Z")


class AcquisitionError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise AcquisitionError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def contained(path, root):
    resolved = path.resolve()
    require(resolved.is_relative_to(root.resolve()), "Path leaves the authorized workspace")
    require(path.absolute() == resolved, "Symlinks, junctions and indirect filesystem paths are not authorized")
    return resolved


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        raise AcquisitionError("Acquisition redirects are not authorized")


def fetch_github(url):
    require(url.startswith(API + "/") or url == API, "Source URL is outside the authorized repository API")
    request = urllib.request.Request(url, headers={"User-Agent": "Continuum-bounded-acquisition/0.1",
                                                 "Accept": "application/vnd.github+json"})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        raw = response.read(8 * 1048576 + 1)
        require(len(raw) <= 8 * 1048576, "Metadata response exceeds the acquisition limit")
        return json.loads(raw)


def load_accepted(manifest_path, acceptance_path, root):
    manifest_bytes = contained(manifest_path, root).read_bytes()
    acceptance_bytes = contained(acceptance_path, root).read_bytes()
    manifest, acceptance = json.loads(manifest_bytes), json.loads(acceptance_bytes)
    manifest_digest = sha256(manifest_bytes)
    require(acceptance.get("schemaVersion") == "acceptance-0.1.0", "Unknown acceptance schema")
    require(acceptance.get("localAcquisition") is True, "Local acquisition is not accepted")
    require(acceptance.get("manifestSha256") == manifest_digest, "Accepted manifest digest differs")
    require(manifest.get("id") == acceptance.get("proposalId"), "Acceptance identifies another proposal")
    require(manifest["repository"]["fullName"] == acceptance.get("repositoryFullName") == REPOSITORY,
            "Repository name is outside the accepted source")
    require(manifest["repository"]["githubId"] == acceptance.get("repositoryId") == REPOSITORY_ID,
            "Repository identity is outside the accepted source")
    require(0 < len(manifest["entries"]) <= acceptance["maximumPaths"] <= 10, "Path limit exceeded")
    require(0 < len(manifest["revisions"]) <= acceptance["maximumRevisions"] <= 4, "Revision limit exceeded")
    require(0 < acceptance["maximumFileBytes"] <= 1048576, "Invalid file byte limit")
    require(0 < acceptance["maximumUniqueBlobBytes"] <= 4194304, "Invalid total byte limit")
    for revision in manifest["revisions"].values():
        require(revision["objectAlgorithm"] == "sha1" and HEX40.fullmatch(revision["commitId"])
                and HEX40.fullmatch(revision["treeId"]), "Invalid immutable revision identity")
        require(all(HEX40.fullmatch(parent) for parent in revision["parentIds"]), "Invalid parent identity")
    paths, blobs = set(), {}
    for entry in manifest["entries"]:
        path = entry["path"]
        pure = PurePosixPath(path)
        require(isinstance(path, str) and path == str(pure) and not pure.is_absolute()
                and ".." not in pure.parts and "\\" not in path and ":" not in path,
                "Invalid repository-relative path")
        require(path not in paths, "Duplicate inventory path")
        paths.add(path)
        suffix = pure.suffix
        require((entry["kind"], entry["format"], suffix) in {
            ("code", "Python", ".py"), ("document", "Markdown", ".md"),
            ("document", "plain-text", ".txt")}, "Unsupported declared input format")
        require(set(entry["revisions"]) == set(manifest["revisions"]), "Incomplete revision bindings")
        for label, version in entry["revisions"].items():
            require(version["commit"] == manifest["revisions"][label]["commitId"], "Mismatched commit binding")
            require(version["mode"] == "100644" and version["type"] == "blob", "Only regular files are authorized")
            require(HEX40.fullmatch(version["blobId"]), "Invalid blob identity")
            require(type(version["sizeBytes"]) is int and 0 <= version["sizeBytes"] <= acceptance["maximumFileBytes"], "File byte limit exceeded")
            prior_size = blobs.setdefault(version["blobId"], version["sizeBytes"])
            require(prior_size == version["sizeBytes"], "Inconsistent blob sizes")
    require(sum(blobs.values()) <= acceptance["maximumUniqueBlobBytes"], "Total byte limit exceeded")
    return manifest, acceptance, manifest_digest, sha256(acceptance_bytes), blobs


def write_retained(path, data):
    if path.exists():
        require(path.read_bytes() == data, "Retained acquisition artifact differs; refusing overwrite")
    else:
        with path.open("xb") as stream:
            stream.write(data)


def acquire(manifest_path, acceptance_path, *, root=WORKSPACE, fetch=fetch_github):
    root = root.resolve()
    manifest, acceptance, manifest_digest, acceptance_digest, blobs = load_accepted(manifest_path, acceptance_path, root)
    destination = contained(root / "inputs" / "healthchecks" / manifest_digest, root)
    objects = contained(destination / "objects", root)
    objects.mkdir(parents=True, exist_ok=True)
    lock_path = contained(destination / ".acquisition.lock", root)
    try:
        lock = lock_path.open("x")
    except FileExistsError as exc:
        raise AcquisitionError("Acquisition lock already exists; inspect its owner before retrying") from exc
    started = time.monotonic()

    def read(url):
        require(time.monotonic() - started < 120, "Acquisition deadline exceeded")
        return fetch(url)

    try:
        repository = read(API)
        require(repository["id"] == REPOSITORY_ID and repository["full_name"] == REPOSITORY
                and repository["private"] is False, "Upstream repository identity or visibility differs")
        for label, revision in manifest["revisions"].items():
            commit = read(API + "/git/commits/" + revision["commitId"])
            require(commit["sha"] == revision["commitId"] and commit["tree"]["sha"] == revision["treeId"]
                    and [parent["sha"] for parent in commit["parents"]] == revision["parentIds"], "Upstream commit identity differs")
            tree = read(API + "/git/trees/" + revision["treeId"] + "?recursive=1")
            require(tree["sha"] == revision["treeId"] and tree.get("truncated") is False, "Upstream tree is incomplete or differs")
            entries = {entry["path"]: entry for entry in tree["tree"]}
            for selected in manifest["entries"]:
                expected, actual = selected["revisions"][label], entries.get(selected["path"])
                require(actual is not None and all(actual[key] == value for key, value in {
                    "sha": expected["blobId"], "size": expected["sizeBytes"], "mode": "100644", "type": "blob"}.items()),
                    "Upstream selected tree entry differs")
        records = []
        for identity, size in sorted(blobs.items()):
            path = contained(objects / identity, root)
            if path.exists():
                require(path.stat().st_size == size, "Retained source size differs")
                data = path.read_bytes()
            else:
                blob = read(API + "/git/blobs/" + identity)
                require(blob["sha"] == identity and blob["size"] == size and blob["encoding"] == "base64", "Upstream blob metadata differs")
                try:
                    data = base64.b64decode("".join(blob["content"].split()), validate=True)
                except binascii.Error as exc:
                    raise AcquisitionError("Upstream blob encoding is invalid") from exc
            require(len(data) == size and blob_sha(data) == identity, "Source bytes do not match the declared Git blob")
            try:
                data.decode("utf-8", errors="strict")
            except UnicodeDecodeError as exc:
                raise AcquisitionError("Selected source is not strict UTF-8") from exc
            write_retained(path, data)
            records.append({"blobId": identity, "sizeBytes": size, "contentSha256": sha256(data)})
        manifest_bytes, acceptance_bytes = manifest_path.read_bytes(), acceptance_path.read_bytes()
        require(sha256(manifest_bytes) == manifest_digest and sha256(acceptance_bytes) == acceptance_digest,
                "Manifest or acceptance changed during acquisition")
        write_retained(contained(destination / "manifest.json", root), manifest_bytes)
        write_retained(contained(destination / "acceptance.json", root), acceptance_bytes)
        receipt_path = contained(destination / "acquired.json", root)
        if receipt_path.exists():
            receipt = json.loads(receipt_path.read_bytes())
            require(receipt["manifestSha256"] == manifest_digest and receipt["acceptanceSha256"] == acceptance_digest
                    and receipt["objects"] == records and receipt["status"] == "acquired",
                    "Retained acquisition receipt differs")
            return receipt
        receipt = {
            "schemaVersion": "acquisition-0.1.0", "status": "acquired", "manifestId": manifest["id"],
            "manifestSha256": manifest_digest, "acceptanceId": acceptance["id"], "acceptanceSha256": acceptance_digest,
            "repositoryId": REPOSITORY_ID, "repositoryFullName": REPOSITORY,
            "acquiredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "methodId": "github-rest-immutable-objects-v1", "objects": records,
            "selectedPathCount": len(manifest["entries"]), "revisionCount": len(manifest["revisions"]),
            "coverage": {"sourceAcquisition": "complete_for_selected_inventory", "applicationCapture": "not_run",
                         "extraction": "not_run", "discovery": "not_run", "comparison": "not_run"},
            "limitations": ["Only the accepted file inventory was acquired.",
                            "No upstream code or tests were executed.", "Acquisition is not application integration."],
        }
        write_retained(receipt_path, (json.dumps(receipt, indent=2) + "\n").encode("utf-8"))
        return receipt
    finally:
        lock.close()
        lock_path.unlink()


def main():
    parser = argparse.ArgumentParser(description="Acquire only accepted Healthchecks Git objects; never execute source")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--acceptance", type=Path, required=True)
    arguments = parser.parse_args()
    try:
        result = acquire(arguments.manifest, arguments.acceptance)
    except (AcquisitionError, KeyError, TypeError, OSError, json.JSONDecodeError) as exc:
        parser.exit(1, f"Acquisition did not complete: {exc}\nVerified objects may remain; no new successful receipt was published.\n")
    print(f"Acquired {len(result['objects'])} verified blobs for {result['selectedPathCount']} paths at {result['revisionCount']} revisions.")
    print("Manifest SHA-256:", result["manifestSha256"])
    print("Application capture, discovery and comparison were not run.")


if __name__ == "__main__":
    main()
