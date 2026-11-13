"""Bounded path-identity comparison of retained, accepted file snapshots."""
import json

from .git_changes import compare_files
from .models import ArtifactVersion, AssertionRevision, Evidence, Receipt, ReviewContext
from .pipeline_models import Activity, RevisionOrigin, Selection, SelectionArtifact, SelectionContext, Snapshot, RepositoryView, SelectedRecord
from .pipeline import registered_inputs, selection_data, stable
from .review import scoped
from .schemas import Id, Strict
from .security import digest, fail, utc


class CompareInput(Strict):
    baseSnapshotId: Id
    targetSnapshotId: Id


def compare(db, actor, repository, envelope):
    data = CompareInput.model_validate(envelope.input)
    fingerprint = digest(json.dumps(envelope.model_dump(), sort_keys=True, separators=(',', ':'), ensure_ascii=False))
    key = actor.id, repository.id, envelope.command, envelope.requestId
    prior = db.get(Receipt, key)
    if prior:
        if prior.input_digest != fingerprint:
            fail('idempotency_conflict', 409)
        return prior.result
    view = scoped(db, RepositoryView, envelope.viewId, repository.id)
    base = scoped(db, Snapshot, data.baseSnapshotId, repository.id)
    target = scoped(db, Snapshot, data.targetSnapshotId, repository.id)
    before = scoped(db, Selection, base.selection_id, repository.id)
    after = scoped(db, Selection, target.selection_id, repository.id)
    if view.selection_id != after.id or view.mode != 'active':
        fail('invalid_input')
    if before.inventory_id != after.inventory_id or before.configuration_id != after.configuration_id:
        fail('invalid_input')
    _, _, manifest, _ = registered_inputs(db, repository.id, after.inventory_id, after.configuration_id)
    files = lambda snapshot: {a['artifactId']: a for a in snapshot.document['artifacts'] if a['identity'].get('kind') == 'file'}
    old, new = files(base), files(target)
    captured = lambda snapshot: next((c for c in snapshot.document['snapshot']['coverage'] if c['function'] == 'ingestion'), {})
    if any(captured(s).get('status') != 'complete' or captured(s).get('processedCount') != len(f) or captured(s).get('eligibleCount') != len(f) for s, f in [(base, old), (target, new)]):
        fail('revision_unavailable', details={'reason': 'Capture both accepted inventories before comparing.'})
    # Read and verify retained bytes, rather than comparing labels or a current branch.
    for row in [*old.values(), *new.values()]:
        version = scoped(db, ArtifactVersion, row['versionId'], repository.id)
        if digest(version.content) != version.digest:
            fail('missing_evidence')
    versions = {}
    for row in [*old.values(), *new.values()]:
        versions[row['versionId']] = scoped(db, ArtifactVersion, row['versionId'], repository.id)
    changes, technology = compare_files(
        {row['path']: versions[row['versionId']].content for row in old.values()},
        {row['path']: versions[row['versionId']].content for row in new.values()})
    by_path = {row['path']: row for row in [*old.values(), *new.values()]}
    changed = {by_path[row['path']]['artifactId'] for row in changes}
    for row in changes:
        artifact_id = by_path[row['path']]['artifactId']
        row.update(baseVersionId=old.get(artifact_id, {}).get('versionId'), targetVersionId=new.get(artifact_id, {}).get('versionId'))
    # Authored records keep their exact selected version unless the target explicitly selected a newer one.
    records = {a['artifactId']: a for a in base.document['artifacts'] if a['identity'].get('kind') == 'record'}
    records.update({a['artifactId']: a for a in target.document['artifacts'] if a['identity'].get('kind') == 'record'})
    for artifact_id, row in records.items():
        previous = next((a for a in base.document['artifacts'] if a['artifactId'] == artifact_id), None)
        if previous and previous['versionId'] != row['versionId']:
            changed.add(artifact_id)
            changes.append({'path': row['path'], 'kind': 'record_modified', 'baseVersionId': previous['versionId'], 'targetVersionId': row['versionId'], 'artifactKind': row['kind']})
    for row in records.values():
        version = scoped(db, ArtifactVersion, row['versionId'], repository.id)
        if version.artifact_id != row['artifactId'] or digest(version.content) != version.digest:
            fail('missing_evidence')
    incoming_versions = {**new, **records}
    # A comparison's parent snapshot retains unchanged claims omitted from its direct-impact queue.
    lineage, seen = [], set()
    cursor = base
    while cursor.id not in seen:
        seen.add(cursor.id)
        lineage.append(cursor)
        parent = (cursor.document.get('comparison') or {}).get('baseSnapshotId')
        if not parent:
            break
        cursor = scoped(db, Snapshot, parent, repository.id)
    claims = {}
    for ancestor in reversed(lineage):
        for item in ancestor.document['assertions']:
            claims[item['assertion']['assertionId']] = item
    identity = stable('comparison-v1', repository.id, before.id, base.snapshot_version, after.id, target.snapshot_version)
    selected = db.get(Selection, identity)
    if selected is None:
        selected = Selection(id=identity, repository_id=repository.id, inventory_id=after.inventory_id,
            configuration_id=after.configuration_id, base_revision=before.target_revision, target_revision=after.target_revision)
        db.add(selected); db.flush()
        for row in new.values():
            db.add(SelectionArtifact(selection_id=identity, artifact_id=row['artifactId'], version_id=row['versionId']))
        for row in records.values():
            db.add(SelectedRecord(selection_id=identity, artifact_id=row['artifactId'], version_id=row['versionId']))
        limitations = ['Accepted file inventory only; native Git comparison, path identity, no rename inference or transitive propagation.',
                        'Only directly affected nonterminal base assertions are queued; unchanged assertions are not revalidated.',
                        'Line evidence transfers only when the same line range retains the exact excerpt digest.']
        document = {'activityId': identity, 'methodId': 'git-retained-path-comparison-v1', 'technology': technology, 'agent': {'kind': 'system', 'id': 'continuum'},
                    'initiatedByActorId': actor.id, 'recordedAt': utc(), 'baseSnapshotId': base.id, 'targetSnapshotId': target.id,
                    'baseRevision': before.target_revision, 'targetRevision': after.target_revision, 'changes': changes,
                    'limitations': limitations, 'impacts': []}
        origins = []
        for item in claims.values():
            a, p = item['assertion'], item['projection']
            if p['resolution'] == 'superseded' or p['validity'] in {'rejected', 'retired'}:
                continue
            if not {a['source']['artifactId'], a['target']['artifactId']} & changed:
                continue
            current = scoped(db, ReviewContext, p['contextId'], repository.id)
            if current.projection_version != p['projectionVersion']:
                fail('snapshot_conflict', 409, {'currentSnapshotVersion': before.snapshot_version})
            endpoints = []
            for endpoint in [a['source'], a['target']]:
                incoming = incoming_versions.get(endpoint['artifactId'])
                endpoints.append({'artifactId': endpoint['artifactId'], 'versionId': incoming['versionId'] if incoming else None,
                    'availability': 'available' if incoming else 'missing', 'reason': None if incoming else 'Path absent in the selected target inventory; no replacement inferred.',
                    'priorVersionId': endpoint.get('versionId')})
            evidence_ids = []
            for original in item['evidence']:
                prior_evidence = scoped(db, Evidence, original['id'], repository.id)
                old_version = scoped(db, ArtifactVersion, prior_evidence.artifact_version_id, repository.id)
                incoming = incoming_versions.get(old_version.artifact_id)
                version = scoped(db, ArtifactVersion, incoming['versionId'], repository.id) if incoming else old_version
                locator, excerpt = prior_evidence.locator, None
                if incoming and locator.get('kind') == 'field':
                    excerpt = version.identity.get('path')
                elif incoming and locator.get('kind') == 'lines':
                    lines = version.content.splitlines()
                    if locator['endLine'] <= len(lines):
                        excerpt = '\n'.join(lines[locator['startLine'] - 1:locator['endLine']])
                available = incoming and prior_evidence.availability == 'available' and excerpt is not None and digest(excerpt) == prior_evidence.excerpt_digest
                eid = stable(identity, 'evidence', original['id'])
                if not db.get(Evidence, eid):
                    db.add(Evidence(id=eid, repository_id=repository.id, artifact_version_id=version.id, locator=locator,
                        availability='available' if available else 'unresolved', reason=None if available else 'Incoming anchor continuity is unresolved; earlier source is retained.',
                        method_id='direct-path-comparison-v1', excerpt_digest=digest(excerpt) if available else None)); db.flush()
                evidence_ids.append(eid)
            rid, cid = stable(identity, a['id']), stable(identity, 'context', a['id'])
            db.add(AssertionRevision(id=rid, repository_id=repository.id, assertion_id=a['assertionId'], source=endpoints[0], target=endpoints[1],
                evidence_ids=evidence_ids, method_id='direct-path-comparison-v1', limitations=limitations, supersedes_revision_id=a['id']))
            db.flush()
            validity = 'stale' if p['validity'] in {'confirmed', 'stale'} else 'candidate'
            db.add(ReviewContext(id=cid, repository_id=repository.id, assertion_revision_id=rid, kind='incoming', base_revision=before.target_revision,
                target_revision=after.target_revision, comparison_id=identity, initial_validity=validity, validity=validity))
            db.flush()
            db.add(SelectionContext(selection_id=identity, context_id=cid))
            origins.append(RevisionOrigin(revision_id=rid, activity_id=identity))
            document['impacts'].append({'contextId': cid, 'baseContextId': p['contextId'], 'assertionRevisionId': rid,
                                        'reason': 'A registered ' + a['type'] + ' endpoint changed under exact identity.'})
        # The activity must exist before origin foreign keys flush.
        db.add(Activity(id=identity, repository_id=repository.id, document=document)); db.flush()
        db.add_all(origins); db.flush()
    historical = RepositoryView(repository_id=repository.id, selection_id=before.id, mode='historical')
    db.add(historical); db.flush()
    response = {'schemaVersion': '0.1.0', 'requestId': envelope.requestId, 'result': {'selection': selection_data(selected),
                'comparisonId': identity, 'baseRepositoryViewId': historical.id, 'baseSnapshotId': base.id}}
    db.add(Receipt(actor_id=actor.id, repository_id=repository.id, command=envelope.command, request_id=envelope.requestId, input_digest=fingerprint, result=response))
    return response
