"""GitLens-grade line blame, contributor attribution, commit metadata, and file history backed by native Git."""

from datetime import datetime, timezone
import os
from pathlib import Path
import re
import shutil
import subprocess

from .acquisition import HEX40, WORKSPACE

_COMMIT_META_CACHE: dict[tuple[str, str], dict] = {}
_BLAME_CACHE: dict[tuple[str, str, str], dict] = {}
_MANIFEST_JSON_CACHE: dict[str, dict] = {}

DEFAULT_HEALTHCHECKS_GIT_DIR = WORKSPACE / "inputs" / "healthchecks" / "repo"


def readonly_git_env(repo_dir: Path) -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith("GIT_")}
    env.update(
        GIT_CONFIG_NOSYSTEM="1",
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_TERMINAL_PROMPT="0",
        GIT_ALLOW_PROTOCOL="",
        GIT_CEILING_DIRECTORIES=str(repo_dir.parent.resolve()),
    )
    # A read-only host mount can belong to a different UID from the API process.
    # Trust only this exact checkout under a root explicitly selected by the operator.
    resolved = repo_dir.resolve()
    roots = os.getenv("CONTINUUM_LOCAL_GIT_ROOTS", "").split(os.pathsep)
    if any(root and resolved.is_relative_to(Path(root).resolve()) for root in roots):
        env.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="safe.directory", GIT_CONFIG_VALUE_0=str(resolved))
    return env


def run_git_readonly(repo_dir: Path, args: list[str], *, timeout: int = 20) -> bytes | None:
    executable = shutil.which("git")
    if not executable or not repo_dir or not repo_dir.is_dir():
        return None
    try:
        proc = subprocess.run(
            [executable, "-C", str(repo_dir), "-c", "core.autocrlf=false", *args],
            env=readonly_git_env(repo_dir),
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


def resolve_git_dir_from_manifest(manifest: dict, root: Path = WORKSPACE) -> Path | None:
    repo_info = manifest.get("repository") or {}
    raw_git_path = repo_info.get("gitRepoPath")
    if isinstance(raw_git_path, str) and raw_git_path.strip():
        candidate = Path(raw_git_path)
        if not candidate.is_absolute():
            candidate = (root / candidate).resolve()
        else:
            candidate = candidate.resolve()
        if (candidate / ".git").exists() or (candidate / "HEAD").exists():
            return candidate
    if repo_info.get("fullName") == "healthchecks/healthchecks":
        hc_dir = (root / "inputs" / "healthchecks" / "repo").resolve()
        if (hc_dir / ".git").exists() or (hc_dir / "HEAD").exists():
            return hc_dir
    return None


def resolve_repo_git_dir(db, repository_id: str, root: Path = WORKSPACE) -> Path | None:
    from sqlalchemy import select
    from .pipeline_models import InputRegistration
    import json

    rows = list(
        db.scalars(
            select(InputRegistration)
            .where(InputRegistration.repository_id == repository_id)
            .order_by(InputRegistration.id)
        )
    )
    for row in rows:
        manifest = _MANIFEST_JSON_CACHE.get(row.manifest_digest)
        if manifest is None:
            mpath = root / row.manifest_path
            if mpath.is_file():
                try:
                    manifest = json.loads(mpath.read_bytes())
                    _MANIFEST_JSON_CACHE[row.manifest_digest] = manifest
                except Exception:
                    manifest = None
        if manifest:
            resolved = resolve_git_dir_from_manifest(manifest, root)
            if resolved is not None:
                return resolved
    return None


def get_commit_metadata(repo_dir: Path | None, commit_sha: str) -> dict | None:
    if repo_dir is None or not commit_sha or not HEX40.fullmatch(commit_sha):
        return None
    cache_key = (str(repo_dir.resolve()), commit_sha)
    cached = _COMMIT_META_CACHE.get(cache_key)
    if cached is not None:
        return cached

    fmt = "%H%x1f%h%x1f%T%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%b"
    raw = run_git_readonly(repo_dir, ["show", "-s", f"--format={fmt}", commit_sha])
    if raw is None:
        return None
    parts = raw.decode("utf-8", errors="replace").split("\x1f", 11)
    if len(parts) < 12:
        return None
    full_sha, short_sha, tree_sha, parents_raw, an, ae, ai, cn, ce, ci, subject, body = parts
    subject = subject.strip()
    body = body.strip()
    meta = {
        "commitId": full_sha.strip(),
        "shortCommitId": short_sha.strip() or full_sha.strip()[:7],
        "treeId": tree_sha.strip(),
        "parentIds": [p for p in parents_raw.strip().split(" ") if p],
        "authorName": an.strip(),
        "authorEmail": ae.strip(),
        "authoredAt": ai.strip(),
        "committerName": cn.strip(),
        "committerEmail": ce.strip(),
        "committedAt": ci.strip(),
        "subject": subject,
        "body": body,
        "message": f"{subject}\n\n{body}".strip() if body else subject,
    }
    _COMMIT_META_CACHE[cache_key] = meta
    return meta


def enrich_revision_entry(label: str, revision: dict, repo_dir: Path | None) -> dict:
    commit_id = revision.get("commitId", "")
    meta = get_commit_metadata(repo_dir, commit_id) if repo_dir else None
    subject = revision.get("subject") or (meta.get("subject") if meta else None) or ""
    message = revision.get("message") or (meta.get("message") if meta else None) or subject
    author_name = revision.get("authorName") or (meta.get("authorName") if meta else None) or ""
    author_email = revision.get("authorEmail") or (meta.get("authorEmail") if meta else None) or ""
    authored_at = (
        revision.get("authoredAt")
        or (meta.get("authoredAt") if meta else None)
        or revision.get("authorDate")
        or ""
    )
    committed_at = (
        revision.get("committedAt")
        or (meta.get("committedAt") if meta else None)
        or revision.get("committerDate")
        or authored_at
    )
    return {
        "label": label,
        "objectAlgorithm": revision.get("objectAlgorithm", "sha1"),
        "commitId": commit_id,
        "shortCommitId": commit_id[:7],
        "treeId": revision.get("treeId") or (meta.get("treeId") if meta else None),
        "parentIds": revision.get("parentIds") if "parentIds" in revision else (meta.get("parentIds", []) if meta else []),
        "subject": subject,
        "message": message,
        "authorName": author_name,
        "authorEmail": author_email,
        "authoredAt": authored_at,
        "committedAt": committed_at,
    }


def list_repo_commits(
    repo_dir: Path | None,
    *,
    ref: str = "HEAD",
    limit: int = 40,
    path: str | None = None,
) -> list[dict]:
    if repo_dir is None:
        return []
    safe_limit = max(1, min(int(limit), 200))
    fmt = "%H%x1f%h%x1f%T%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%b%x1e"
    args = ["log", f"-n{safe_limit}", f"--format={fmt}", ref]
    if path:
        args.extend(["--", path])
    raw = run_git_readonly(repo_dir, args)
    if raw is None:
        return []
    text = raw.decode("utf-8", errors="replace")
    items = []
    for record in text.split("\x1e"):
        record = record.strip("\r\n ")
        if not record:
            continue
        parts = record.split("\x1f", 11)
        if len(parts) < 11:
            continue
        full_sha, short_sha, tree_sha, parents_raw, an, ae, ai, cn, ce, ci, subject = parts[:11]
        body = parts[11].strip() if len(parts) > 11 else ""
        full_sha = full_sha.strip()
        subject = subject.strip()
        item = {
            "commitId": full_sha,
            "shortCommitId": short_sha.strip() or full_sha[:7],
            "treeId": tree_sha.strip(),
            "parentIds": [p for p in parents_raw.strip().split(" ") if p],
            "authorName": an.strip(),
            "authorEmail": ae.strip(),
            "authoredAt": ai.strip(),
            "committerName": cn.strip(),
            "committerEmail": ce.strip(),
            "committedAt": ci.strip(),
            "subject": subject,
            "body": body,
            "message": f"{subject}\n\n{body}".strip() if body else subject,
        }
        _COMMIT_META_CACHE[(str(repo_dir.resolve()), full_sha)] = item
        items.append(item)
    return items


def _epoch_to_iso(epoch_str: str, tz_str: str = "+0000") -> str:
    try:
        ts = int(epoch_str)
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")
    except (ValueError, OSError):
        return ""


def compute_file_blame(
    repo_dir: Path | None,
    commit_sha: str,
    file_path: str,
    *,
    fallback_content: str = "",
    fallback_identity: dict | None = None,
) -> dict:
    if (
        repo_dir is not None
        and commit_sha
        and HEX40.fullmatch(commit_sha)
        and file_path
        and not file_path.startswith("authored/")
    ):
        cache_key = (str(repo_dir.resolve()), commit_sha, file_path)
        cached = _BLAME_CACHE.get(cache_key)
        if cached is not None:
            return cached

        raw = run_git_readonly(
            repo_dir,
            ["blame", "--line-porcelain", commit_sha, "--", file_path],
            timeout=25,
        )
        if raw is not None:
            text = raw.decode("utf-8", errors="replace")
            commits: dict[str, dict] = {}
            line_records: list[tuple[str, int]] = []
            cur_sha = ""
            cur_orig_line = 1
            cur_meta: dict[str, str] = {}

            for raw_line in text.splitlines():
                if raw_line.startswith("\t"):
                    if cur_sha:
                        if cur_sha not in commits and "author" in cur_meta:
                            mail = cur_meta.get("author-mail", "").strip("<>")
                            cmail = cur_meta.get("committer-mail", "").strip("<>")
                            authored_iso = _epoch_to_iso(
                                cur_meta.get("author-time", "0"),
                                cur_meta.get("author-tz", "+0000"),
                            )
                            committed_iso = _epoch_to_iso(
                                cur_meta.get("committer-time", "0"),
                                cur_meta.get("committer-tz", "+0000"),
                            )
                            commits[cur_sha] = {
                                "commitId": cur_sha,
                                "shortCommitId": cur_sha[:7],
                                "authorName": cur_meta.get("author", "Unknown"),
                                "authorEmail": mail,
                                "authoredAt": authored_iso,
                                "authorTimestamp": int(cur_meta.get("author-time", "0") or 0),
                                "committerName": cur_meta.get("committer", "Unknown"),
                                "committerEmail": cmail,
                                "committedAt": committed_iso,
                                "summary": cur_meta.get("summary", ""),
                            }
                        line_records.append((cur_sha, cur_orig_line))
                    cur_meta = {}
                else:
                    parts = raw_line.split(" ")
                    if len(parts) >= 3 and len(parts[0]) == 40 and HEX40.fullmatch(parts[0]):
                        cur_sha = parts[0]
                        try:
                            cur_orig_line = int(parts[1])
                        except ValueError:
                            cur_orig_line = 1
                    else:
                        kv = raw_line.split(" ", 1)
                        if len(kv) == 2:
                            cur_meta[kv[0]] = kv[1]

            total_lines = len(line_records)
            hunks: list[dict] = []
            for idx, (sha, orig_line) in enumerate(line_records, 1):
                if hunks and hunks[-1]["commitId"] == sha:
                    hunks[-1]["endLine"] = idx
                else:
                    hunks.append({
                        "startLine": idx,
                        "endLine": idx,
                        "commitId": sha,
                        "origStartLine": orig_line,
                    })

            author_stats: dict[tuple[str, str], dict] = {}
            for sha, _ in line_records:
                cinfo = commits.get(sha)
                if not cinfo:
                    continue
                akey = (cinfo["authorName"], cinfo["authorEmail"])
                entry = author_stats.get(akey)
                if entry is None:
                    entry = {
                        "authorName": cinfo["authorName"],
                        "authorEmail": cinfo["authorEmail"],
                        "lineCount": 0,
                        "commits": set(),
                        "latestTimestamp": -1,
                        "latestCommitId": sha,
                        "latestShortCommitId": sha[:7],
                        "latestAuthoredAt": cinfo["authoredAt"],
                        "latestSummary": cinfo["summary"],
                    }
                    author_stats[akey] = entry
                entry["lineCount"] += 1
                entry["commits"].add(sha)
                if cinfo["authorTimestamp"] >= entry["latestTimestamp"]:
                    entry["latestTimestamp"] = cinfo["authorTimestamp"]
                    entry["latestCommitId"] = sha
                    entry["latestShortCommitId"] = sha[:7]
                    entry["latestAuthoredAt"] = cinfo["authoredAt"]
                    entry["latestSummary"] = cinfo["summary"]

            contributors = []
            for entry in sorted(author_stats.values(), key=lambda x: (-x["lineCount"], x["authorName"])):
                contributors.append({
                    "authorName": entry["authorName"],
                    "authorEmail": entry["authorEmail"],
                    "lineCount": entry["lineCount"],
                    "percentage": round((entry["lineCount"] * 100.0) / max(1, total_lines), 1),
                    "commitCount": len(entry["commits"]),
                    "latestCommitId": entry["latestCommitId"],
                    "latestShortCommitId": entry["latestShortCommitId"],
                    "latestAuthoredAt": entry["latestAuthoredAt"],
                    "latestSummary": entry["latestSummary"],
                })

            file_history = list_repo_commits(repo_dir, ref=commit_sha, limit=30, path=file_path)
            last_modified = file_history[0] if file_history else (
                commits.get(contributors[0]["latestCommitId"]) if contributors else None
            )

            result = {
                "available": True,
                "path": file_path,
                "commitId": commit_sha,
                "totalLines": total_lines,
                "distinctCommits": len(commits),
                "contributorCount": len(contributors),
                "lastModified": last_modified,
                "contributors": contributors,
                "commits": commits,
                "hunks": hunks,
                "fileHistory": file_history,
            }
            _BLAME_CACHE[cache_key] = result
            return result

    # Fallback when file is not backed by a local Git repository (e.g. authored record or inline bundle)
    lines_count = len(fallback_content.splitlines()) if fallback_content else 0
    identity = fallback_identity or {}
    prov = identity.get("provenance") if isinstance(identity.get("provenance"), dict) else {}
    recorded_at = identity.get("recordedAt") or prov.get("recordedAt") or ""
    actor_id = identity.get("actorId") or prov.get("initiatedByActorId") or "Workspace"
    return {
        "available": False,
        "path": file_path,
        "commitId": commit_sha,
        "totalLines": lines_count,
        "distinctCommits": 1 if commit_sha else 0,
        "contributorCount": 1 if actor_id else 0,
        "lastModified": {
            "commitId": commit_sha or "authored",
            "shortCommitId": (commit_sha or "authored")[:7],
            "authorName": str(actor_id),
            "authorEmail": "",
            "authoredAt": str(recorded_at),
            "subject": identity.get("title") or f"Captured {file_path}",
            "message": identity.get("title") or f"Captured {file_path}",
        } if (commit_sha or actor_id) else None,
        "contributors": [],
        "commits": {},
        "hunks": [],
        "fileHistory": [],
    }


def get_commit_diff(repo_dir: Path | None, commit_sha: str, file_path: str | None = None) -> dict | None:
    if repo_dir is None or not commit_sha or not HEX40.fullmatch(commit_sha):
        return None
    meta = get_commit_metadata(repo_dir, commit_sha)
    if meta is None:
        return None
    files_raw = run_git_readonly(repo_dir, ["diff-tree", "--no-commit-id", "--name-status", "-r", "-m", "--root", commit_sha])
    changed_files = []
    seen_paths = set()
    if files_raw:
        for line in files_raw.decode("utf-8", errors="replace").splitlines():
            if "\t" not in line:
                continue
            status, fpath = line.split("\t", 1)
            if fpath in seen_paths:
                continue
            seen_paths.add(fpath)
            changed_files.append({"status": status.strip(), "path": fpath.strip()})

    diff_args = ["show", "--format=", "--unified=3", commit_sha]
    if file_path:
        diff_args.extend(["--", file_path])
    diff_raw = run_git_readonly(repo_dir, diff_args, timeout=20)
    diff_text = diff_raw.decode("utf-8", errors="replace") if diff_raw else ""
    truncated = False
    if len(diff_text) > 200_000:
        diff_text = diff_text[:200_000]
        truncated = True
    return {
        "commit": meta,
        "changedFiles": changed_files,
        "scopedPath": file_path,
        "diff": diff_text,
        "truncated": truncated,
    }
