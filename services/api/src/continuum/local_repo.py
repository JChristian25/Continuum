"""Full Git repository cloning, local Git repository ingestion, and custom workspace bundles."""

from datetime import datetime, timezone
import hashlib
import codecs
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, model_validator
from sqlalchemy import select

from .acquisition import HEX40, WORKSPACE, AcquisitionError, blob_sha, contained, load_accepted, require, sha256, write_retained
from .discovery import _load_sources_from_store
from .git_lens import get_commit_metadata, list_repo_commits, readonly_git_env, run_git_readonly
from .models import Grant, Receipt, Repository, SecurityAudit
from .pipeline_models import InputRegistration, Operation
from .schemas import Id, Strict
from .security import fail, repository_access, utc

CUSTOM_MAX_PATHS = 25
CUSTOM_MAX_REVISIONS = 4
CUSTOM_MAX_FILE_BYTES = 1048576
CUSTOM_MAX_TOTAL_BYTES = 4194304

GIT_MAX_TOTAL_BYTES = 250 * 1048576

CUSTOM_SUFFIX_MAP = {
    ".py": ("code", "Python"),
    ".md": ("document", "Markdown"),
    ".txt": ("document", "plain-text"),
}

GIT_SUFFIX_MAP = {
    ".py": ("code", "Python"),
    ".md": ("document", "Markdown"),
    ".markdown": ("document", "Markdown"),
    ".txt": ("document", "plain-text"),
    ".rst": ("document", "plain-text"),
    ".example": ("document", "plain-text"),
    ".html": ("code", "HTML"),
    ".html-fragment": ("code", "HTML"),
    ".htm": ("code", "HTML"),
    ".js": ("code", "JavaScript"),
    ".mjs": ("code", "JavaScript"),
    ".cjs": ("code", "JavaScript"),
    ".jsx": ("code", "JavaScript"),
    ".ts": ("code", "TypeScript"),
    ".tsx": ("code", "TypeScript"),
    ".css": ("code", "CSS"),
    ".less": ("code", "Less"),
    ".scss": ("code", "SCSS"),
    ".yml": ("code", "YAML"),
    ".yaml": ("code", "YAML"),
    ".json": ("code", "JSON"),
    ".toml": ("code", "TOML"),
    ".ini": ("code", "Config"),
    ".cfg": ("code", "Config"),
    ".conf": ("code", "Config"),
    ".sh": ("code", "Shell"),
    ".bash": ("code", "Shell"),
    ".sql": ("code", "SQL"),
    ".svg": ("document", "SVG"),
}

GIT_BASENAME_MAP = {
    "Dockerfile": ("code", "Dockerfile"),
    "Makefile": ("code", "Makefile"),
    "Procfile": ("code", "Config"),
    "LICENSE": ("document", "plain-text"),
    "AUTHORS": ("document", "plain-text"),
    "NOTICE": ("document", "plain-text"),
    "README": ("document", "plain-text"),
    "CHANGELOG": ("document", "plain-text"),
}

ALLOWED_CUSTOM_FORMATS = set(CUSTOM_SUFFIX_MAP.values()) | set(GIT_SUFFIX_MAP.values()) | set(GIT_BASENAME_MAP.values())

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
    commits: list[str] | None = None
    maxCommits: int = Field(default=4, ge=1)
    paths: list[str] | None = None


class GitCloneImportInput(Strict):
    repoUrl: str = Field(min_length=1, max_length=1024)
    branch: str | None = Field(default=None, max_length=200)
    commits: list[str] | None = None
    maxCommits: int = Field(default=4, ge=1)
    paths: list[str] | None = None


class GitInspectInput(Strict):
    schemaVersion: Literal["0.1.0"] = "0.1.0"
    requestId: Id
    repoPath: str | None = Field(default=None, max_length=1024)
    repoUrl: str | None = Field(default=None, max_length=1024)
    branch: str | None = Field(default=None, max_length=200)
    limit: int = Field(default=30, ge=1, le=100)


class WorkspaceCreateInput(Strict):
    schemaVersion: Literal["0.1.0"]
    requestId: Id
    runDiscovery: bool = False
    name: str = Field(default="", max_length=200)
    mode: Literal["bundle", "local_git", "git_clone"] = "bundle"
    bundle: CustomRevisionBundleInput | None = None
    localGit: LocalGitImportInput | None = None
    gitClone: GitCloneImportInput | None = None

    @model_validator(mode="after")
    def match_mode(self):
        if self.mode == "bundle":
            if self.bundle is None or self.localGit is not None or self.gitClone is not None or not self.name.strip():
                raise ValueError("Bundle mode requires name and bundle input only")
        elif self.mode == "local_git":
            if self.localGit is None or self.bundle is not None or self.gitClone is not None:
                raise ValueError("Local Git mode requires localGit input only")
        elif self.mode == "git_clone":
            if self.gitClone is None or self.bundle is not None or self.localGit is not None:
                raise ValueError("Git clone mode requires gitClone input only")
        return self


class RevisionAddInput(Strict):
    schemaVersion: Literal["0.1.0"]
    requestId: Id
    runDiscovery: bool = False
    mode: Literal["bundle", "local_git", "git_clone"] = "bundle"
    bundle: CustomRevisionBundleInput | None = None
    localGit: LocalGitImportInput | None = None
    gitClone: GitCloneImportInput | None = None

    @model_validator(mode="after")
    def match_mode(self):
        if self.mode == "bundle" and (self.bundle is None or self.localGit is not None or self.gitClone is not None):
            raise ValueError("Bundle mode requires bundle input only")
        if self.mode == "local_git" and (self.localGit is None or self.bundle is not None or self.gitClone is not None):
            raise ValueError("Local Git mode requires localGit input only")
        if self.mode == "git_clone" and (self.gitClone is None or self.bundle is not None or self.localGit is not None):
            raise ValueError("Git clone mode requires gitClone input only")
        return self


def custom_inputs_root(settings=None) -> Path:
    configured = getattr(settings, "custom_inputs_root", None) if settings is not None else None
    base = Path(configured) if configured else (WORKSPACE / "inputs" / "custom")
    base.mkdir(parents=True, exist_ok=True)
    return contained(base, WORKSPACE)


def cloned_repos_root(settings=None) -> Path:
    base = custom_inputs_root(settings).parent / "repos"
    base.mkdir(parents=True, exist_ok=True)
    return contained(base, WORKSPACE)


def classify_git_path(raw_path: str) -> tuple[str, str, str] | None:
    normalized = raw_path
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
        return None
    mapping = GIT_SUFFIX_MAP.get(pure.suffix.lower()) or GIT_BASENAME_MAP.get(pure.name)
    kind, fmt = mapping or ("document", "plain-text")
    return normalized, kind, fmt


def _validate_relative_path(raw_path: str, *, allow_all_git_types: bool = False) -> tuple[str, str, str]:
    if allow_all_git_types:
        classified = classify_git_path(raw_path)
        if classified is None:
            fail("invalid_input", details={"fields": ["path"], "path": raw_path})
        return classified
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
        fail("invalid_input", details={"fields": ["path"], "reason": "Unsupported file type."})
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
    is_git_mode = acceptance.get("sourceMode") in {"local_git", "git_clone", "full_git"} or bool(manifest.get("repository", {}).get("gitRepoPath"))
    for key, actual, bundle_limit in (
        ("maximumPaths", len(manifest["entries"]), CUSTOM_MAX_PATHS),
        ("maximumRevisions", len(manifest["revisions"]), CUSTOM_MAX_REVISIONS),
    ):
        limit = acceptance[key]
        require(type(limit) is int and 0 < actual <= limit, "Inventory exceeds its declared bounds")
        require(is_git_mode or limit <= bundle_limit, "Bundle exceeds the supported size")
    max_total_b = GIT_MAX_TOTAL_BYTES if is_git_mode else CUSTOM_MAX_TOTAL_BYTES
    max_file_b = GIT_MAX_TOTAL_BYTES if is_git_mode else CUSTOM_MAX_FILE_BYTES
    require(0 < acceptance["maximumFileBytes"] <= max_file_b, "Invalid custom file byte limit")
    require(0 < acceptance["maximumUniqueBlobBytes"] <= max_total_b, "Invalid custom total byte limit")
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
        require((entry["kind"], entry["format"]) in ALLOWED_CUSTOM_FORMATS, "Unsupported custom input format")
        for label, version in entry["revisions"].items():
            require(label in manifest["revisions"], "Unknown revision binding")
            require(version["commit"] == manifest["revisions"][label]["commitId"], "Mismatched commit binding")
            require(version["mode"] in ({"100644", "100755"} if is_git_mode else {"100644"}) and version["type"] == "blob", "Only regular files are authorized")
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


def _run_git(repo_dir: Path, args: list[str], *, timeout: int = 30) -> bytes:
    executable = shutil.which("git")
    if not executable:
        fail("change_detection_unavailable", 503)
    proc = subprocess.run(
        [executable, "-C", str(repo_dir), "-c", "core.autocrlf=false", *args],
        env=readonly_git_env(repo_dir),
        capture_output=True,
        timeout=timeout,
        check=False,
    )
    if proc.returncode != 0:
        fail("revision_unavailable", 422, {"reason": proc.stderr.decode("utf-8", errors="replace").strip()[:300]})
    return proc.stdout


def _resolve_local_git_repo(raw_repo_path: str, settings) -> Path:
    if not settings.allow_local_git:
        fail("forbidden", 403, {"reason": "Local Git repository import is disabled on this server."})
    if Path(raw_repo_path).is_symlink():
        fail("forbidden", 403, {"reason": "Symlinked repository roots are not permitted."})
    candidate = Path(raw_repo_path)
    if not candidate.is_absolute():
        candidate = (WORKSPACE / candidate).resolve()
    else:
        candidate = candidate.resolve()
    if not candidate.is_dir():
        fail("invalid_input", details={"fields": ["localGit.repoPath"], "reason": f"Directory not found: {raw_repo_path}"})
    if settings.local_git_roots:
        allowed = [Path(root).resolve() for root in settings.local_git_roots]
        if not any(candidate.is_relative_to(root) for root in allowed):
            fail("forbidden", 403, {"reason": "Repository path is outside CONTINUUM_LOCAL_GIT_ROOTS."})
    return candidate


def _valid_remote_url(url: str) -> bool:
    if not re.fullmatch(r"[A-Za-z0-9._/@:-]+", url):
        return False
    if url.startswith("git@"):
        return bool(re.fullmatch(r"git@[A-Za-z0-9.-]+:[A-Za-z0-9._/-]+", url))
    parsed = urlsplit(url)
    return bool(parsed.hostname and parsed.path.strip("/") and parsed.scheme in {"https", "http", "ssh"}
                and parsed.password is None and (not parsed.username or parsed.scheme == "ssh"))


def _network_git(directory: Path, args: list[str]):
    executable = shutil.which("git")
    if not executable:
        fail("change_detection_unavailable", 503)
    env = readonly_git_env(directory)
    env["GIT_ALLOW_PROTOCOL"] = "https:http:ssh"
    try:
        proc = subprocess.run([executable, "-C", str(directory), *args], env=env,
                              capture_output=True, timeout=180, check=False)
    except subprocess.TimeoutExpired:
        fail("revision_unavailable", 503, {"reason": "The Git remote did not respond in time. Retry the refresh."})
    if proc.returncode:
        fail("revision_unavailable", 422, {"reason": "Could not read this remote repository. Check its URL, branch and server credentials."})


def remote_connection(repository_doc: dict, git_dir: Path | None, settings) -> dict:
    if repository_doc.get("sourceMode") != "git_clone":
        return {}
    url = repository_doc.get("gitRemoteUrl")
    if url and _valid_remote_url(url):
        return {"gitRemoteUrl": url, "gitBranch": repository_doc.get("gitBranch")}
    # Older manifests contain only the cached clone path. Only managed clones
    # (including the original Healthchecks cache) can supply legacy defaults.
    inputs = Path(settings.custom_inputs_root) if settings.custom_inputs_root else WORKSPACE / "inputs" / "custom"
    if git_dir is None or (git_dir.parent != (inputs.parent / "repos").resolve()
                          and git_dir != (WORKSPACE / "inputs/healthchecks/repo").resolve()):
        return {}
    raw = run_git_readonly(git_dir, ["config", "--get", "remote.origin.url"])
    legacy_url = (raw or b"").decode("utf-8", errors="replace").strip()
    if not _valid_remote_url(legacy_url):
        return {}
    branch = run_git_readonly(git_dir, ["symbolic-ref", "--short", "HEAD"])
    return {"gitRemoteUrl": legacy_url, "gitBranch": (branch or b"").decode("utf-8", errors="replace").strip() or None}


def _clone_or_resolve_remote_git(git_clone: GitCloneImportInput, settings):
    if not settings.allow_local_git:
        fail("forbidden", 403, {"reason": "Git repository cloning is disabled on this server."})
    raw_url = git_clone.repoUrl.strip()
    local_candidate = Path(raw_url)
    branch = (git_clone.branch or "").strip()
    if local_candidate.is_dir() or (WORKSPACE / raw_url).is_dir():
        resolved = _resolve_local_git_repo(raw_url, settings)
        ref = f"refs/heads/{branch}" if branch else "HEAD"
        tip = _run_git(resolved, ["rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}"]).decode().strip()
        return resolved.name, resolved, tip, None
    if not _valid_remote_url(raw_url):
        fail("invalid_input", details={"fields": ["gitClone.repoUrl"], "reason": "Provide a valid HTTPS/SSH Git URL or local directory path."})

    slug_base = re.sub(r"\.git$", "", raw_url.rstrip("/").split("/")[-1])
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", slug_base).strip("-") or "repo"
    url_hash = sha256(raw_url.encode("utf-8"))[:10]
    target_dir = cloned_repos_root(settings) / f"{slug}-{url_hash}"
    if not (target_dir / ".git").exists():
        with tempfile.TemporaryDirectory(dir=target_dir.parent) as staging:
            clone = Path(staging) / "repo"
            _network_git(Path(staging), ["clone", "--no-checkout", "--no-single-branch", "--", raw_url, str(clone)])
            try:
                clone.rename(target_dir)
            except OSError:
                if not (target_dir / ".git").is_dir():
                    raise
    if branch:
        _run_git(target_dir, ["check-ref-format", f"refs/heads/{branch}"])
    # Resolve against fetched remote refs. The cache's checked-out HEAD can be older
    # or belong to a different branch selected by an earlier request.
    _network_git(target_dir, ["fetch", "--atomic", "--prune", "--no-recurse-submodules",
                              "--no-auto-maintenance", "--", raw_url, "+refs/heads/*:refs/remotes/origin/*",
                              "+refs/tags/*:refs/tags/*",
                              "+HEAD:refs/continuum/default"])
    ref = f"refs/remotes/origin/{branch}" if branch else "refs/continuum/default"
    tip = _run_git(target_dir, ["rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}"]).decode().strip()
    return slug_base, target_dir.resolve(), tip, raw_url


def _remote_revisions(source, settings):
    name, directory, tip, url = _clone_or_resolve_remote_git(source, settings)
    commits = []
    for item in source.commits or []:
        ref = item.strip()
        base = re.split(r"[~^]", ref, maxsplit=1)[0]
        if base == "HEAD":
            ref = tip + ref[len(base):]
        elif url and base in {"origin/HEAD", "refs/remotes/origin/HEAD"}:
            ref = "refs/continuum/default" + ref[len(base):]
        elif url and base and not HEX40.fullmatch(base):
            suffix = ref[len(base):]
            tracking = f"refs/remotes/origin/{base}"
            tag = f"refs/tags/{base}"
            if base.startswith("refs/heads/"):
                ref = f"refs/remotes/origin/{base.removeprefix('refs/heads/')}{suffix}"
            elif base.startswith(("refs/remotes/origin/", "refs/tags/")):
                ref = base + suffix
            elif run_git_readonly(directory, ["show-ref", "--verify", "--quiet", tracking]) is not None:
                ref = tracking + suffix
            elif base.startswith("origin/"):
                ref = f"refs/remotes/{base}{suffix}"
            elif run_git_readonly(directory, ["show-ref", "--verify", "--quiet", tag]) is not None:
                ref = tag + suffix
            elif not re.fullmatch(r"[0-9a-fA-F]{4,40}", base):
                fail("revision_unavailable", 422, {"reason": "The requested remote revision is unavailable."})
        commits.append(ref)
    _, revisions = _extract_git_repo_revisions(directory, commits, source.maxCommits, source.paths, ref=tip)
    if url:
        for revision in revisions:
            revision["gitRemoteUrl"] = url
            revision["gitBranch"] = (source.branch or "").strip() or None
            sha = revision["commitId"]
            _run_git(directory, ["update-ref", f"refs/continuum/retained/{sha}", sha])
    return name, revisions


def _read_text_blob(stream, size, remaining):
    decoder = codecs.getincrementaldecoder("utf-8")()
    chunks = []
    reason = None
    unread = size
    while unread:
        chunk = stream.read(min(unread, 1024 * 1024))
        require(chunk, "Git blob ended before its declared length")
        unread -= len(chunk)
        if reason:
            continue
        if b"\x00" in chunk:
            reason = "binary"
        else:
            try:
                decoder.decode(chunk, final=not unread)
            except UnicodeDecodeError:
                reason = "invalid UTF-8"
        if reason:
            chunks.clear()
        elif size <= remaining:
            chunks.append(chunk)
    require(stream.read(1) == b"\n", "Incomplete Git object response")
    if reason:
        return None, reason
    if size > remaining:
        fail("limit_exceeded", 422, {"limitName": "maximumUniqueBlobBytes", "maximum": GIT_MAX_TOTAL_BYTES})
    return b"".join(chunks), None


def _read_git_tree(repo_dir, commit, requested, cache, remaining):
    listing = _run_git(repo_dir, ["ls-tree", "-rz", "--full-tree", commit])
    entries, modes, omitted = {}, {}, []
    records = listing.rstrip(b"\x00").split(b"\x00") if listing else []
    found = set()
    with subprocess.Popen(["git", "-C", str(repo_dir), "cat-file", "--batch"], env=readonly_git_env(repo_dir),
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE) as reader:
        try:
            for record in records:
                header, raw_path = record.split(b"\t", 1)
                mode, _, blob = header.decode("ascii").split()
                path = raw_path.decode("utf-8", errors="backslashreplace")
                if requested is not None and path not in requested:
                    continue
                found.add(path)
                if mode not in {"100644", "100755"}:
                    omitted.append({"path": path, "reason": "symbolic link" if mode == "120000" else "non-regular entry"})
                    continue
                if classify_git_path(path) is None:
                    omitted.append({"path": path, "reason": "unsupported path"})
                    continue
                if blob not in cache:
                    reader.stdin.write(blob.encode("ascii") + b"\n")
                    reader.stdin.flush()
                    response = reader.stdout.readline().split()
                    require(len(response) == 3 and response[:2] == [blob.encode("ascii"), b"blob"], "Git blob unavailable")
                    content, reason = _read_text_blob(reader.stdout, int(response[2]), remaining)
                    cache[blob] = content, reason
                    if content is not None:
                        remaining -= len(content)
                content, reason = cache[blob]
                if reason:
                    omitted.append({"path": path, "reason": reason})
                else:
                    entries[path] = content
                    modes[path] = mode
        finally:
            reader.stdin.close()
    if reader.returncode:
        fail("revision_unavailable", 422)
    if requested is not None:
        omitted.extend({"path": path, "reason": "path absent at revision"} for path in sorted(requested - found))
    coverage = {"treeEntries": len(records), "selectedPaths": None if requested is None else len(requested),
                "capturedPaths": len(entries), "excluded": omitted}
    return entries, modes, coverage, remaining


def _extract_git_repo_revisions(
    repo_dir: Path,
    commits_input: list[str] | None,
    max_commits: int,
    paths_input: list[str] | None,
    *, ref: str = "HEAD",
) -> tuple[str, list[dict]]:
    requested_paths = None
    if paths_input is not None:
        requested_paths = []
        seen = set()
        for raw_path in paths_input:
            norm, _, _ = _validate_relative_path(raw_path, allow_all_git_types=True)
            if norm in seen:
                fail("invalid_input", details={"fields": ["paths"]})
            seen.add(norm)
            requested_paths.append(norm)

    raw_commits = [c.strip() for c in (commits_input or []) if c and c.strip()]
    if not raw_commits:
        recent = _run_git(repo_dir, ["rev-list", f"--max-count={max_commits}", ref, "--"]).decode("ascii").splitlines()
        if not recent:
            fail("revision_unavailable", 422, {"reason": "No commits found in Git repository."})
        # Order chronologically (oldest to newest) so baseline -> target comparisons flow naturally
        raw_commits = list(reversed(recent))

    revisions = []
    seen_commits = set()
    used_labels = set()
    cache = {}
    remaining = GIT_MAX_TOTAL_BYTES
    requested = set(requested_paths) if requested_paths is not None else None
    for index, raw_ref in enumerate(raw_commits):
        commit_sha = _run_git(repo_dir, ["rev-parse", "--verify", "--end-of-options", f"{raw_ref}^{{commit}}"]).decode("ascii").strip()
        if not HEX40.fullmatch(commit_sha) or commit_sha in seen_commits:
            fail("invalid_input", details={"fields": ["commits"]})
        seen_commits.add(commit_sha)
        meta = get_commit_metadata(repo_dir, commit_sha)
        if meta is None:
            fail("revision_unavailable", 422, {"commitId": commit_sha, "reason": "Could not read Git commit metadata."})

        file_blobs, modes, coverage, remaining = _read_git_tree(repo_dir, commit_sha, requested, cache, remaining)
        if not file_blobs:
            fail("invalid_input", details={"reason": f"No eligible UTF-8 text files found in commit {commit_sha[:7]}.",
                                           "commitId": commit_sha, "gitInventory": coverage})

        base_label = f"git-{commit_sha[:7]}" if len(raw_commits) > 1 else f"R{index}-{commit_sha[:7]}"
        label = base_label
        suffix_idx = 2
        while label in used_labels:
            label = f"{base_label}-{suffix_idx}"
            suffix_idx += 1
        used_labels.add(label)

        revisions.append({
            "label": label,
            "commitId": commit_sha,
            "treeId": meta["treeId"],
            "parentIds": meta["parentIds"],
            "subject": meta.get("subject", ""),
            "message": meta.get("message", ""),
            "authorName": meta.get("authorName", ""),
            "authorEmail": meta.get("authorEmail", ""),
            "authoredAt": meta.get("authoredAt", ""),
            "committedAt": meta.get("committedAt", ""),
            "blobs": file_blobs,
            "fileModes": modes,
            "gitInventory": coverage,
            "gitRepoPath": str(repo_dir),
        })
    return repo_dir.name, revisions


def inspect_git_repository(data: GitInspectInput, settings) -> dict:
    ref = "HEAD"
    remote_url = None
    if data.repoUrl and data.repoUrl.strip():
        name, repo_dir, ref, remote_url = _clone_or_resolve_remote_git(
            GitCloneImportInput(repoUrl=data.repoUrl.strip(), branch=data.branch),
            settings,
        )
    elif data.repoPath and data.repoPath.strip():
        repo_dir = _resolve_local_git_repo(data.repoPath.strip(), settings)
        name = repo_dir.name
    else:
        fail("invalid_input", details={"reason": "Provide repoPath or repoUrl to inspect."})

    commits = list_repo_commits(repo_dir, ref=ref, limit=data.limit)
    if remote_url:
        refs = _run_git(repo_dir, ["for-each-ref", "--format=%(refname:strip=3)%09%(symref)", "refs/remotes/origin/"])
        branches = [line.removesuffix("\t") for line in refs.decode("utf-8", errors="replace").splitlines()
                    if line.endswith("\t")][:30]
    else:
        branches_raw = _run_git(repo_dir, ["branch", "-a", "--format=%(refname:short)"]).decode("utf-8", errors="replace")
        branches = [b.strip() for b in branches_raw.splitlines() if b.strip() and "->" not in b][:30]
    return {
        "name": name,
        "repoPath": str(repo_dir),
        "branches": branches,
        "commits": commits,
    }


def _extract_bundle_revision(repo_id: str, bundle: CustomRevisionBundleInput) -> list[dict]:
    file_blobs = {}
    seen_paths = set()
    for item in bundle.files:
        norm_path, _, _ = _validate_relative_path(item.path, allow_all_git_types=False)
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
        "subject": f"Bundle revision {bundle.revisionLabel} ({len(file_blobs)} files)",
        "message": f"Bundle revision {bundle.revisionLabel} ({len(file_blobs)} files)",
        "authorName": "Workspace user",
        "authorEmail": "",
        "authoredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "committedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
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
    is_git_mode = source_mode in {"local_git", "git_clone", "full_git"}
    max_total_b = GIT_MAX_TOTAL_BYTES if is_git_mode else CUSTOM_MAX_TOTAL_BYTES

    all_paths = sorted({path for rev in revisions for path in rev["blobs"]})
    max_paths = len(all_paths) if is_git_mode else CUSTOM_MAX_PATHS
    max_revs = len(revisions) if is_git_mode else CUSTOM_MAX_REVISIONS
    max_file_b = max_total_b if is_git_mode else CUSTOM_MAX_FILE_BYTES
    if len(all_paths) > max_paths:
        fail("limit_exceeded", 422, {"limitName": "maximumPaths", "maximum": max_paths})
    unique_blobs: dict[str, bytes] = {}
    for rev in revisions:
        for raw in rev["blobs"].values():
            unique_blobs[blob_sha(raw)] = raw
    if sum(len(raw) for raw in unique_blobs.values()) > max_total_b:
        fail("limit_exceeded", 422, {"limitName": "maximumUniqueBlobBytes", "maximum": max_total_b})

    first_set = set(revisions[0]["blobs"])
    if any(set(rev["blobs"]) != first_set for rev in revisions):
        raise ValueError("Internal caller should package per-revision when path sets differ")

    git_repo_path = revisions[0].get("gitRepoPath")
    revisions_doc = {
        rev["label"]: {
            "objectAlgorithm": "sha1",
            "commitId": rev["commitId"],
            "treeId": rev["treeId"],
            **({"gitInventory": rev["gitInventory"]} if "gitInventory" in rev else {}),
            "parentIds": rev["parentIds"],
            **(
                {
                    "subject": rev["subject"],
                    "message": rev.get("message") or rev["subject"],
                    "authorName": rev.get("authorName", ""),
                    "authorEmail": rev.get("authorEmail", ""),
                    "authoredAt": rev.get("authoredAt", ""),
                    "committedAt": rev.get("committedAt", ""),
                }
                if "subject" in rev
                else {}
            ),
        }
        for rev in revisions
    }
    entries_doc = []
    for path in all_paths:
        _, kind, fmt = _validate_relative_path(path, allow_all_git_types=is_git_mode)
        entries_doc.append({
            "path": path,
            "kind": kind,
            "format": fmt,
            "revisions": {
                rev["label"]: {
                    "commit": rev["commitId"],
                    "blobId": blob_sha(rev["blobs"][path]),
                    "sizeBytes": len(rev["blobs"][path]),
                    "mode": rev.get("fileModes", {}).get(path, "100644"),
                    "type": "blob",
                }
                for rev in revisions
                if path in rev["blobs"]
            },
        })

    manifest_id = f"CUSTOM-{repository_id[:8]}-{revisions[0]['commitId'][:8]}"
    repo_doc = {"fullName": full_name, "sourceMode": source_mode}
    if revisions[0].get("gitRemoteUrl"):
        repo_doc.update(gitRemoteUrl=revisions[0]["gitRemoteUrl"], gitBranch=revisions[0]["gitBranch"])
    if git_repo_path:
        try:
            rel_git = Path(git_repo_path).resolve().relative_to(WORKSPACE.resolve()).as_posix()
            repo_doc["gitRepoPath"] = rel_git
        except ValueError:
            repo_doc["gitRepoPath"] = str(Path(git_repo_path).resolve())

    manifest = {
        "id": manifest_id,
        "repository": repo_doc,
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

    manifest_path = contained(package_dir / "manifest.json", WORKSPACE)
    acceptance_path = contained(package_dir / "acceptance.json", WORKSPACE)
    profile_path = contained(package_dir / "discovery-profile.json", WORKSPACE)
    profile_acceptance_path = contained(package_dir / "discovery-acceptance.json", WORKSPACE)
    acquired_path = contained(package_dir / "acquired.json", WORKSPACE)

    existing_accepted_at = None
    if acceptance_path.exists():
        try:
            existing_accepted_at = json.loads(acceptance_path.read_bytes()).get("acceptedAt")
        except Exception:
            existing_accepted_at = None

    acceptance = {
        "schemaVersion": "custom-acceptance-0.1.0",
        "id": f"CUSTOM-ACC-{manifest_digest[:12]}",
        "acceptedAt": existing_accepted_at or datetime.now(timezone.utc).isoformat(),
        "localAcquisition": True,
        "sourceMode": source_mode,
        "proposalId": manifest_id,
        "manifestSha256": manifest_digest,
        "repositoryFullName": full_name,
        "maximumPaths": max_paths,
        "maximumRevisions": max_revs,
        "maximumFileBytes": max_file_b,
        "maximumUniqueBlobBytes": max_total_b,
    }
    acceptance_bytes = (json.dumps(acceptance, indent=2, sort_keys=True) + "\n").encode("utf-8")
    acceptance_digest = sha256(acceptance_bytes)

    profile = {
        "schemaVersion": "discovery-profile-0.1.0",
        "id": f"CUSTOM-LEXICAL-{manifest_digest[:12]}",
        "methodId": "lexical-file-v1",
        "basis": "Full-repository AST & lexical discovery profile" if is_git_mode else "P-08 lexical profile adapted for custom workspace ingestion",
        "manifestSha256": manifest_digest,
        "language": "Python",
        "documentFormats": ["Markdown", "plain-text"],
        "scope": "file",
        "relationType": "documents",
        "direction": "document_to_code",
        "tokenization": BASE_TOKENIZATION,
        "limits": {
            "maximumFileBytes": max_file_b,
            "maximumUniqueInputBytes": max_total_b,
            "maximumPaths": max_paths,
            "maximumDocumentLinesPerFile": 50000,
            "maximumCandidates": 256,
            "maximumEvidenceItemsPerCandidate": 512,
            "maximumPageSize": 100,
            "maximumAttemptSeconds": 180,
            "maximumOperationSeconds": 600,
            "workerConcurrency": 1,
            "leaseSeconds": 60,
            "heartbeatSeconds": 10,
            "maximumAttempts": 3,
            "exceededLimit": "explicit partial/failed scope with named limit; no silent truncation or complete no-impact result",
        },
        "limitations": [
            "Lexical and AST identifier overlap proposes unconfirmed candidates only.",
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


def import_fingerprint(data):
    return sha256(json.dumps(data.model_dump(), sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode())


def replay_import(db, actor, repository_id, command, data):
    receipt = db.get(Receipt, (actor.id, repository_id, command, data.requestId))
    if receipt:
        if receipt.input_digest != import_fingerprint(data):
            fail("idempotency_conflict", 409)
        return receipt.result
    return None


def finish_import(db, actor, repository, command, data, settings, full_name, revisions):
    packages, primary_selection, capture_ops = _register_and_admit_packages(
        db, actor, repository, full_name, data.mode, revisions, settings
    )
    if data.runDiscovery:
        for capture in capture_ops:
            op = db.get(Operation, capture["operationId"])
            op.result_metadata = {"discoveryViewId": capture["repositoryViewId"]}
    result = {
        "repositoryId": repository.id,
        "name": repository.name,
        "selection": primary_selection,
        "packages": packages,
        "captureOperations": capture_ops,
    }
    db.add(Receipt(actor_id=actor.id, repository_id=repository.id, command=command,
                   request_id=data.requestId, input_digest=import_fingerprint(data), result=result))
    return result


def create_custom_workspace(db, actor, data: WorkspaceCreateInput, settings) -> dict:
    if not settings.allow_custom_workspaces:
        fail("forbidden", 403, {"reason": "Custom workspace creation is disabled on this server."})
    from .pipeline import stable

    repo_id = stable("custom-workspace", actor.id, data.requestId)
    existing = db.get(Repository, repo_id)
    if existing is not None:
        repository_access(db, actor, repo_id, write=True)
        previous = replay_import(db, actor, repo_id, "create_custom_workspace", data)
        if previous:
            return previous
        fail("idempotency_conflict", 409)

    if data.mode == "bundle":
        full_name = data.name.strip()
        revisions = _extract_bundle_revision(repo_id, data.bundle)
    elif data.mode == "local_git":
        repo_dir = _resolve_local_git_repo(data.localGit.repoPath, settings)
        git_name, revisions = _extract_git_repo_revisions(
            repo_dir, data.localGit.commits, data.localGit.maxCommits, data.localGit.paths
        )
        full_name = data.name.strip() or git_name
    else:
        git_name, revisions = _remote_revisions(data.gitClone, settings)
        full_name = data.name.strip() or git_name

    repository = Repository(id=repo_id, name=full_name)
    db.add(repository)
    db.flush()
    db.add(Grant(actor_id=actor.id, repository_id=repository.id, role="reviewer"))
    db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action="create_custom_workspace", outcome="success"))
    db.flush()

    return finish_import(db, actor, repository, "create_custom_workspace", data, settings, full_name, revisions)


def add_custom_revision(db, actor, repository: Repository, data: RevisionAddInput, settings) -> dict:
    if not settings.allow_custom_workspaces:
        fail("forbidden", 403, {"reason": "Custom workspace revision ingestion is disabled on this server."})
    previous = replay_import(db, actor, repository.id, "add_custom_revision", data)
    if previous:
        return previous
    existing_inputs = list(db.scalars(select(InputRegistration).where(InputRegistration.repository_id == repository.id)))
    if not existing_inputs or any(not is_custom_manifest(WORKSPACE / row.acceptance_path, WORKSPACE) for row in existing_inputs):
        fail("forbidden", 403, {"reason": "Revisions can only be added to custom or Git-backed workspaces."})

    if data.mode == "bundle":
        revisions = _extract_bundle_revision(repository.id, data.bundle)
        full_name = repository.name
    elif data.mode == "local_git":
        repo_dir = _resolve_local_git_repo(data.localGit.repoPath, settings)
        _, revisions = _extract_git_repo_revisions(
            repo_dir, data.localGit.commits, data.localGit.maxCommits, data.localGit.paths
        )
        full_name = repository.name
    else:
        _, revisions = _remote_revisions(data.gitClone, settings)
        full_name = repository.name

    db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action="add_custom_revision", outcome="success"))
    return finish_import(db, actor, repository, "add_custom_revision", data, settings, full_name, revisions)
