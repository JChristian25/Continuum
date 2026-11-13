from .relations import validate_relation
import json

from sqlalchemy import select

from .models import Artifact, ArtifactVersion, Assertion, AssertionRevision, Evidence, Receipt, ReviewContext, new_id
from .pipeline import stable
from .pipeline_models import (Activity, EvidenceOrigin, RecordCurrent, RepositoryView,
                              RevisionOrigin, SelectedRecord, Selection, SelectionArtifact, SelectionContext)
from .pipeline_schemas import ArtifactSource, CaptureCandidate, CaptureRecord, ReviseRecord
from .review import projection, scoped, validate_evidence
from .security import digest, fail, utc


def anchor(db, repository_id, version_id, locator):
    version = scoped(db, ArtifactVersion, version_id, repository_id)
    if digest(version.content) != version.digest:
        fail("missing_evidence", details={"evidenceIds": []})
    if locator["kind"] == "lines":
        lines = version.content.splitlines()
        if locator["endLine"] > len(lines):
            fail("missing_evidence", details={"evidenceIds": []})
        excerpt = "\n".join(lines[locator["startLine"] - 1:locator["endLine"]])
    else:
        excerpt = version.identity.get("path")
        if not isinstance(excerpt, str):
            fail("missing_evidence", details={"evidenceIds": []})
    return version, digest(excerpt)


def activity(db, actor, repository_id, method, input_ids, reason=None, extra_limitations=()):
    identity = new_id()
    document = {"activityId": identity, "methodId": method, "agent": {"kind": "practitioner", "id": actor.id},
        "inputVersionIds": sorted(set(input_ids)), "configurationId": None, "recordedAt": utc(),
        "limitations": ["Attributed capture is not a confirmed relationship.", *extra_limitations], "reason": reason}
    db.add(Activity(id=identity, repository_id=repository_id, document=document))
    db.flush()
    return document


def capture_record(db, actor, repository, selection, data, revise):
    input_ids = []
    if isinstance(data.sourceReference, ArtifactSource):
        source, _ = anchor(db, repository.id, data.sourceReference.artifactVersionId, data.sourceReference.locator.model_dump())
        if not db.get(SelectionArtifact, (selection.id, source.artifact_id)) and not db.get(SelectedRecord, (selection.id, source.artifact_id)):
            fail("invalid_input", details={"fields": ["sourceReference"]})
        input_ids.append(source.id)
    if revise:
        artifact = scoped(db, Artifact, data.artifactId, repository.id)
        current = db.get(RecordCurrent, artifact.id)
        if current is None or not db.get(SelectedRecord, (selection.id, artifact.id)):
            fail("not_found", 404)
        if current.record_version != data.expectedRecordVersion:
            fail("record_conflict", 409, {"currentRecordVersion": current.record_version})
        version_number = current.record_version + 1
    else:
        artifact = Artifact(repository_id=repository.id, kind=data.kind, path="authored/" + new_id())
        db.add(artifact)
        db.flush()
        current, version_number = None, 1
    source = data.sourceReference.model_dump() if data.sourceReference is not None else None
    extra = ["External reference is attributed metadata; it was not fetched or independently verified."] if source and source["kind"] == "external" else []
    provenance = activity(db, actor, repository.id, "authored-record-revision-v1" if revise else "authored-record-capture-v1",
                          input_ids, data.reason if revise else None, extra)
    version = ArtifactVersion(id=stable(artifact.id, "record", version_number), artifact_id=artifact.id,
        repository_id=repository.id, content=data.content, digest=digest(data.content),
        identity={"kind": "record", "recordId": artifact.id, "recordVersion": version_number, "title": data.title,
                  "sourceReference": source, "sourceAbsenceReason": data.sourceAbsenceReason, "provenance": provenance})
    db.add(version)
    db.flush()
    if current:
        current.record_version, current.version_id = version_number, version.id
        db.get(SelectedRecord, (selection.id, artifact.id)).version_id = version.id
    else:
        db.add(RecordCurrent(artifact_id=artifact.id, record_version=version_number, version_id=version.id))
        db.add(SelectedRecord(selection_id=selection.id, artifact_id=artifact.id, version_id=version.id))
    return {"artifactId": artifact.id, "artifactVersionId": version.id, "recordVersion": version_number,
            "activityId": provenance["activityId"]}


def capture_candidate(db, actor, repository, selection, data):
    if data.targetRevision.model_dump() != selection.target_revision:
        fail("invalid_input", details={"fields": ["targetRevision"]})
    source = scoped(db, ArtifactVersion, data.sourceVersionId, repository.id)
    target = scoped(db, ArtifactVersion, data.targetVersionId, repository.id)
    source_artifact = scoped(db, Artifact, data.sourceArtifactId, repository.id)
    target_artifact = scoped(db, Artifact, data.targetArtifactId, repository.id)
    if source.artifact_id != source_artifact.id or target.artifact_id != target_artifact.id:
        fail("invalid_input")
    validate_relation(data.type, source_artifact, target_artifact)
    for version in [source, target]:
        member = db.get(SelectionArtifact, (selection.id, version.artifact_id)) or db.get(SelectedRecord, (selection.id, version.artifact_id))
        if member is None or member.version_id != version.id:
            fail("invalid_input", details={"fields": ["sourceVersionId", "targetVersionId"]})
    anchors = []
    for supplied in data.evidence:
        if supplied.artifactVersionId not in {source.id, target.id}:
            fail("invalid_input", details={"fields": ["evidence"]})
        version, excerpt_digest = anchor(db, repository.id, supplied.artifactVersionId, supplied.locator.model_dump())
        anchors.append((version.id, json.dumps(supplied.locator.model_dump(), sort_keys=True), excerpt_digest))
    anchors.sort()
    predecessor = None
    if data.predecessorContextId:
        predecessor = scoped(db, ReviewContext, data.predecessorContextId, repository.id)
        if not db.get(SelectionContext, (selection.id, predecessor.id)):
            fail("invalid_input")
        if predecessor.resolution != "resolved" or predecessor.validity not in {"rejected", "retired"}:
            fail("invalid_transition", details={"validity": predecessor.validity, "resolution": predecessor.resolution})
        assertion_id = stable(repository.id, "manual-successor", predecessor.id, data.type, source.id, target.id, anchors)
    else:
        assertion_id = stable(repository.id, "assertion", data.type, source_artifact.id, target_artifact.id)
    contexts = list(db.scalars(select(ReviewContext).join(AssertionRevision, AssertionRevision.id == ReviewContext.assertion_revision_id)
        .join(SelectionContext, SelectionContext.context_id == ReviewContext.id)
        .where(SelectionContext.selection_id == selection.id, AssertionRevision.assertion_id == assertion_id)))
    current = next((context for context in contexts if context.resolution != "superseded"), None)
    if current:
        revision = scoped(db, AssertionRevision, current.assertion_revision_id, repository.id)
        previous = [scoped(db, Evidence, identity, repository.id) for identity in revision.evidence_ids]
        prior_anchors = sorted((row.artifact_version_id, json.dumps(row.locator, sort_keys=True), row.excerpt_digest) for row in previous)
        if (not predecessor and current.validity in {"rejected", "retired"}
                or revision.source["versionId"] != source.id or revision.target["versionId"] != target.id or prior_anchors != anchors):
            fail("invalid_transition", details={"validity": current.validity, "resolution": current.resolution})
        provenance = activity(db, actor, repository.id, "manual-candidate-v1", [source.id, target.id], data.reason)
        return {"assertionId": assertion_id, "assertionRevisionId": revision.id, "contextId": current.id,
                "evidenceIds": revision.evidence_ids, "origin": "manual", "projection": projection(current), "activityId": provenance["activityId"]}
    if contexts:
        fail("invalid_transition", details={"validity": contexts[0].validity, "resolution": contexts[0].resolution})
    provenance = activity(db, actor, repository.id, "manual-candidate-v1", [source.id, target.id], data.reason)
    evidence_ids = []
    for version_id, encoded_locator, excerpt_digest in anchors:
        locator = json.loads(encoded_locator)
        identity = stable("manual-evidence", version_id, locator, excerpt_digest)
        if not db.get(Evidence, identity):
            db.add(Evidence(id=identity, repository_id=repository.id, artifact_version_id=version_id,
                locator=locator, availability="available", reason=None, method_id="manual-candidate-v1", excerpt_digest=excerpt_digest))
            db.flush()
            db.add(EvidenceOrigin(evidence_id=identity, activity_id=provenance["activityId"]))
        evidence_ids.append(identity)
    evidence_ids.sort()
    assertion = db.get(Assertion, assertion_id)
    if assertion is None:
        prior_assertion = db.get(AssertionRevision, predecessor.assertion_revision_id).assertion_id if predecessor else None
        assertion = Assertion(id=assertion_id, repository_id=repository.id, type=data.type,
            source_artifact_id=source_artifact.id, target_artifact_id=target_artifact.id, predecessor_id=prior_assertion)
        db.add(assertion)
        db.flush()
    endpoint = lambda version: {"artifactId": version.artifact_id, "versionId": version.id, "availability": "available", "reason": None, "priorVersionId": None}
    revision = AssertionRevision(id=stable(assertion_id, source.id, target.id, evidence_ids), assertion_id=assertion_id,
        repository_id=repository.id, source=endpoint(source), target=endpoint(target), evidence_ids=evidence_ids,
        method_id="manual-candidate-v1", limitations=["Manual candidate; requires a separate authorized judgment."])
    validate_evidence(db, revision, evidence_ids)
    db.add(revision)
    db.flush()
    db.add(RevisionOrigin(revision_id=revision.id, activity_id=provenance["activityId"]))
    context = ReviewContext(id=stable("initial-context", selection.id, revision.id), repository_id=repository.id,
        assertion_revision_id=revision.id, target_revision=selection.target_revision)
    db.add(context)
    db.flush()
    db.add(SelectionContext(selection_id=selection.id, context_id=context.id))
    return {"assertionId": assertion_id, "assertionRevisionId": revision.id, "contextId": context.id,
            "evidenceIds": evidence_ids, "origin": "manual", "projection": projection(context), "activityId": provenance["activityId"]}


def execute(db, actor, repository, envelope):
    types = {"capture_record": CaptureRecord, "revise_record": ReviseRecord, "capture_candidate": CaptureCandidate}
    data = types[envelope.command].model_validate(envelope.input)
    fingerprint = digest(json.dumps(envelope.model_dump(), sort_keys=True, separators=(",", ":"), ensure_ascii=False))
    key = actor.id, repository.id, envelope.command, envelope.requestId
    prior = db.get(Receipt, key)
    if prior:
        if prior.input_digest != fingerprint:
            fail("idempotency_conflict", 409)
        return prior.result
    view = scoped(db, RepositoryView, envelope.viewId, repository.id)
    if view.mode != "active":
        fail("historical_context")
    selection = scoped(db, Selection, view.selection_id, repository.id)
    from .pipeline import make_snapshot
    baseline = make_snapshot(db, selection) if envelope.command == 'revise_record' else None
    result = (capture_candidate(db, actor, repository, selection, data) if envelope.command == "capture_candidate"
              else capture_record(db, actor, repository, selection, data, envelope.command == "revise_record"))
    selection.snapshot_version += 1
    repository.snapshot_version += 1
    if baseline and any(data.artifactId in {item['assertion']['source']['artifactId'], item['assertion']['target']['artifactId']} for item in baseline.document['assertions']):
        from .comparison import compare
        from .schemas import Envelope
        db.flush()
        target_snapshot = make_snapshot(db, selection)
        comparison = compare(db, actor, repository, Envelope(schemaVersion='0.1.0', requestId=stable('record-revalidation', envelope.requestId), repositoryId=repository.id, viewId=view.id, command='compare_revisions', input={'baseSnapshotId': baseline.id, 'targetSnapshotId': target_snapshot.id}))
        result = {**result, 'selection': comparison['result']['selection'], 'comparisonId': comparison['result']['comparisonId']}
    response = {"schemaVersion": "0.1.0", "requestId": envelope.requestId, "result": result}
    db.add(Receipt(actor_id=actor.id, repository_id=repository.id, command=envelope.command,
                   request_id=envelope.requestId, input_digest=fingerprint, result=response))
    db.flush()
    return response
