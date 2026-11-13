"""Declared manual relation meanings; automatic discovery stays documents-only."""
from typing import Literal
from .security import fail

RelationType = Literal["documents", "implements", "motivates"]
RELATIONS = {"documents": ("document", "code"), "implements": ("code", "requirement"), "motivates": ("decision", "code")}

def validate_relation(relation, source, target):
    if RELATIONS.get(relation) != (source.kind, target.kind):
        fail("invalid_input", details={"fields": ["type", "sourceArtifactId", "targetArtifactId"]})
