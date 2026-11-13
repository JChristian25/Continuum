"""Native Git comparisons of retained bytes. No clone, checkout, hooks or repo init."""
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
from .acquisition import WORKSPACE
from .security import fail


def compare_files(before, after):
    executable = shutil.which("git")
    if not executable:
        fail("change_detection_unavailable", 503)
    runtime = WORKSPACE / "outputs" / "runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith("GIT_")}
    env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull, GIT_TERMINAL_PROMPT="0", GIT_CEILING_DIRECTORIES=str(runtime.resolve()))
    try:
        with tempfile.TemporaryDirectory(prefix="git-diff-", dir=runtime) as temporary:
            roots = [Path(temporary) / "before", Path(temporary) / "after"]
            for root, files in zip(roots, [before, after]):
                root.mkdir()
                for name, content in files.items():
                    path = PurePosixPath(name)
                    if path.is_absolute() or not path.parts or any(part in {".", ".."} or ":" in part or "\\" in part for part in path.parts):
                        fail("invalid_input")
                    destination = root.joinpath(*path.parts)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(content.encode("utf-8"))
            result = subprocess.run([executable, "-c", "core.autocrlf=false", "-c", "core.attributesFile=" + os.devnull,
                "diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-status", "-z", "--",
                str(roots[0]), str(roots[1])], cwd=temporary, env=env, capture_output=True, timeout=30, check=False)
            if result.returncode not in {0, 1}:
                fail("change_detection_unavailable", 503)
            fields = result.stdout.decode("utf-8").split("\0")
            changes = []
            for index in range(0, len(fields) - 1, 2):
                kind, name = fields[index:index + 2]
                if kind not in {"A", "D", "M", "T"}:
                    fail("change_detection_unavailable", 503)
                root = roots[1] if kind == "A" else roots[0]
                relative = Path(name).relative_to(root).as_posix()
                changes.append({"path": relative, "kind": {"A": "added", "D": "deleted", "M": "modified", "T": "modified"}[kind]})
        version = subprocess.run([executable, "--version"], env=env, capture_output=True, timeout=5, check=True).stdout.decode().strip()
        return sorted(changes, key=lambda row: row["path"]), {"technology": "Git", "version": version, "mode": "diff --no-index --no-renames", "scope": "retained accepted file bytes"}
    except (OSError, subprocess.SubprocessError, UnicodeError, ValueError):
        fail("change_detection_unavailable", 503)
