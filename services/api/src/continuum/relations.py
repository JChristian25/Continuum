"""Declared relationship meanings and endpoint kind validation."""
from pathlib import PurePosixPath
from typing import Literal
from .security import fail

RelationType = Literal["documents", "depends_on", "implements", "motivates"]
RELATIONS = {
    "documents": ("document", "code"),
    "depends_on": ("document", "code"),
    "implements": ("code", "requirement"),
    "motivates": ("decision", "code"),
}
ALLOWED_ENDPOINT_KINDS = {
    "documents": {("document", "code")},
    "depends_on": {("document", "code"), ("code", "code"), ("code", "document")},
    "implements": {("code", "requirement")},
    "motivates": {("decision", "code")},
}

_DEPENDENCY_MANIFEST_NAMES = frozenset({
    "requirements.txt",
    "requirements-dev.txt",
    "requirements-test.txt",
    "requirements-prod.txt",
    "constraints.txt",
    "pipfile",
    "pipfile.lock",
    "pyproject.toml",
    "poetry.lock",
    "setup.cfg",
    "setup.py",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
})


def is_dependency_manifest_path(path: str | None) -> bool:
    if not path:
        return False
    name = PurePosixPath(path).name.lower()
    if name in _DEPENDENCY_MANIFEST_NAMES:
        return True
    if name.startswith("requirements") and name.endswith((".txt", ".in")):
        return True
    if name.startswith("constraints") and name.endswith(".txt"):
        return True
    return False


def validate_relation(relation, source, target):
    allowed = ALLOWED_ENDPOINT_KINDS.get(relation)
    if not allowed or (source.kind, target.kind) not in allowed:
        fail("invalid_input", details={"fields": ["type", "sourceArtifactId", "targetArtifactId"]})

