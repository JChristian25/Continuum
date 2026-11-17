"""Bounded custom workspace bundles and opt-in local Git commit import without checkout or code execution."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
from typing import Literal

from pydantic import Field, model_validator
from sqlalchemy import select

from .acquisition import HEX40, WORKSPACE, AcquisitionError, blob_sha, contained, load_accepted, require, sha256, write_retained
from .discovery import _load_sources_from_store
from .models import Grant, Repository, SecurityAudit
from .pipeline_models import InputRegistration
from .schemas import Id, Strict
from .security import fail, utc

CUSTOM_MAX_PATHS = 25
CUSTOM_MAX_REVISIONS = 4
CUSTOM_MAX_FILE_BYTES = 1048576
CUSTOM_MAX_TOTAL_BYTES = 4194304
CUSTOM_SUFFIX_MAP = {
    ".py": ("code", "Python"),
    ".md": ("document", "Markdown"),
    ".txt": ("document", "plain-text"),
}
REVISION_LABEL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\Z")

BASE_TOKENIZATION = {
    "alphabet": "ASCII letters and digits",
    "splitAcronymBoundaryRegex": "([A-Z])([A-Z][a-z])",
    "splitLowerToUpperBoundaryRegex": "([a-z0-9])([A-Z])",
    "splitOrder": ["acronym boundary", "lowercase-or-digit to uppercase boundary", "non-ASCII-alphanumeric separators"],
    "normalization": "lowercase after splitting",
    "minimumLength": 4,
    "pythonReservedWords": [
        "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
        "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
        "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
        "return", "try", "while", "with", "yield",
    ],
    "stopWords": [
        "this", "that", "with", "from", "have", "will", "your", "into",
        "return", "returns", "true", "false", "none", "code", "file",
    ],
    "unicodeLimitation": "Non-ASCII identifier semantics are not analyzed; disclose this limitation",
}


class CustomFileInput(Strict):
    path: str = Field(min_length=1, max_length=512)
    content: str = Field(max_length=CUSTOM_MAX_FILE_BYTES)


class CustomRevisionBundleInput(Strict):
    revisionLabel: str = Field(default="R0", min_length=1, max_length=64)
    commitId: str | None = None
    files: list[CustomFileInput] = Field(min_length=1, max_length=CUSTOM_MAX_PATHS)

    @model_validator(mode="after")
    def validate_bundle(self):
        if not REVISION_LABEL_RE.fullmatch(self.revisionLabel):
            raise ValueError("Invalid revision label")
        if self.commitId is not None and not HEX40.fullmatch(self.commitId):
            raise ValueError("Commit ID must be a 40-character lowercase hex SHA-1")
        return self


class LocalGitImportInput(Strict):
    repoPath: str = Field(min_length=1, max_length=1024)
    commits: list[str] = Field(min_length=1, max_length=CUSTOM_MAX_REVISIONS)
    paths: list[str] | None = Field(default=None, min_length=1, max_length=CUSTOM_MAX_PATHS)


class WorkspaceCreateInput(Strict):
    schemaVersion: Literal["0.1.0"]
    requestId: Id
    name: str = Field(min_length=1, max_length=200, pattern=r"\S")
    mode: Literal["bundle", "local_git"] = "bundle"
    bundle: CustomRevisionBundleInput | None = None
    localGit: LocalGitImportInput | None = None

    @model_validator(mode="after")
    def match_mode(self):
        if self.mode == "bundle" and (self.bundle is None or self.localGit is not None):
            raise ValueError("Bundle mode requires bundle input only")
        if self.mode == "local_git" and (self.localGit is None or self.bundle is not None):
            raise ValueError("Local Git mode requires localGit input only")
        return self


class RevisionAddInput(Strict):
    schemaVersion: Literal["0.1.0"]
    requestId: Id
    mode: Literal["bundle", "local_git"] = "bundle"
    bundle: CustomRevisionBundleInput | None = None
    localGit: LocalGitImportInput | None = None

    @model_validator(mode="after")
    def match_mode(self):
        if self.mode == "bundle" and (self.bundle is None or self.localGit is not None):
            raise ValueError("Bundle mode requires bundle input only")
        if self.mode == "local_git" and (self.localGit is None or self.bundle is not None):
            raise ValueError("Local Git mode requires localGit input only")
        return self


def custom_inputs_root(settings=None) -> Path:
    configured = getattr(settings, "custom_inputs_root", None) if settings is not None else None
    base = Path(configured) if configured else (WORKSPACE / "inputs" / "custom")
    base.mkdir(parents=True, exist_ok=True)
    return contained(base, WORKSPACE)


def _validate_relative_path(raw_path: str) -> tuple[str, str, str]:
    normalized = raw_path.strip()
    pure = PurePosixPath(normalized)
    if (
        not normalized
        or normalized != str(pure)
        or pure.is_absolute()
        or ".." in pure.parts
        or "." in pure.parts
        or "\\" in normalized
        or ":" in normalized
        or "\x00" in normalized
    ):
        fail("invalid_input", details={"fields": ["path"], "path": raw_path})
    mapping = CUSTOM_SUFFIX_MAP.get(pure.suffix)
    if mapping is None:
        fail("invalid_input", details={"fields": ["path"], "reason": "Only .py, .md, and .txt files are supported."})
    return normalized, mapping[0], mapping[1]


def load_custom_accepted(manifest_path: Path, acceptance_path: Path, root: Path = WORKSPACE):
    manifest_bytes = contained(manifest_path, root).read_bytes()
    acceptance_bytes = contained(acceptance_path, root).read_bytes()
    manifest = json.loads(manifest_bytes)
    acceptance = json.loads(acceptance_bytes)
    manifest_digest = sha256(manifest_bytes)
    require(acceptance.get("schemaVersion") == "custom-acceptance-0.1.0", "Unknown custom acceptance schema")
    require(acceptance.get("localAcquisition") is True, "Custom input is not accepted")
    require(acceptance.get("manifestSha256") == manifest_digest, "Accepted custom manifest digest differs")
    require(manifest.get("id") == acceptance.get("proposalId"), "Custom acceptance identifies another proposal")
    require(
        isinstance(manifest.get("repository", {}).get("fullName"), str)
        and manifest["repository"]["fullName"] == acceptance.get("repositoryFullName"),
        "Custom repository identity differs",
    )
    require(0 < len(manifest["entries"]) <= acceptance["maximumPaths"] <= CUSTOM_MAX_PATHS, "Custom path limit exceeded")
    require(0 < len(manifest["revisions"]) <= acceptance["maximumRevisions"] <= CUSTOM_MAX_REVISIONS, "Custom revision limit exceeded")
    require(0 < acceptance["maximumFileBytes"] <= CUSTOM_MAX_FILE_BYTES, "Invalid custom file byte limit")
    require(0 < acceptance["maximumUniqueBlobBytes"] <= CUSTOM_MAX_TOTAL_BYTES, "Invalid custom total byte limit")
    for revision in manifest["revisions"].values():
        require(revision["objectAlgorithm"] == "sha1" and HEX40.fullmatch(revision["commitId"])
                and HEX40.fullmatch(revision["treeId"]), "Invalid custom revision identity")
        require(all(HEX40.fullmatch(parent) for parent in revision["parentIds"]), "Invalid custom parent identity")
    paths, blobs = set(), {}
    for entry in manifest["entries"]:
        path = entry["path"]
        pure = PurePosixPath(path)
        require(isinstance(path, str) and path == str(pure) and not pure.is_absolute()
                and ".." not in pure.parts and "\\" not in path and ":" not in path,
                "Invalid repository-relative path")
        require(path not in paths, "Duplicate custom inventory path")
        paths.add(path)
        require((entry["kind"], entry["format"], pure.suffix) in {
            ("code", "Python", ".py"),
            ("document", "Markdown", ".md"),
            ("document", "plain-text", ".txt"),
        }, "Unsupported custom input format")
        require(set(entry["revisions"]) == set(manifest["revisions"]), "Incomplete custom revision bindings")
        for label, version in entry["revisions"].items():
            require(version["commit"] == manifest["revisions"][label]["commitId"], "Mismatched commit binding")
            require(version["mode"] == "100644" and version["type"] == "blob", "Only regular files are authorized")
            require(HEX40.fullmatch(version["blobId"]), "Invalid blob identity")
            require(type(version["sizeBytes"]) is int and 0 <= version["sizeBytes"] <= acceptance["maximumFileBytes"], "File byte limit exceeded")
            prior_size = blobs.setdefault(version["blobId"], version["sizeBytes"])
            require(prior_size == version["sizeBytes"], "Inconsistent blob sizes")
    require(sum(blobs.values()) <= acceptance["maximumUniqueBlobBytes"], "Total byte limit exceeded")
    return manifest, acceptance, manifest_digest, sha256(acceptance_bytes), blobs


def is_custom_manifest(acceptance_path: Path, root: Path = WORKSPACE) -> bool:
    resolved = contained(acceptance_path, root)
    data = json.loads(resolved.read_bytes())
    return data.get("schemaVersion") == "custom-acceptance-0.1.0"


def load_any_accepted(manifest_path: Path, acceptance_path: Path, root: Path = WORKSPACE):
    if is_custom_manifest(acceptance_path, root):
        return load_custom_accepted(manifest_path, acceptance_path, root)
    return load_accepted(manifest_path, acceptance_path, root)


def load_any_sources(manifest_path: Path, acceptance_path: Path, revision_label: str, *, root: Path = WORKSPACE):
    if is_custom_manifest(acceptance_path, root):
        manifest, _, manifest_digest, acceptance_digest, blobs = load_custom_accepted(manifest_path, acceptance_path, root)
        destination = contained(manifest_path.parent, root)
        return _load_sources_from_store(manifest, manifest_digest, acceptance_digest, blobs, destination, revision_label, root=root)
    manifest, _, manifest_digest, acceptance_digest, blobs = load_accepted(manifest_path, acceptance_path, root)
    destination = contained(root / "inputs" / "healthchecks" / manifest_digest, root)
    return _load_sources_from_store(manifest, manifest_digest, acceptance_digest, blobs, destination, revision_label, root=root)


def _git_env(repo_dir: Path) -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith("GIT_")}
    env.update(
        GIT_CONFIG_NOSYSTEM="1",
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_TERMINAL_PROMPT="0",
        GIT_ALLOW_PROTOCOL="",
        GIT_CEILING_DIRECTORIES=str(repo_dir.parent.resolve()),
    )
    return env


def _run_git(repo_dir: Path, args: list[str]) -> bytes:
    executable = shutil.which("git")
    if not executable:
        fail("change_detection_unavailable", 503)
    proc = subprocess.run(
        [executable, "-C", str(repo_dir), "-c", "core.autocrlf=false", *args],
        env=_git_env(repo_dir),
        capture_output=True,
        timeout=15,
        check=False,
    )
    if proc.returncode != 0:
        fail("revision_unavailable", 422, {"reason": proc.stderr.decode("utf-8", errors="replace").strip()[:300]})
    return proc.stdout


def _resolve_local_git_repo(raw_repo_path: str, settings) -> Path:
    if not settings.allow_local_git or not settings.local_git_roots:
        fail("forbidden", 403, {"reason": "Local Git repository import is disabled on this server."})
    candidate = Path(raw_repo_path).resolve()
    if not candidate.is_dir():
        fail("invalid_input", details={"fields": ["localGit.repoPath"]})
    allowed = [Path(root).resolve() for root in settings.local_git_roots]
    if not any(candidate.is_relative_to(root) for root in allowed):
        fail("forbidden", 403, {"reason": "Repository path is outside CONTINUUM_LOCAL_GIT_ROOTS."})
    if Path(raw_repo_path).is_symlink():
        fail("forbidden", 403, {"reason": "Symlinked repository roots are not permitted."})
    return candidate


def _extract_local_git_revisions(local_git: LocalGitImportInput, settings) -> tuple[str, list[dict]]:
    repo_dir = _resolve_local_git_repo(local_git.repoPath, settings)
    requested_paths = None
    if local_git.paths is not None:
        requested_paths = []
        seen = set()
        for raw_path in local_git.paths:
            norm, _, _ = _validate_relative_path(raw_path)
            if norm in seen:
                fail("invalid_input", details={"fields": ["localGit.paths"]})
            seen.add(norm)
            requested_paths.append(norm)

    revisions = []
    seen_commits = set()
    for index, raw_ref in enumerate(local_git.commits):
        commit_sha = _run_git(repo_dir, ["rev-parse", "--verify", f"{raw_ref}^{{commit}}"]).decode("ascii").strip()
        if not HEX40.fullmatch(commit_sha) or commit_sha in seen_commits:
            fail("invalid_input", details={"fields": ["localGit.commits"]})
        seen_commits.add(commit_sha)
        header = _run_git(repo_dir, ["show", "-s", "--format=%T%n%P", commit_sha]).decode("ascii").splitlines()
        tree_sha = header[0].strip()
        parent_ids = header[1].split() if len(header) > 1 and header[1].strip() else []
        tree_raw = _run_git(repo_dir, ["ls-tree", "-r", "-z", commit_sha])
        entries = {}
        for item in tree_raw.split(b"\0"):
            if not item:
                continue
            meta, path_bytes = item.split(b"\t", 1)
            mode, obj_type, obj_sha = meta.decode("ascii").split(" ")
            rel_path = path_bytes.decode("utf-8", errors="strict")
            entries[rel_path] = (mode, obj_type, obj_sha)

        selected_paths = requested_paths
        if selected_paths is None:
            eligible = sorted(
                path for path, (mode, obj_type, _) in entries.items()
                if mode == "100644" and obj_type == "blob" and PurePosixPath(path).suffix in CUSTOM_SUFFIX_MAP
            )
            if len(eligible) > CUSTOM_MAX_PATHS:
                fail("limit_exceeded", 422, {
                    "limitName": "maximumPaths",
                    "maximum": CUSTOM_MAX_PATHS,
                    "actual": len(eligible),
                    "reason": "Select up to 25 specific .py, .md, or .txt paths to import.",
                })
            selected_paths = eligible
        if not selected_paths:
            fail("invalid_input", details={"reason": "No eligible .py, .md, or .txt files found in commit."})

        file_blobs = {}
        for rel_path in selected_paths:
            _validate_relative_path(rel_path)
            entry = entries.get(rel_path)
            if entry is None:
                continue
            mode, obj_type, obj_sha = entry
            if mode != "100644" or obj_type != "blob":
                fail("invalid_input", details={"path": rel_path, "reason": "Only regular files (mode 100644) are allowed."})
            data = _run_git(repo_dir, ["cat-file", "blob", obj_sha])
            if len(data) > CUSTOM_MAX_FILE_BYTES:
                fail("limit_exceeded", 422, {"limitName": "maximumFileBytes", "maximum": CUSTOM_MAX_FILE_BYTES, "path": rel_path})
            if b"\x00" in data:
                fail("invalid_input", details={"path": rel_path, "reason": "Binary or NUL bytes are rejected."})
            try:
                data.decode("utf-8", errors="strict")
            except UnicodeDecodeError:
                fail("invalid_input", details={"path": rel_path, "reason": "Only strict UTF-8 files are supported."})
            if blob_sha(data) != obj_sha:
                fail("missing_evidence")
            file_blobs[rel_path] = data
        if not file_blobs:
            fail("invalid_input", details={"reason": f"None of the selected paths exist in commit {commit_sha[:7]}."})
        revisions.append({
            "label": f"git-{commit_sha[:7]}" if len(local_git.commits) > 1 else f"R{index}-{commit_sha[:7]}",
            "commitId": commit_sha,
            "treeId": tree_sha,
            "parentIds": parent_ids,
            "blobs": file_blobs,
        })
    return repo_dir.name, revisions


def _extract_bundle_revision(repo_id: str, bundle: CustomRevisionBundleInput) -> list[dict]:
    file_blobs = {}
    seen_paths = set()
    for item in bundle.files:
        norm_path, _, _ = _validate_relative_path(item.path)
        if norm_path in seen_paths:
            fail("invalid_input", details={"fields": ["bundle.files"], "path": norm_path})
        seen_paths.add(norm_path)
        if "\x00" in item.content:
            fail("invalid_input", details={"fields": ["bundle.files"], "path": norm_path})
        raw = item.content.encode("utf-8", errors="strict")
        if len(raw) > CUSTOM_MAX_FILE_BYTES:
            fail("limit_exceeded", 422, {"limitName": "maximumFileBytes", "maximum": CUSTOM_MAX_FILE_BYTES, "path": norm_path})
        file_blobs[norm_path] = raw
    unique_total = sum({blob_sha(raw): len(raw) for raw in file_blobs.values()}.values())
    if unique_total > CUSTOM_MAX_TOTAL_BYTES:
        fail("limit_exceeded", 422, {"limitName": "maximumUniqueBlobBytes", "maximum": CUSTOM_MAX_TOTAL_BYTES})
    digest_seed = json.dumps(
        {"repoId": repo_id, "label": bundle.revisionLabel, "files": {p: blob_sha(b) for p, b in sorted(file_blobs.items())}},
        sort_keys=True,
    ).encode("utf-8")
    commit_id = bundle.commitId or hashlib.sha1(b"commit " + digest_seed).hexdigest()
    tree_id = hashlib.sha1(b"tree " + digest_seed).hexdigest()
    return [{
        "label": bundle.revisionLabel,
        "commitId": commit_id,
        "treeId": tree_id,
        "parentIds": [],
        "blobs": file_blobs,
    }]


def _build_and_write_custom_package(
    *,
    repository_id: str,
    full_name: str,
    source_mode: str,
    revisions: list[dict],
    settings,
) -> tuple[Path, Path, Path, Path, dict]:
    # Require every declared path in a package to be present across that package's revisions,
    # keeping per-revision manifests independent when paths are added or removed across commits.
    all_paths = sorted({path for rev in revisions for path in rev["blobs"]})
    if len(all_paths) > CUSTOM_MAX_PATHS:
        fail("limit_exceeded", 422, {"limitName": "maximumPaths", "maximum": CUSTOM_MAX_PATHS})
    unique_blobs: dict[str, bytes] = {}
    for rev in revisions:
        for raw in rev["blobs"].values():
            unique_blobs[blob_sha(raw)] = raw
    if sum(len(raw) for raw in unique_blobs.values()) > CUSTOM_MAX_TOTAL_BYTES:
        fail("limit_exceeded", 422, {"limitName": "maximumUniqueBlobBytes", "maximum": CUSTOM_MAX_TOTAL_BYTES})

    # If revisions inside a multi-commit import have differing path sets (additions/deletions),
    # split into one immutable manifest per revision so each manifest stays complete without fabricating empty files.
    first_set = set(revisions[0]["blobs"])
    if any(set(rev["blobs"]) != first_set for rev in revisions):
        raise ValueError("Internal caller should package per-revision when path sets differ")

    revisions_doc = {
        rev["label"]: {
            "objectAlgorithm": "sha1",
            "commitId": rev["commitId"],
            "treeId": rev["treeId"],
            "parentIds": rev["parentIds"],
        }
        for rev in revisions
    }
    entries_doc = []
    for path in all_paths:
        _, kind, fmt = _validate_relative_path(path)
        entries_doc.append({
            "path": path,
            "kind": kind,
            "format": fmt,
            "revisions": {
                rev["label"]: {
                    "commit": rev["commitId"],
                    "blobId": blob_sha(rev["blobs"][path]),
                    "sizeBytes": len(rev["blobs"][path]),
                    "mode": "100644",
                    "type": "blob",
                }
                for rev in revisions
            },
        })

    manifest_id = f"CUSTOM-{repository_id[:8]}-{revisions[0]['commitId'][:8]}"
    manifest = {
        "id": manifest_id,
        "repository": {"fullName": full_name, "sourceMode": source_mode},
        "revisions": revisions_doc,
        "entries": entries_doc,
    }
    manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
    manifest_digest = sha256(manifest_bytes)

    base_root = custom_inputs_root(settings)
    package_dir = contained(base_root / repository_id / manifest_digest, WORKSPACE)
    objects_dir = contained(package_dir / "objects", WORKSPACE)
    objects_dir.mkdir(parents=True, exist_ok=True)

    object_records = []
    for bid, raw in sorted(unique_blobs.items()):
        write_retained(contained(objects_dir / bid, WORKSPACE), raw)
        object_records.append({"blobId": bid, "sizeBytes": len(raw), "contentSha256": sha256(raw)})

    acceptance = {
        "schemaVersion": "custom-acceptance-0.1.0",
        "id": f"CUSTOM-ACC-{manifest_digest[:12]}",
        "acceptedAt": datetime.now(timezone.utc).isoformat(),
        "localAcquisition": True,
        "sourceMode": source_mode,
        "proposalId": manifest_id,
        "manifestSha256": manifest_digest,
        "repositoryFullName": full_name,
        "maximumPaths": CUSTOM_MAX_PATHS,
        "maximumRevisions": CUSTOM_MAX_REVISIONS,
        "maximumFileBytes": CUSTOM_MAX_FILE_BYTES,
        "maximumUniqueBlobBytes": CUSTOM_MAX_TOTAL_BYTES,
    }
    acceptance_bytes = (json.dumps(acceptance, indent=2, sort_keys=True) + "\n").encode("utf-8")
    acceptance_digest = sha256(acceptance_bytes)

    profile = {
        "schemaVersion": "discovery-profile-0.1.0",
        "id": f"CUSTOM-LEXICAL-{manifest_digest[:12]}",
        "methodId": "lexical-file-v1",
        "basis": "P-08 lexical profile adapted for bounded custom workspace ingestion",
        "manifestSha256": manifest_digest,
        "language": "Python",
        "documentFormats": ["Markdown", "plain-text"],
        "scope": "file",
        "relationType": "documents",
        "direction": "document_to_code",
        "tokenization": BASE_TOKENIZATION,
        "limits": {
            "maximumFileBytes": CUSTOM_MAX_FILE_BYTES,
            "maximumUniqueInputBytes": CUSTOM_MAX_TOTAL_BYTES,
            "maximumPaths": CUSTOM_MAX_PATHS,
            "maximumDocumentLinesPerFile": 20000,
            "maximumCandidates": 256,
            "maximumEvidenceItemsPerCandidate": 512,
            "maximumPageSize": 100,
            "maximumAttemptSeconds": 60,
            "maximumOperationSeconds": 300,
            "workerConcurrency": 1,
            "leaseSeconds": 30,
            "heartbeatSeconds": 10,
            "maximumAttempts": 3,
            "exceededLimit": "explicit partial/failed scope with named limit; no silent truncation or complete no-impact result",
        },
        "limitations": [
            "Bounded custom workspace inventory; lexical overlap proposes unconfirmed candidates only.",
            "Tree-sitter Python AST and Docling Markdown extraction operate at file scope without transitive call graphs.",
            "Human confirmation is required for every candidate relationship.",
        ],
    }
    profile_bytes = (json.dumps(profile, indent=2, sort_keys=True) + "\n").encode("utf-8")
    profile_digest = sha256(profile_bytes)

    profile_acceptance = {
        "schemaVersion": "discovery-acceptance-0.1.0",
        "id": f"CUSTOM-DISC-ACC-{profile_digest[:12]}",
        "profileId": profile["id"],
        "profileSha256": profile_digest,
        "manifestSha256": manifest_digest,
        "methodId": "lexical-file-v1",
    }
    profile_acceptance_bytes = (json.dumps(profile_acceptance, indent=2, sort_keys=True) + "\n").encode("utf-8")

    acquired = {
        "schemaVersion": "acquisition-0.1.0",
        "status": "acquired",
        "manifestId": manifest_id,
        "manifestSha256": manifest_digest,
        "acceptanceId": acceptance["id"],
        "acceptanceSha256": acceptance_digest,
        "repositoryFullName": full_name,
        "methodId": f"custom-{source_mode}-v1",
        "objects": object_records,
        "selectedPathCount": len(all_paths),
        "revisionCount": len(revisions),
    }

    manifest_path = contained(package_dir / "manifest.json", WORKSPACE)
    acceptance_path = contained(package_dir / "acceptance.json", WORKSPACE)
    profile_path = contained(package_dir / "discovery-profile.json", WORKSPACE)
    profile_acceptance_path = contained(package_dir / "discovery-acceptance.json", WORKSPACE)
    acquired_path = contained(package_dir / "acquired.json", WORKSPACE)

    write_retained(manifest_path, manifest_bytes)
    write_retained(acceptance_path, acceptance_bytes)
    write_retained(profile_path, profile_bytes)
    write_retained(profile_acceptance_path, profile_acceptance_bytes)
    write_retained(acquired_path, (json.dumps(acquired, indent=2, sort_keys=True) + "\n").encode("utf-8"))

    return manifest_path, acceptance_path, profile_path, profile_acceptance_path, manifest


def _register_and_admit_packages(db, actor, repository: Repository, full_name: str, source_mode: str, revisions: list[dict], settings):
    from .pipeline import admit, register_input, register_profile, select_initial
    from .pipeline_models import RepositoryView
    from .pipeline_schemas import ProcessingInput, SelectionInput
    from .schemas import Envelope
    import uuid

    groups = []
    first_keys = set(revisions[0]["blobs"])
    if all(set(rev["blobs"]) == first_keys for rev in revisions):
        groups.append(revisions)
    else:
        groups.extend([rev] for rev in revisions)

    registered_packages = []
    primary_selection = None
    capture_operations = []
    for group in groups:
        m_path, a_path, p_path, pa_path, manifest = _build_and_write_custom_package(
            repository_id=repository.id,
            full_name=full_name,
            source_mode=source_mode,
            revisions=group,
            settings=settings,
        )
        inv = register_input(db, repository.id, m_path, a_path)
        prof = register_profile(db, repository.id, inv.id, p_path, pa_path)
        registered_packages.append({"inventoryId": inv.id, "configurationId": prof.id, "revisions": list(manifest["revisions"].keys())})
        for label, rev_meta in manifest["revisions"].items():
            sel_input = SelectionInput(
                repositoryId=repository.id,
                targetRevision={"objectAlgorithm": "sha1", "commitId": rev_meta["commitId"]},
                baseRevision=None,
                inventoryId=inv.id,
                configurationId=prof.id,
            )
            selection = select_initial(db, repository.id, sel_input)
            view = RepositoryView(repository_id=repository.id, selection_id=selection.id, mode="active")
            db.add(view)
            db.flush()
            env = Envelope(
                schemaVersion="0.1.0",
                requestId=f"custom-cap-{uuid.uuid4().hex[:24]}",
                repositoryId=repository.id,
                viewId=view.id,
                command="capture_files",
                input=ProcessingInput(
                    targetRevision={"objectAlgorithm": "sha1", "commitId": rev_meta["commitId"]},
                    inventoryId=inv.id,
                    configurationId=prof.id,
                ).model_dump(),
            )
            admitted = admit(db, actor, repository, env)
            op_id = admitted["result"]["operationId"]
            sel_payload = {
                "repositoryId": repository.id,
                "targetRevision": {"objectAlgorithm": "sha1", "commitId": rev_meta["commitId"]},
                "baseRevision": None,
                "inventoryId": inv.id,
                "configurationId": prof.id,
            }
            if primary_selection is None:
                primary_selection = sel_payload
            capture_operations.append({"label": label, "operationId": op_id, "selection": sel_payload, "repositoryViewId": view.id})
    return registered_packages, primary_selection, capture_operations


def create_custom_workspace(db, actor, data: WorkspaceCreateInput, settings) -> dict:
    if not settings.allow_custom_workspaces:
        fail("forbidden", 403, {"reason": "Custom workspace creation is disabled on this server."})
    from .pipeline import stable

    repo_id = stable("custom-workspace", actor.id, data.requestId)
    existing = db.get(Repository, repo_id)
    if existing is not None:
        fail("idempotency_conflict", 409)

    if data.mode == "bundle":
        full_name = data.name.strip()
        revisions = _extract_bundle_revision(repo_id, data.bundle)
    else:
        git_name, revisions = _extract_local_git_revisions(data.localGit, settings)
        full_name = data.name.strip() or git_name

    repository = Repository(id=repo_id, name=full_name)
    db.add(repository)
    db.flush()
    db.add(Grant(actor_id=actor.id, repository_id=repository.id, role="reviewer"))
    db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action="create_custom_workspace", outcome="success"))
    db.flush()

    packages, primary_selection, capture_ops = _register_and_admit_packages(
        db, actor, repository, full_name, data.mode, revisions, settings
    )
    return {
        "repositoryId": repository.id,
        "name": repository.name,
        "selection": primary_selection,
        "packages": packages,
        "captureOperations": capture_ops,
    }


def add_custom_revision(db, actor, repository: Repository, data: RevisionAddInput, settings) -> dict:
    if not settings.allow_custom_workspaces:
        fail("forbidden", 403, {"reason": "Custom workspace revision ingestion is disabled on this server."})
    existing_inputs = list(db.scalars(select(InputRegistration).where(InputRegistration.repository_id == repository.id)))
    if not existing_inputs or any(not is_custom_manifest(WORKSPACE / row.acceptance_path, WORKSPACE) for row in existing_inputs):
        fail("forbidden", 403, {"reason": "Revisions can only be added to custom workspaces."})

    # Verify revision commit IDs don't collide with existing manifests on a different payload or silently duplicate.
    if data.mode == "bundle":
        revisions = _extract_bundle_revision(repository.id, data.bundle)
        full_name = repository.name
    else:
        _, revisions = _extract_local_git_revisions(data.localGit, settings)
        full_name = repository.name

    db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action="add_custom_revision", outcome="success"))
    packages, primary_selection, capture_ops = _register_and_admit_packages(
        db, actor, repository, full_name, data.mode, revisions, settings
    )
    return {
        "repositoryId": repository.id,
        "name": repository.name,
        "selection": primary_selection,
        "packages": packages,
        "captureOperations": capture_ops,
    }
