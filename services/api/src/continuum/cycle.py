"""Completion and bounded JSON export reuse retained activities and the durable worker."""
import json
import time
from typing import Literal
from pydantic import Field
from sqlalchemy import select
from .models import ArtifactVersion, Receipt, ReviewEvent
from .pipeline_models import Activity, Operation, RepositoryView, Selection, Snapshot
from .schemas import Strict, Id
from .review import scoped, reason_data
from .security import digest, fail, utc

class CompleteInput(Strict):
    snapshotId: Id
    acknowledgedLimitations: list[str] = Field(max_length=1000)

class ExportInput(Strict):
    snapshotId: Id
    format: Literal["json"]


def completion(db, snapshot):
    from .pipeline import stable
    record = db.get(Activity, stable('completion-v1', snapshot.selection_id, snapshot.snapshot_version))
    return record.document if record else None


def execute(db, actor, repository, envelope):
    from .pipeline import stable
    data = (CompleteInput if envelope.command == 'complete_cycle' else ExportInput).model_validate(envelope.input)
    fingerprint = digest(json.dumps(envelope.model_dump(), sort_keys=True, separators=(',', ':'), ensure_ascii=False))
    key = actor.id, repository.id, envelope.command, envelope.requestId
    prior = db.get(Receipt, key)
    if prior:
        if prior.input_digest != fingerprint:
            fail('idempotency_conflict', 409)
        return prior.result
    view = scoped(db, RepositoryView, envelope.viewId, repository.id)
    snapshot = scoped(db, Snapshot, data.snapshotId, repository.id)
    selected = scoped(db, Selection, snapshot.selection_id, repository.id)
    if view.selection_id != selected.id:
        fail('invalid_input')
    if envelope.command == 'complete_cycle':
        if view.mode != 'active':
            fail('historical_context')
        if selected.snapshot_version != snapshot.snapshot_version:
            fail('snapshot_conflict', 409, {'currentSnapshotVersion': selected.snapshot_version})
        active = list(db.scalars(select(Operation.id).where(Operation.selection_id == selected.id, Operation.kind.in_(['capture', 'discovery']), Operation.status.in_(['queued', 'running']))))
        if active:
            fail('processing_active', 409, {'operationIds': active})
        header = snapshot.document['snapshot']
        if header['pendingReviewCount']:
            fail('pending_review', 409, {'pendingReviewCount': header['pendingReviewCount']})
        if len(set(data.acknowledgedLimitations)) != len(data.acknowledgedLimitations) or set(data.acknowledgedLimitations) != set(header['limitations']):
            fail('invalid_input', details={'fields': ['acknowledgedLimitations']})
        result = completion(db, snapshot)
        if result is None:
            identity = stable('completion-v1', selected.id, snapshot.snapshot_version)
            result = {'completionId': identity, 'snapshotId': snapshot.id, 'actorId': actor.id, 'recordedAt': utc(),
                'acknowledgedLimitations': data.acknowledgedLimitations, 'pendingReviewCount': 0, 'openFollowUpCount': header['openFollowUpCount']}
            db.add(Activity(id=identity, repository_id=repository.id, document=result))
    else:
        if data.format != 'json':
            fail('invalid_input')
        operation = Operation(repository_id=repository.id, selection_id=selected.id, actor_id=actor.id,
            kind='export', deadline_at=int(time.time()) + 300, result_metadata={'snapshotId': snapshot.id})
        db.add(operation); db.flush()
        result = {'operationId': operation.id, 'status': 'queued'}
    response = {'schemaVersion': '0.1.0', 'requestId': envelope.requestId, 'result': result}
    db.add(Receipt(actor_id=actor.id, repository_id=repository.id, command=envelope.command, request_id=envelope.requestId, input_digest=fingerprint, result=response)); db.flush()
    return response


def publish_export(db, operation):
    snapshot = scoped(db, Snapshot, operation.result_metadata['snapshotId'], operation.repository_id)
    header = snapshot.document['snapshot']
    judgments, references = [], []
    for item in snapshot.document['assertions']:
        event = scoped(db, ReviewEvent, item['projection']['effectiveJudgmentEventId'], operation.repository_id) if item['projection']['effectiveJudgmentEventId'] else None
        judgments.append({**item, 'effectiveEvent': {'id': event.id, **reason_data(event.reason), 'actorId': event.actor_id, 'recordedAt': event.recorded_at, 'payload': event.payload} if event else None})
        for retained in db.scalars(select(ReviewEvent).where(ReviewEvent.context_id == item['projection']['contextId'], ReviewEvent.sequence <= item['historySequence']).order_by(ReviewEvent.sequence)):
            references.append({'eventId': retained.id, 'contextId': retained.context_id, 'assertionRevisionId': retained.assertion_revision_id,
                'artifactVersionIds': [e['versionId'] for e in [item['assertion']['source'], item['assertion']['target']] if e['versionId']], 'evidenceIds': item['assertion']['evidenceIds']})
    unavailable = []
    for row in snapshot.document['artifacts']:
        source = scoped(db, ArtifactVersion, row['versionId'], operation.repository_id)
        if digest(source.content) != source.digest:
            unavailable.append(row['versionId'])
    document = {'schemaVersion': '0.1.0', 'exportId': operation.id, 'snapshotId': snapshot.id, 'snapshotVersion': snapshot.snapshot_version,
        'selection': header['selection'], 'provenance': header['provenance'], 'releaseRecordId': None,
        'judgments': judgments, 'followUps': snapshot.document['followUps'], 'historyReferences': references,
        'coverage': header['coverage'], 'completion': completion(db, snapshot),
        'limitations': [*header['limitations'], 'Export contains retained references, not a standalone source archive.', 'No release record is attached.', *(['Exact source integrity failed for: ' + ', '.join(unavailable)] if unavailable else [])]}
    encoded = json.dumps(document, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    if len(encoded.encode('utf-8')) > 4 * 1024 * 1024:
        fail('limit_exceeded', 422, {'limitName': 'exportBytes', 'maximum': 4194304, 'unit': 'bytes'})
    db.add(Activity(id=operation.id, repository_id=operation.repository_id, document=document)); db.flush()
    operation.result_metadata = {'snapshotId': snapshot.id, 'exportId': operation.id, 'document': document, 'digest': {'algorithm': 'sha256', 'value': digest(encoded)}}
    operation.status, operation.lease_until, operation.result_snapshot_id = 'complete', 0, snapshot.id


def read_export(db, repository, operation_id):
    operation = scoped(db, Operation, operation_id, repository.id)
    if operation.kind != 'export':
        fail('invalid_input')
    ready = operation.status == 'complete'
    return {'status': operation.status, 'snapshotId': operation.result_metadata['snapshotId'], 'exportId': operation.id if ready else None,
        'digest': operation.result_metadata.get('digest') if ready else None, 'document': operation.result_metadata.get('document') if ready else None, 'limitations': operation.limitations}
