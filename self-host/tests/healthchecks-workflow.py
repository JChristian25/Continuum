"""Verify the full-tree, two-revision Healthchecks workflow against a disposable install.

Read origin, login, password, repoPath, checkout and caFile as JSON on stdin.
Write only the result to stdout. The client neither clones nor modifies the checkout.
"""

import hashlib
import io
import json
import ssl
import subprocess
import sys
import time
from http.cookiejar import CookieJar
from urllib.parse import urlsplit
from urllib.request import HTTPCookieProcessor, HTTPSHandler, Request, build_opener
from uuid import uuid4


BASELINE = "0f78e117eadb59a01dd51e09344479fa3eeb4187"
INCOMING = "c62d6648d81e1aebc65f80bddc72f165fba7320b"
DOC = "templates/docs/email.md"
CODE = "hc/api/management/commands/smtpd.py"


def envelope():
    return {"schemaVersion": "0.1.0", "requestId": str(uuid4())}


class Client:
    def __init__(self, config):
        self.origin = config["origin"].rstrip("/")
        url = urlsplit(self.origin)
        assert url.scheme == "https" and url.hostname in {"localhost", "127.0.0.1", "::1"}
        self.config = config
        self.http = build_opener(HTTPCookieProcessor(CookieJar()),
                                 HTTPSHandler(context=ssl.create_default_context(cafile=config["caFile"])))
        self.csrf = None
        self.repository = None
        self.csrf = self.api("/auth/bootstrap")["csrfToken"]
        self.api("/auth/login", {**envelope(), "login": config["login"], "password": config["password"]})
        self.csrf = self.api("/auth/session")["csrfToken"]

    def api(self, path, payload=None):
        headers = {"Origin": self.origin, "Accept": "application/json"}
        if self.csrf:
            headers["X-CSRF-Token"] = self.csrf
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode()
        request = Request(self.origin + "/api/v1" + path, headers=headers, data=body)
        with self.http.open(request, timeout=300) as response:
            return json.load(response)

    def query(self, name, payload):
        return self.api("/queries", {**envelope(), "repositoryId": self.repository,
                        "query": name, "input": payload})["result"]

    def command(self, view, name, payload):
        return self.api("/commands", {**envelope(), "repositoryId": self.repository,
                        "viewId": view, "command": name, "input": payload})["result"]

    def workspace(self, selection):
        view = self.query("select_context", selection)
        return view, self.query("read_workspace", {"snapshotId": view["snapshot"]["id"]})

    def finish(self, operation, allowed):
        deadline = time.monotonic() + 600
        while time.monotonic() < deadline:
            result = self.query("read_operation", {"operationId": operation})
            if result["status"] not in {"queued", "running"}:
                assert result["status"] in allowed, result
                return result
            time.sleep(1)
        raise TimeoutError(operation)


def git(checkout, *arguments, data=None):
    return subprocess.check_output(["git", "-C", checkout, *arguments], input=data)


def inventory(checkout, commit):
    records = git(checkout, "ls-tree", "-rz", "--full-tree", commit).split(b"\0")
    eligible = {}
    excluded = set()
    regular = {}
    for record in filter(None, records):
        metadata, raw_path = record.split(b"\t", 1)
        mode, kind, blob = metadata.decode("ascii").split()
        path = raw_path.decode("utf-8", errors="backslashreplace")
        if mode in {"100644", "100755"} and kind == "blob":
            regular[path] = blob
        else:
            excluded.add(path)
    # These two fixed trees fit in memory. Read raw blobs independently of the service.
    objects = ("\n".join(regular.values()) + "\n").encode("ascii")
    stream = io.BytesIO(git(checkout, "cat-file", "--batch", data=objects))
    for path, blob in regular.items():
        identity, kind, size = stream.readline().decode("ascii").split()
        assert identity == blob and kind == "blob"
        content = stream.read(int(size))
        assert stream.read(1) == b"\n"
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            excluded.add(path)
            continue
        if b"\0" in content:
            excluded.add(path)
        else:
            eligible[path] = (blob, hashlib.sha256(content).hexdigest(), len(content))
    return eligible, excluded


def capture(client, commit):
    checkout = client.config["checkout"]
    eligible, excluded = inventory(checkout, commit)
    payload = {**envelope(), "mode": "local_git",
               "localGit": {"repoPath": client.config["repoPath"], "commits": [commit]}}
    if client.repository is None:
        payload["name"] = "Weekly developer workflow " + str(uuid4())
        endpoint = "/workspaces"
    else:
        endpoint = f"/repositories/{client.repository}/revisions"
    start = time.monotonic()
    result = client.api(endpoint, payload)["result"]
    client.repository = result["repositoryId"]
    operation = client.finish(result["captureOperations"][0]["operationId"], {"complete"})
    selection = result["selection"]
    view, workspace = client.workspace(selection)
    observed = workspace["gitInventory"]
    assert observed["treeEntries"] == len(eligible) + len(excluded)
    assert observed["capturedPaths"] == len(eligible) and observed["selectedPaths"] is None
    assert {row["path"] for row in observed["excluded"]} == excluded
    assert all(row["reason"] for row in observed["excluded"])
    for coverage in [operation["coverage"], workspace["snapshot"]["coverage"]]:
        ingestion = next(row for row in coverage if row["function"] == "ingestion")
        assert ingestion["eligibleCount"] == ingestion["processedCount"] == len(eligible)
        assert ingestion["excludedCount"] == len(excluded)
    artifacts = {row["path"]: row for row in workspace["artifacts"]}
    assert len(artifacts) == len(workspace["artifacts"])
    observed_digests = {path: (row["identity"]["blobId"], row["contentDigest"]) for path, row in artifacts.items()}
    assert observed_digests == {path: info[:2] for path, info in eligible.items()}, "Git inventory mismatch"
    author, subject = git(checkout, "show", "-s", "--format=%an%n%s", commit).decode().splitlines()
    metadata = workspace["revisionMeta"]["target"]
    assert metadata["authorName"] == author and metadata["subject"] == subject
    endpoint = f"/repositories/{client.repository}/versions/{artifacts[CODE]['versionId']}"
    content = client.api(endpoint)["content"]
    assert content.encode("utf-8") == git(checkout, "show", commit + ":" + CODE)
    blame = client.api(endpoint + "/blame")
    assert blame["available"] and blame["totalLines"] == len(content.splitlines()) and blame["fileHistory"]
    evidence = {"commit": commit, "captureId": operation["id"], "eligibleFiles": len(eligible),
                "trackedEntries": observed["treeEntries"], "excludedCount": len(excluded),
                "contentBytes": sum(size for _, _, size in eligible.values()),
                "author": author, "subject": subject, "blamedLines": blame["totalLines"],
                "fileHistoryEntries": len(blame["fileHistory"]), "elapsedSeconds": round(time.monotonic() - start, 2)}
    return selection, view, artifacts, evidence


def workflow(config):
    start = time.monotonic()
    client = Client(config)
    baseline, view, artifacts, first = capture(client, BASELINE)
    doc, code = artifacts[DOC], artifacts[CODE]
    manual = client.command(view["repositoryViewId"], "capture_candidate", {
        "type": "documents", "sourceArtifactId": doc["artifactId"], "targetArtifactId": code["artifactId"],
        "sourceVersionId": doc["versionId"], "targetVersionId": code["versionId"],
        "evidence": [{"artifactVersionId": doc["versionId"], "locator": {"kind": "lines", "startLine": 10, "endLine": 13}}],
        "targetRevision": baseline["targetRevision"], "reason": "Verify a document relationship across two revisions.",
        "predecessorContextId": None,
    })
    view, workspace = client.workspace(baseline)
    context = manual["contextId"]
    assertion = next(row for row in workspace["assertions"] if row["projection"]["contextId"] == context)
    review = client.query("open_review_view", {"repositoryViewId": view["repositoryViewId"],
                          "snapshotId": view["snapshot"]["id"], "contextId": context})
    client.command(review["viewId"], "record_judgment", {
        "contextId": context, "assertionRevisionId": assertion["assertion"]["id"],
        "expectedProjectionVersion": assertion["projection"]["projectionVersion"],
        "decision": "confirm", "reason": "Exercise the prior-decision trail for the SMTP documentation.",
        "reviewedEvidenceIds": assertion["assertion"]["evidenceIds"], "contentConcern": None,
        "followUpDisposition": {"kind": "none"},
    })
    reviewed = client.query("read_snapshot", {"selection": baseline})
    incoming, view, _, second = capture(client, INCOMING)
    comparison = client.command(view["repositoryViewId"], "compare_revisions",
                                {"baseSnapshotId": reviewed["id"], "targetSnapshotId": view["snapshot"]["id"]})
    _, workspace = client.workspace(comparison["selection"])
    paths = git(config["checkout"], "diff", "--no-renames", "--name-only", BASELINE, INCOMING).decode().splitlines()
    assert sorted(paths) == sorted(row["path"] for row in workspace["comparison"]["changes"])
    impact = next(row for row in workspace["comparison"]["impacts"] if row["baseContextId"] == context)
    updated = next(row for row in workspace["assertions"] if row["projection"]["contextId"] == impact["contextId"])
    assert updated["projection"]["validity"] == "stale" and impact["priorDecision"]["decision"] == "confirm"
    job = client.command(view["repositoryViewId"], "discover_candidates",
                         {key: incoming[key] for key in ["targetRevision", "inventoryId", "configurationId"]})
    discovery = client.finish(job["operationId"], {"complete", "partial"})
    if discovery["status"] == "partial":
        assert discovery["limitations"]
    return {"repositoryId": client.repository, "baseline": first, "incoming": second, "changedPaths": paths,
            "validity": updated["projection"]["validity"], "priorDecision": impact["priorDecision"]["decision"],
            "discovery": {"id": discovery["id"], "status": discovery["status"], "limitations": discovery["limitations"]},
            "elapsedSeconds": round(time.monotonic() - start, 2)}


if __name__ == "__main__":
    if not __debug__:
        raise RuntimeError("Run verification with Python assertions enabled.")
    print(json.dumps(workflow(json.load(sys.stdin)), indent=2))
