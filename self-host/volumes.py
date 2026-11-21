"""Cold backup and same-version restore for the self-host Compose project."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


STACK = Path(__file__).resolve().parent


def docker(*args, **kwargs):
    return subprocess.run(["docker", *args], check=True, cwd=STACK, **kwargs)


def output(*args):
    return docker(*args, stdout=subprocess.PIPE, text=True).stdout.strip()


def checksum(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["backup", "restore"])
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    directory = args.directory.resolve()
    config = json.loads(output("compose", "-f", "compose.yaml", "config", "--format", "json"))
    volumes = {key: settings["name"] for key, settings in config["volumes"].items()}
    image = config["services"]["db"]["image"]
    existing = set(output("volume", "ls", "--format", "{{.Name}}").splitlines())

    if args.action == "backup":
        for volume in volumes.values():
            if volume not in existing or output("ps", "-q", "--filter", f"volume={volume}"):
                sys.exit(f"Backup requires the existing volume {volume} with all writers stopped.")
        directory.mkdir(mode=0o700, parents=True, exist_ok=False)
        digests = {}
        for key, volume in volumes.items():
            path = directory / f"{key}.tar"
            with path.open("xb") as archive:
                docker("run", "--rm", "--network", "none", "--mount",
                       f"type=volume,src={volume},dst=/volume,readonly,volume-nocopy",
                       "--entrypoint", "tar", image, "-C", "/volume", "-cpf", "-", ".", stdout=archive)
            digests[key] = checksum(path)
        (directory / "manifest.json").write_text(json.dumps({"format": 1, "sha256": digests}, indent=2))
    else:
        record = json.loads((directory / "manifest.json").read_text())
        if record.get("format") != 1 or set(record.get("sha256", {})) != set(volumes):
            sys.exit("Backup manifest does not match this installation format.")
        for key, volume in volumes.items():
            if volume in existing:
                sys.exit(f"Restore requires a fresh project. Volume {volume} already exists.")
            if checksum(directory / f"{key}.tar") != record["sha256"][key]:
                sys.exit(f"Checksum mismatch for {key}.")
        for key, volume in volumes.items():
            output("volume", "create", "--label", f"com.docker.compose.project={config['name']}",
                   "--label", f"com.docker.compose.volume={key}", volume)
            with (directory / f"{key}.tar").open("rb") as archive:
                docker("run", "--rm", "-i", "--network", "none", "--mount",
                       f"type=volume,src={volume},dst=/volume,volume-nocopy", "--entrypoint",
                       "tar", image, "-C", "/volume", "-xpf", "-", stdin=archive)
    print(f"{args.action.capitalize()} complete for {len(volumes)} volumes.")


if __name__ == "__main__":
    os.umask(0o077)
    main()
