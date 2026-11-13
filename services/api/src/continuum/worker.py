import logging
import time
from fastapi import HTTPException

from sqlalchemy import and_, or_, select, text
from sqlalchemy.exc import SQLAlchemyError

from .acquisition import AcquisitionError, WORKSPACE
from .discovery import discover, load_sources
from .models import (Account, Artifact, ArtifactVersion, Assertion, AssertionRevision,
                     Evidence, Grant, Repository, ReviewContext)
from .pipeline import make_snapshot, registered_inputs, stable
from .pipeline_models import Activity, EvidenceOrigin, Operation, RevisionOrigin, Selection, SelectionArtifact, SelectionContext
from .security import utc


def authority(db, operation_id):
    initial = db.get(Operation, operation_id)
    if initial is None:
        return None
    actor = db.scalar(select(Account).where(Account.id == initial.actor_id).with_for_update())
    grant = db.scalar(select(Grant).where(Grant.actor_id == initial.actor_id,
                                         Grant.repository_id == initial.repository_id).with_for_update())
    repository = db.scalar(select(Repository).where(Repository.id == initial.repository_id).with_for_update())
    operation = db.scalar(select(Operation).where(Operation.id == operation_id).with_for_update().execution_options(populate_existing=True))
    permitted = actor is not None and actor.enabled and grant is not None and grant.role == "reviewer"
    return actor, repository, operation, db.get(Selection, operation.selection_id), permitted


def failed(operation, selection, repository, reason):
    operation.status = "failed"
    operation.lease_until = 0
    operation.limitations = [reason]
    selection.snapshot_version += 1
    repository.snapshot_version += 1
    operation.published_version = selection.snapshot_version


def claim(factory, operation_id):
    with factory.begin() as db:
        resolved = authority(db, operation_id)
        if resolved is None:
            return None
        actor, repository, operation, selection, permitted = resolved
        now = int(time.time())
        if operation.status not in {"queued", "running"} or operation.status == "running" and operation.lease_until > now:
            return None
        if not permitted:
            failed(operation, selection, repository, "Initiating reviewer no longer has publication permission.")
            return None
        try:
            inventory, config, manifest, profile = registered_inputs(db, repository.id, selection.inventory_id, selection.configuration_id)
        except (AcquisitionError, HTTPException, KeyError, OSError, ValueError):
            failed(operation, selection, repository, "Registered input or profile validation failed before processing.")
            return None
        limits = profile["limits"]
        if operation.deadline_at <= now or operation.attempts >= limits["maximumAttempts"]:
            failed(operation, selection, repository, "Processing deadline or maximumAttempts reached.")
            return None
        operation.status, operation.lease_until = "running", now + limits["leaseSeconds"]
        operation.generation += 1
        operation.attempts += 1
        operation.selection_version = selection.snapshot_version
        return {"operationId": operation.id, "generation": operation.generation, "kind": operation.kind,
                "selectionId": selection.id, "commitId": selection.target_revision["commitId"],
                "manifestPath": WORKSPACE / inventory.manifest_path, "acceptancePath": WORKSPACE / inventory.acceptance_path,
                "profile": profile, "profileDigest": config.profile_digest, "manifestDigest": inventory.manifest_digest,
                "manifest": manifest}


def renew(factory, claimed):
    with factory.begin() as db:
        actor, repository, operation, selection, permitted = authority(db, claimed["operationId"])
        now = int(time.time())
        if operation.status != "running" or operation.generation != claimed["generation"] or operation.lease_until <= now:
            return False
        if not permitted or operation.deadline_at <= now:
            failed(operation, selection, repository, "Processing permission or deadline expired before publication.")
            return False
        operation.lease_until = now + claimed["profile"]["limits"]["leaseSeconds"]
        return True


def provenance(operation, method, input_ids):
    return {"activityId": operation.id, "methodId": method, "agent": {"kind": "system", "id": "continuum-worker-v1"},
            "initiatedByActorId": operation.actor_id, "inputVersionIds": sorted(set(input_ids)),
            "recordedAt": utc(), "limitations": ["Processing provenance does not confirm semantic correctness."]}


def publish_capture(db, operation, selection, sources):
    result = []
    activity = provenance(operation, "immutable-file-capture-v1", [])
    activity["configurationId"] = selection.configuration_id
    activity["sourceObjects"] = [{"commitId": source.commit, "blobId": source.blob, "path": source.path,
                                   "contentSha256": source.digest} for source in sources]
    db.add(Activity(id=operation.id, repository_id=selection.repository_id, document=activity))
    db.flush()
    for source in sources:
        artifact_id = stable(selection.repository_id, "artifact", source.path)
        version_id = stable(artifact_id, source.commit, source.blob)
        if not db.get(Artifact, artifact_id):
            db.add(Artifact(id=artifact_id, repository_id=selection.repository_id, kind=source.kind, path=source.path))
            db.flush()
        version = db.get(ArtifactVersion, version_id)
        if version is None:
            version = ArtifactVersion(id=version_id, artifact_id=artifact_id, repository_id=selection.repository_id,
                identity={"kind": "file", "repositoryId": selection.repository_id, "path": source.path,
                          "commit": {"objectAlgorithm": "sha1", "commitId": source.commit}, "blobId": source.blob,
                          "format": source.format, "provenance": activity}, content=source.text, digest=source.digest)
            db.add(version)
            db.flush()
        elif version.digest != source.digest or version.content != source.text:
            raise AcquisitionError("Retained version identity conflicts with source")
        if not db.get(SelectionArtifact, (selection.id, artifact_id)):
            db.add(SelectionArtifact(selection_id=selection.id, artifact_id=artifact_id, version_id=version_id))
        result.append({"path": source.path, "artifactId": artifact_id, "artifactVersionId": version_id,
                       "outcome": "captured", "coverage": [{"function": "ingestion", "status": "complete", "eligibleCount": 1,
                       "processedCount": 1, "excludedCount": 0, "limitations": []}], "provenance": activity, "reason": None})
    operation.result_items = result
    operation.coverage = [{"function": "ingestion", "status": "complete", "eligibleCount": len(sources),
                           "processedCount": len(sources), "excludedCount": 0, "limitations": ["Only the accepted file inventory was captured."]}]
    operation.limitations = ["Capture does not establish identifier extraction or relationship discovery."]
    operation.status = "complete"


def publish_discovery(db, operation, selection, generated):
    versions = list(db.scalars(select(ArtifactVersion).join(SelectionArtifact, SelectionArtifact.version_id == ArtifactVersion.id)
                               .where(SelectionArtifact.selection_id == selection.id)))
    by_path = {version.identity["path"]: version for version in versions}
    activity = provenance(operation, generated["methodId"], [version.id for version in versions])
    activity["configurationId"] = selection.configuration_id
    db.add(Activity(id=operation.id, repository_id=selection.repository_id, document=activity))
    db.flush()
    staged_evidence, staged_assertions, staged_revisions, staged_contexts, result = {}, {}, {}, {}, []
    for candidate in generated["candidates"]:
        source, target = by_path[candidate["sourcePath"]], by_path[candidate["targetPath"]]
        if source.identity["blobId"] != candidate["sourceBlobId"] or target.identity["blobId"] != candidate["targetBlobId"]:
            raise AcquisitionError("Discovery endpoints differ from captured source")
        evidence_ids = set()
        for match in candidate["evidence"]:
            for reference in [match["document"], match["code"]]:
                version = by_path[reference["path"]]
                identity = stable("evidence", version.id, reference["locator"], reference["excerptSha256"], generated["profileSha256"])
                staged_evidence[identity] = Evidence(id=identity, repository_id=selection.repository_id, artifact_version_id=version.id,
                    locator=reference["locator"], availability="available", reason=None, method_id=generated["methodId"], excerpt_digest=reference["excerptSha256"])
                evidence_ids.add(identity)
        evidence_ids = sorted(evidence_ids)
        assertion_id = stable(selection.repository_id, "assertion", "documents", source.artifact_id, target.artifact_id)
        revision_id = stable(assertion_id, source.id, target.id, generated["profileSha256"], evidence_ids)
        context_id = stable("initial-context", selection.id, revision_id)
        staged_assertions[assertion_id] = Assertion(id=assertion_id, repository_id=selection.repository_id, type="documents",
            source_artifact_id=source.artifact_id, target_artifact_id=target.artifact_id)
        endpoint = lambda version: {"artifactId": version.artifact_id, "versionId": version.id,
                                   "availability": "available", "reason": None, "priorVersionId": None}
        staged_revisions[revision_id] = AssertionRevision(id=revision_id, repository_id=selection.repository_id,
            assertion_id=assertion_id, source=endpoint(source), target=endpoint(target), evidence_ids=evidence_ids,
            method_id=generated["methodId"], limitations=generated["limitations"])
        staged_contexts[context_id] = ReviewContext(id=context_id, repository_id=selection.repository_id,
            assertion_revision_id=revision_id, target_revision=selection.target_revision)
        result.append({"assertionId": assertion_id, "assertionRevisionId": revision_id, "contextId": context_id,
            "evidenceIds": evidence_ids, "origin": "automatic", "provenance": activity,
            "matchedEvidence": candidate["evidence"]})
    for model, staged in [(Evidence, staged_evidence), (Assertion, staged_assertions),
                           (AssertionRevision, staged_revisions), (ReviewContext, staged_contexts)]:
        existing = set(db.scalars(select(model.id).where(model.id.in_(staged)))) if staged else set()
        db.add_all([row for identity, row in staged.items() if identity not in existing])
        db.flush()
        if model is Evidence:
            db.add_all([EvidenceOrigin(evidence_id=identity, activity_id=operation.id) for identity in staged if identity not in existing])
        elif model is AssertionRevision:
            db.add_all([RevisionOrigin(revision_id=identity, activity_id=operation.id) for identity in staged if identity not in existing])
        db.flush()
    existing_contexts = set(db.scalars(select(SelectionContext.context_id).where(SelectionContext.selection_id == selection.id)))
    db.add_all([SelectionContext(selection_id=selection.id, context_id=identity)
                for identity in staged_contexts if identity not in existing_contexts])
    operation.result_items = sorted(result, key=lambda item: item["assertionRevisionId"])
    processed = sum(item["status"] == "complete" for item in generated["coverage"])
    code_count = sum(item["function"] == "code_identifier_index" for item in generated["coverage"])
    document_count = sum(item["function"] == "document_line_scan" for item in generated["coverage"])
    processed_pairs = (sum(item["function"] == "code_identifier_index" and item["status"] == "complete" for item in generated["coverage"])
                       * sum(item["function"] == "document_line_scan" and item["status"] == "complete" for item in generated["coverage"]))
    operation.result_metadata = {"profileSha256": generated["profileSha256"], "manifestSha256": generated["manifestSha256"],
                                 "unresolvedPaths": generated["unresolvedPaths"]}
    operation.coverage = [{"function": "extraction", "status": generated["status"], "eligibleCount": len(generated["coverage"]),
                           "processedCount": processed, "excludedCount": 0, "limitations": generated["limitations"]},
                          {"function": "evidence", "status": generated["status"], "eligibleCount": code_count * document_count,
                           "processedCount": processed_pairs, "excludedCount": 0, "limitations": generated["limitations"]}]
    operation.limitations = generated["limitations"] + [f"Unresolved explicit paths: {len(generated['unresolvedPaths'])}."]
    operation.status = "complete" if generated["status"] == "complete" else "partial"


def publish(factory, claimed, sources, generated=None):
    with factory.begin() as db:
        actor, repository, operation, selection, permitted = authority(db, claimed["operationId"])
        now = int(time.time())
        if operation.status != "running" or operation.generation != claimed["generation"]:
            return False
        if not permitted or operation.lease_until <= now or operation.deadline_at <= now:
            failed(operation, selection, repository, "Processing authority or lease expired before publication.")
            return False
        if selection.snapshot_version != operation.selection_version:
            failed(operation, selection, repository, "Selected context changed during processing; publication was not applied.")
            return False
        if operation.kind == "capture":
            publish_capture(db, operation, selection, sources)
        else:
            publish_discovery(db, operation, selection, generated)
        selection.snapshot_version += 1
        repository.snapshot_version += 1
        operation.published_version = selection.snapshot_version
        db.flush()
        operation.result_snapshot_id = make_snapshot(db, selection).id
        if operation.lease_until <= int(time.time()):
            raise AcquisitionError("Processing lease expired during publication")
        operation.lease_until = 0
    return True


def run_operation(factory, operation_id):
    claimed = claim(factory, operation_id)
    if claimed is None:
        return False
    last_heartbeat = time.monotonic()
    attempt_started = last_heartbeat

    def pulse():
        nonlocal last_heartbeat
        if time.monotonic() - attempt_started >= claimed["profile"]["limits"]["maximumAttemptSeconds"]:
            raise AcquisitionError("maximumAttemptSeconds reached; no publication was committed.")
        if time.monotonic() - last_heartbeat < claimed["profile"]["limits"]["heartbeatSeconds"]:
            return True
        last_heartbeat = time.monotonic()
        return renew(factory, claimed)

    try:
        label = next(label for label, value in claimed["manifest"]["revisions"].items() if value["commitId"] == claimed["commitId"])
        _, sources = load_sources(claimed["manifestPath"], claimed["acceptancePath"], label)
        if not pulse():
            return False
        generated = None
        if claimed["kind"] == "discovery":
            generated = discover(sources, claimed["profile"], claimed["profileDigest"], claimed["manifestDigest"], heartbeat=pulse)
        return publish(factory, claimed, sources, generated)
    except (AcquisitionError, HTTPException, KeyError, OSError, ValueError, SQLAlchemyError) as exc:
        with factory.begin() as db:
            actor, repository, operation, selection, permitted = authority(db, operation_id)
            if operation.status == "running" and operation.generation == claimed["generation"]:
                reason = str(exc) if isinstance(exc, AcquisitionError) else "Processing failed; no successful publication was committed."
                failed(operation, selection, repository, reason)
        return False


def worker_once(factory):
    # One session advisory lock per schema enforces the accepted single-worker limit.
    with factory.kw["bind"].connect() as connection:
        acquired = connection.scalar(text("SELECT pg_try_advisory_lock(hashtext(current_schema()), hashtext('continuum-worker-v1'))"))
        connection.commit()
        if not acquired:
            return False
        try:
            with factory() as db:
                now = int(time.time())
                identity = db.scalar(select(Operation.id).where(or_(Operation.status == "queued",
                    and_(Operation.status == "running", Operation.lease_until <= now))).order_by(Operation.id).limit(1))
            return run_operation(factory, identity) if identity else False
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(hashtext(current_schema()), hashtext('continuum-worker-v1'))"))
            connection.commit()


def worker_loop(factory, stop):
    while not stop.is_set():
        try:
            worked = worker_once(factory)
        except Exception:
            logging.warning("Continuum worker iteration failed; durable operations remain inspectable.")
            worked = False
        if not worked:
            stop.wait(1)
