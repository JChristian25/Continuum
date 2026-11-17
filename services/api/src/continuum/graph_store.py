"""Neo4j graph projection and Cypher-backed one-hop typed neighborhood retrieval."""

import atexit
import json
import logging
import threading

from neo4j import GraphDatabase, RoutingControl
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from .config import env_value
from .security import digest

logger = logging.getLogger(__name__)

REL_TYPE_MAP = {
    "documents": "DOCUMENTS",
    "implements": "IMPLEMENTS",
    "motivates": "MOTIVATES",
}

_SCHEMA_STATEMENTS = (
    "CREATE CONSTRAINT continuum_snapshot_key IF NOT EXISTS FOR (s:ContinuumSnapshot) REQUIRE s.snapshotKey IS UNIQUE",
    "CREATE CONSTRAINT continuum_artifact_node_key IF NOT EXISTS FOR (a:ContinuumArtifact) REQUIRE a.nodeKey IS UNIQUE",
    "CREATE CONSTRAINT continuum_assertion_edge_key IF NOT EXISTS FOR (c:ContinuumAssertionContext) REQUIRE c.contextKey IS UNIQUE",
    "CREATE INDEX continuum_artifact_lookup IF NOT EXISTS FOR (a:ContinuumArtifact) ON (a.snapshotKey, a.artifactId)",
    "CREATE INDEX continuum_context_lookup IF NOT EXISTS FOR (c:ContinuumAssertionContext) ON (c.snapshotKey, c.contextId)",
)

_driver_lock = threading.Lock()
_drivers = {}
_schema_ready = set()


def _neo4j_settings():
    uri = env_value("CONTINUUM_NEO4J_URI", "bolt://127.0.0.1:57687") or "bolt://127.0.0.1:57687"
    user = env_value("CONTINUUM_NEO4J_USER", "neo4j") or "neo4j"
    password = env_value("CONTINUUM_NEO4J_PASSWORD") or env_value("POSTGRES_PASSWORD")
    database = env_value("CONTINUUM_NEO4J_DATABASE", "neo4j") or "neo4j"
    return uri, user, password, database


def close_drivers():
    with _driver_lock:
        for driver in _drivers.values():
            try:
                driver.close()
            except Exception:
                pass
        _drivers.clear()
        _schema_ready.clear()


atexit.register(close_drivers)


def get_driver(*, verify=False):
    uri, user, password, database = _neo4j_settings()
    if not password:
        return None, database
    key = (uri, user, password)
    with _driver_lock:
        driver = _drivers.get(key)
        if driver is None:
            driver = GraphDatabase.driver(
                uri,
                auth=(user, password),
                max_connection_pool_size=25,
                connection_acquisition_timeout=5.0,
                connection_timeout=3.0,
            )
            _drivers[key] = driver
    if verify:
        driver.verify_connectivity()
    return driver, database


def ensure_neo4j_schema(*, raise_on_error=False):
    driver, database = get_driver()
    if driver is None:
        return False
    uri, user, _, _ = _neo4j_settings()
    cache_key = (uri, user, database)
    if cache_key in _schema_ready:
        return True
    try:
        for stmt in _SCHEMA_STATEMENTS:
            driver.execute_query(stmt, database_=database)
        _schema_ready.add(cache_key)
        return True
    except (Neo4jError, ServiceUnavailable, OSError) as exc:
        logger.warning("Neo4j schema initialization skipped: %s", exc)
        if raise_on_error:
            raise
        return False


def snapshot_key_for(snapshot):
    document = snapshot.document
    content_digest = digest(
        json.dumps(
            {"artifacts": document.get("artifacts", []), "assertions": document.get("assertions", [])},
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )
    )[:16]
    return f"{snapshot.repository_id}:{snapshot.id}:{content_digest}"


def _build_projection_payload(snapshot):
    skey = snapshot_key_for(snapshot)
    document = snapshot.document
    artifacts_by_id = {}
    artifact_rows = []
    for row in document.get("artifacts", []):
        artifacts_by_id[row["artifactId"]] = row
        summary = row.get("structureSummary") or {}
        artifact_rows.append(
            {
                "nodeKey": f"{skey}:artifact:{row['artifactId']}:{row['versionId']}",
                "artifactId": row["artifactId"],
                "versionId": row["versionId"],
                "kind": row["kind"],
                "path": row["path"],
                "label": row["identity"].get("title") or row["path"],
                "contentDigest": row["contentDigest"],
                "representationOnly": row["kind"] in {"requirement", "decision"},
                "structureEngine": summary.get("engine") or "unknown",
                "symbolCount": int(summary.get("symbolCount", 0)),
                "sectionCount": int(summary.get("sectionCount", 0)),
            }
        )

    context_rows = []
    source_links = []
    target_links = []
    typed_edges = {rel: [] for rel in REL_TYPE_MAP.values()}
    sorted_assertions = sorted(
        document.get("assertions", []),
        key=lambda a: (a["assertion"]["id"], a["projection"]["contextId"]),
    )
    for item in sorted_assertions:
        assertion, proj = item["assertion"], item["projection"]
        context_key = f"{skey}:context:{proj['contextId']}:{assertion['id']}"
        src_ep, tgt_ep = assertion["source"], assertion["target"]
        src_row = artifacts_by_id.get(src_ep["artifactId"])
        tgt_row = artifacts_by_id.get(tgt_ep["artifactId"])
        src_ok = src_ep["availability"] == "available" and src_row is not None and src_row["versionId"] == src_ep["versionId"]
        tgt_ok = tgt_ep["availability"] == "available" and tgt_row is not None and tgt_row["versionId"] == tgt_ep["versionId"]
        unavailable = []
        if not src_ok:
            unavailable.append(src_ep)
        if not tgt_ok:
            unavailable.append(tgt_ep)
        src_node_key = f"{skey}:artifact:{src_row['artifactId']}:{src_row['versionId']}" if src_ok else None
        tgt_node_key = f"{skey}:artifact:{tgt_row['artifactId']}:{tgt_row['versionId']}" if tgt_ok else None
        context_rows.append(
            {
                "contextKey": context_key,
                "assertionId": assertion["assertionId"],
                "assertionRevisionId": assertion["id"],
                "contextId": proj["contextId"],
                "sourceArtifactId": src_ep["artifactId"],
                "sourceVersionId": src_ep.get("versionId"),
                "targetArtifactId": tgt_ep["artifactId"],
                "targetVersionId": tgt_ep.get("versionId"),
                "sourceNodeKey": src_node_key,
                "targetNodeKey": tgt_node_key,
                "type": assertion["type"],
                "validity": proj["validity"],
                "resolution": proj["resolution"],
                "evidenceIdsJson": json.dumps(assertion["evidenceIds"]),
                "unavailableEndpointsJson": json.dumps(unavailable),
            }
        )
        if src_node_key is not None:
            source_links.append({"sourceNodeKey": src_node_key, "contextKey": context_key})
        if tgt_node_key is not None:
            target_links.append({"targetNodeKey": tgt_node_key, "contextKey": context_key})
        if src_ok and tgt_ok:
            rel_type = REL_TYPE_MAP[assertion["type"]]
            typed_edges[rel_type].append(
                {
                    "sourceNodeKey": src_node_key,
                    "targetNodeKey": tgt_node_key,
                    "contextKey": context_key,
                    "assertionId": assertion["assertionId"],
                    "assertionRevisionId": assertion["id"],
                    "contextId": proj["contextId"],
                    "type": assertion["type"],
                    "validity": proj["validity"],
                    "resolution": proj["resolution"],
                }
            )
    return skey, artifact_rows, context_rows, source_links, target_links, typed_edges


def sync_snapshot_to_neo4j(snapshot, *, raise_on_error=False):
    """Project an immutable snapshot's artifacts and typed assertion contexts into Neo4j."""
    driver, database = get_driver()
    if driver is None:
        return None
    try:
        ensure_neo4j_schema(raise_on_error=raise_on_error)
        skey, artifact_rows, context_rows, source_links, target_links, typed_edges = _build_projection_payload(snapshot)

        def write_tx(tx):
            tx.run(
                """
                MERGE (s:ContinuumSnapshot {snapshotKey: $snapshotKey})
                SET s.snapshotId = $snapshotId,
                    s.repositoryId = $repositoryId,
                    s.snapshotVersion = $snapshotVersion,
                    s.synced = false
                """,
                snapshotKey=skey,
                snapshotId=snapshot.id,
                repositoryId=snapshot.repository_id,
                snapshotVersion=snapshot.snapshot_version,
            ).consume()
            if artifact_rows:
                tx.run(
                    """
                    MATCH (s:ContinuumSnapshot {snapshotKey: $snapshotKey})
                    UNWIND $rows AS row
                    MERGE (a:ContinuumArtifact {nodeKey: row.nodeKey})
                    SET a.snapshotKey = $snapshotKey,
                        a.repositoryId = $repositoryId,
                        a.snapshotId = $snapshotId,
                        a.artifactId = row.artifactId,
                        a.artifactVersionId = row.versionId,
                        a.kind = row.kind,
                        a.path = row.path,
                        a.label = row.label,
                        a.contentDigest = row.contentDigest,
                        a.representationOnly = row.representationOnly,
                        a.structureEngine = row.structureEngine,
                        a.symbolCount = row.symbolCount,
                        a.sectionCount = row.sectionCount
                    MERGE (s)-[:HAS_ARTIFACT]->(a)
                    """,
                    snapshotKey=skey,
                    repositoryId=snapshot.repository_id,
                    snapshotId=snapshot.id,
                    rows=artifact_rows,
                ).consume()
            if context_rows:
                tx.run(
                    """
                    MATCH (s:ContinuumSnapshot {snapshotKey: $snapshotKey})
                    UNWIND $rows AS row
                    MERGE (c:ContinuumAssertionContext {contextKey: row.contextKey})
                    SET c.snapshotKey = $snapshotKey,
                        c.repositoryId = $repositoryId,
                        c.snapshotId = $snapshotId,
                        c.assertionId = row.assertionId,
                        c.assertionRevisionId = row.assertionRevisionId,
                        c.contextId = row.contextId,
                        c.sourceArtifactId = row.sourceArtifactId,
                        c.sourceVersionId = row.sourceVersionId,
                        c.targetArtifactId = row.targetArtifactId,
                        c.targetVersionId = row.targetVersionId,
                        c.sourceNodeKey = row.sourceNodeKey,
                        c.targetNodeKey = row.targetNodeKey,
                        c.type = row.type,
                        c.validity = row.validity,
                        c.resolution = row.resolution,
                        c.evidenceIdsJson = row.evidenceIdsJson,
                        c.unavailableEndpointsJson = row.unavailableEndpointsJson
                    MERGE (s)-[:HAS_CONTEXT]->(c)
                    """,
                    snapshotKey=skey,
                    repositoryId=snapshot.repository_id,
                    snapshotId=snapshot.id,
                    rows=context_rows,
                ).consume()
            if source_links:
                tx.run(
                    """
                    UNWIND $rows AS row
                    MATCH (src:ContinuumArtifact {nodeKey: row.sourceNodeKey})
                    MATCH (c:ContinuumAssertionContext {contextKey: row.contextKey})
                    MERGE (src)-[:ASSERTS_SOURCE]->(c)
                    """,
                    rows=source_links,
                ).consume()
            if target_links:
                tx.run(
                    """
                    UNWIND $rows AS row
                    MATCH (c:ContinuumAssertionContext {contextKey: row.contextKey})
                    MATCH (tgt:ContinuumArtifact {nodeKey: row.targetNodeKey})
                    MERGE (c)-[:ASSERTS_TARGET]->(tgt)
                    """,
                    rows=target_links,
                ).consume()
            for rel_type, rows in typed_edges.items():
                if not rows:
                    continue
                if rel_type not in REL_TYPE_MAP.values():
                    raise ValueError(f"Unsupported Neo4j relationship type: {rel_type}")
                tx.run(
                    f"""
                    UNWIND $rows AS row
                    MATCH (src:ContinuumArtifact {{nodeKey: row.sourceNodeKey}})
                    MATCH (tgt:ContinuumArtifact {{nodeKey: row.targetNodeKey}})
                    MERGE (src)-[r:{rel_type} {{contextKey: row.contextKey}}]->(tgt)
                    SET r.snapshotKey = $snapshotKey,
                        r.assertionId = row.assertionId,
                        r.assertionRevisionId = row.assertionRevisionId,
                        r.contextId = row.contextId,
                        r.type = row.type,
                        r.validity = row.validity,
                        r.resolution = row.resolution
                    """,
                    snapshotKey=skey,
                    rows=rows,
                ).consume()
            tx.run(
                """
                MATCH (s:ContinuumSnapshot {snapshotKey: $snapshotKey})
                SET s.synced = true
                """,
                snapshotKey=skey,
            ).consume()

        with driver.session(database=database) as session:
            session.execute_write(write_tx)
        return skey
    except (Neo4jError, ServiceUnavailable, OSError) as exc:
        logger.warning("Neo4j snapshot projection skipped for %s: %s", snapshot.id, exc)
        if raise_on_error:
            raise
        return None


def query_neighborhood(snapshot, data, *, raise_on_error=False):
    """Query a one-hop typed neighborhood for an immutable snapshot via Neo4j Cypher."""
    driver, database = get_driver()
    if driver is None:
        return None
    skey = snapshot_key_for(snapshot)
    try:
        records, _, _ = driver.execute_query(
            """
            MATCH (s:ContinuumSnapshot {snapshotKey: $snapshotKey, synced: true})
            RETURN s.snapshotKey AS snapshotKey
            LIMIT 1
            """,
            snapshotKey=skey,
            routing_=RoutingControl.READ,
            database_=database,
        )
        if not records:
            if sync_snapshot_to_neo4j(snapshot, raise_on_error=raise_on_error) is None:
                return None

        def read_tx(tx):
            root_rows = list(
                tx.run(
                    """
                    MATCH (root:ContinuumArtifact {snapshotKey: $snapshotKey, artifactId: $rootArtifactId})
                    RETURN root.artifactId AS artifactId,
                           root.artifactVersionId AS artifactVersionId,
                           root.kind AS kind,
                           root.label AS label,
                           root.representationOnly AS representationOnly
                    LIMIT 1
                    """,
                    snapshotKey=skey,
                    rootArtifactId=data.rootArtifactId,
                )
            )
            if not root_rows:
                return None
            edge_rows = list(
                tx.run(
                    """
                    MATCH (s:ContinuumSnapshot {snapshotKey: $snapshotKey})-[:HAS_CONTEXT]->(c:ContinuumAssertionContext)
                    WHERE c.type IN $relationTypes
                      AND (
                        ($direction IN ['outgoing', 'both'] AND c.sourceArtifactId = $rootArtifactId)
                        OR ($direction IN ['incoming', 'both'] AND c.targetArtifactId = $rootArtifactId)
                      )
                    OPTIONAL MATCH (src:ContinuumArtifact {nodeKey: c.sourceNodeKey})
                    OPTIONAL MATCH (tgt:ContinuumArtifact {nodeKey: c.targetNodeKey})
                    RETURN c.assertionId AS assertionId,
                           c.assertionRevisionId AS assertionRevisionId,
                           c.contextId AS contextId,
                           c.sourceArtifactId AS sourceArtifactId,
                           c.sourceVersionId AS sourceVersionId,
                           c.targetArtifactId AS targetArtifactId,
                           c.targetVersionId AS targetVersionId,
                           c.type AS type,
                           c.validity AS validity,
                           c.resolution AS resolution,
                           c.evidenceIdsJson AS evidenceIdsJson,
                           c.unavailableEndpointsJson AS unavailableEndpointsJson,
                           src.artifactId AS srcArtifactId,
                           src.artifactVersionId AS srcVersionId,
                           src.kind AS srcKind,
                           src.label AS srcLabel,
                           src.representationOnly AS srcRepOnly,
                           tgt.artifactId AS tgtArtifactId,
                           tgt.artifactVersionId AS tgtVersionId,
                           tgt.kind AS tgtKind,
                           tgt.label AS tgtLabel,
                           tgt.representationOnly AS tgtRepOnly
                    ORDER BY c.assertionRevisionId ASC, c.contextId ASC
                    """,
                    snapshotKey=skey,
                    relationTypes=list(data.relationTypes),
                    direction=data.direction,
                    rootArtifactId=data.rootArtifactId,
                )
            )
            return root_rows[0], edge_rows

        with driver.session(database=database) as session:
            fetched = session.execute_read(read_tx)
        if fetched is None:
            return None
        root_row, edge_rows = fetched
        root_node = {
            "artifactId": root_row["artifactId"],
            "artifactVersionId": root_row["artifactVersionId"],
            "kind": root_row["kind"],
            "label": root_row["label"],
            "representationOnly": bool(root_row["representationOnly"]),
            "availability": "available",
            "limitations": [],
        }
        items = []
        for row in edge_rows:
            nodes = []
            if row["srcArtifactId"] is not None:
                nodes.append(
                    {
                        "artifactId": row["srcArtifactId"],
                        "artifactVersionId": row["srcVersionId"],
                        "kind": row["srcKind"],
                        "label": row["srcLabel"],
                        "representationOnly": bool(row["srcRepOnly"]),
                        "availability": "available",
                        "limitations": [],
                    }
                )
            if row["tgtArtifactId"] is not None:
                nodes.append(
                    {
                        "artifactId": row["tgtArtifactId"],
                        "artifactVersionId": row["tgtVersionId"],
                        "kind": row["tgtKind"],
                        "label": row["tgtLabel"],
                        "representationOnly": bool(row["tgtRepOnly"]),
                        "availability": "available",
                        "limitations": [],
                    }
                )
            unavailable = json.loads(row["unavailableEndpointsJson"])
            edge = None
            if not unavailable:
                edge = {
                    "assertionId": row["assertionId"],
                    "assertionRevisionId": row["assertionRevisionId"],
                    "contextId": row["contextId"],
                    "sourceArtifactId": row["sourceArtifactId"],
                    "sourceVersionId": row["sourceVersionId"],
                    "targetArtifactId": row["targetArtifactId"],
                    "targetVersionId": row["targetVersionId"],
                    "type": row["type"],
                    "validity": row["validity"],
                    "resolution": row["resolution"],
                    "evidenceIds": json.loads(row["evidenceIdsJson"]),
                }
            items.append(
                {
                    "edge": edge,
                    "nodes": nodes,
                    "unresolved": {"contextId": row["contextId"], "endpoints": unavailable} if unavailable else None,
                }
            )
        return items, root_node
    except (Neo4jError, ServiceUnavailable, OSError) as exc:
        logger.warning("Neo4j neighborhood query failed for %s: %s", snapshot.id, exc)
        if raise_on_error:
            raise
        return None
