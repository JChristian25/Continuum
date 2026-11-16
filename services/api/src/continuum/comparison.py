"""Bounded path-identity comparison of retained, accepted file snapshots."""
import json

from sqlalchemy import select

from .git_changes import compare_files
from .models import Account, ArtifactVersion, AssertionRevision, Evidence, Receipt, ReviewContext, ReviewEvent
from .pipeline_models import Activity, RevisionOrigin, Selection, SelectionArtifact, SelectionContext, Snapshot, RepositoryView, SelectedRecord
from .pipeline import registered_inputs, selection_data, stable
from .review import load_scoped_map, reason_data, scoped
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
    # Read and verify retained bytes once per distinct version, rather than comparing labels or a current branch.
    versions = load_scoped_map(db, ArtifactVersion, [row['versionId'] for row in [*old.values(), *new.values()]], repository.id)
    for version in versions.values():
        if digest(version.content) != version.digest:
            fail('missing_evidence')
    changes, technology = compare_files(
        {row['path']: versions[row['versionId']].content for row in old.values()},
        {row['path']: versions[row['versionId']].content for row in new.values()})
    by_path = {row['path']: row for row in [*old.values(), *new.values()]}
    changed = {by_path[row['path']]['artifactId'] for row in changes}
    for row in changes:
        artifact_id = by_path[row['path']]['artifactId']
        row.update(baseVersionId=old.get(artifact_id, {}).get('versionId'), targetVersionId=new.get(artifact_id, {}).get('versionId'))
    # Authored records keep their exact selected version unless the target explicitly selected a newer one.
    base_records = {a['artifactId']: a for a in base.document['artifacts'] if a['identity'].get('kind') == 'record'}
    records = {**base_records, **{a['artifactId']: a for a in target.document['artifacts'] if a['identity'].get('kind') == 'record'}}
    for artifact_id, row in records.items():
        previous = base_records.get(artifact_id)
        if previous and previous['versionId'] != row['versionId']:
            changed.add(artifact_id)
            changes.append({'path': row['path'], 'kind': 'record_modified', 'baseVersionId': previous['versionId'], 'targetVersionId': row['versionId'], 'artifactKind': row['kind']})
    record_versions = load_scoped_map(db, ArtifactVersion, [row['versionId'] for row in records.values()], repository.id)
    for row in records.values():
        version = record_versions[row['versionId']]
        if version.artifact_id != row['artifactId'] or digest(version.content) != version.digest:
            fail('missing_evidence')
    versions.update(record_versions)
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
        impacted_items = [
            item for item in claims.values()
            if item['projection']['resolution'] != 'superseded'
            and item['projection']['validity'] not in {'rejected', 'retired'}
            and ({item['assertion']['source']['artifactId'], item['assertion']['target']['artifactId']} & changed)
        ]
        contexts_by_id = load_scoped_map(db, ReviewContext, [item['projection']['contextId'] for item in impacted_items], repository.id)
        prior_ev_map = load_scoped_map(db, Evidence, [orig['id'] for item in impacted_items for orig in item['evidence']], repository.id)
        extra_vids = [ev.artifact_version_id for ev in prior_ev_map.values() if ev.artifact_version_id not in versions]
        if extra_vids:
            versions.update(load_scoped_map(db, ArtifactVersion, extra_vids, repository.id))
        incoming_vids = [incoming['versionId'] for ev in prior_ev_map.values()
                         if (incoming := incoming_versions.get(versions[ev.artifact_version_id].artifact_id)) and incoming['versionId'] not in versions]
        if incoming_vids:
            versions.update(load_scoped_map(db, ArtifactVersion, incoming_vids, repository.id))
        lines_by_version = {}
        derived_eids = [stable(identity, 'evidence', orig['id']) for item in impacted_items for orig in item['evidence']]
        existing_eids = set(db.scalars(select(Evidence.id).where(Evidence.id.in_(derived_eids)))) if derived_eids else set()
        staged_evidence, origins = {}, []
        for item in impacted_items:
            a, p = item['assertion'], item['projection']
            current = contexts_by_id[p['contextId']]
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
                prior_evidence = prior_ev_map[original['id']]
                old_version = versions[prior_evidence.artifact_version_id]
                incoming = incoming_versions.get(old_version.artifact_id)
                version = versions[incoming['versionId']] if incoming else old_version
                locator, excerpt = prior_evidence.locator, None
                if incoming and locator.get('kind') == 'field':
                    excerpt = version.identity.get('path')
                elif incoming and locator.get('kind') == 'lines':
                    lines = lines_by_version.setdefault(version.id, version.content.splitlines())
                    if 1 <= locator['startLine'] <= locator['endLine'] <= len(lines):
                        excerpt = '\n'.join(lines[locator['startLine'] - 1:locator['endLine']])
                available = incoming and prior_evidence.availability == 'available' and excerpt is not None and digest(excerpt) == prior_evidence.excerpt_digest
                eid = stable(identity, 'evidence', original['id'])
                if eid not in existing_eids and eid not in staged_evidence:
                    staged_evidence[eid] = Evidence(id=eid, repository_id=repository.id, artifact_version_id=version.id, locator=locator,
                        availability='available' if available else 'unresolved', reason=None if available else 'Incoming anchor continuity is unresolved; earlier source is retained.',
                        method_id='direct-path-comparison-v1', excerpt_digest=digest(excerpt) if available else None)
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
        if staged_evidence:
            db.add_all(staged_evidence.values())
            db.flush()
        # The activity must exist before origin foreign keys flush.
        db.add(Activity(id=identity, repository_id=repository.id, document=document)); db.flush()
        db.add_all(origins); db.flush()
    historical = RepositoryView(repository_id=repository.id, selection_id=before.id, mode='historical')
    db.add(historical); db.flush()
    response = {'schemaVersion': '0.1.0', 'requestId': envelope.requestId, 'result': {'selection': selection_data(selected),
                'comparisonId': identity, 'baseRepositoryViewId': historical.id, 'baseSnapshotId': base.id}}
    db.add(Receipt(actor_id=actor.id, repository_id=repository.id, command=envelope.command, request_id=envelope.requestId, input_digest=fingerprint, result=response))
    return response


def prior_decision_map(db, comparison):
    """Resolve retained baseline judgment summaries for a comparison activity without crossing snapshot boundaries."""
    if not comparison or not comparison.get('impacts') or not comparison.get('baseSnapshotId'):
        return {}
    lineage, seen, cursor_id = [], set(), comparison['baseSnapshotId']
    while cursor_id and cursor_id not in seen:
        seen.add(cursor_id)
        cursor = db.get(Snapshot, cursor_id)
        if cursor is None:
            break
        lineage.append(cursor)
        cursor_id = (cursor.document.get('comparison') or {}).get('baseSnapshotId')
    base_projections = {}
    for ancestor in reversed(lineage):
        for item in ancestor.document.get('assertions', []):
            base_projections[item['projection']['contextId']] = (item['projection'], ancestor.id)
    event_ids = {base_projections[imp['baseContextId']][0].get('effectiveJudgmentEventId')
                 for imp in comparison['impacts'] if imp.get('baseContextId') in base_projections}
    event_ids.discard(None)
    events = {row.id: row for row in db.scalars(select(ReviewEvent).where(ReviewEvent.id.in_(event_ids)))} if event_ids else {}
    actor_ids = {row.actor_id for row in events.values()}
    actors = {row.id: row for row in db.scalars(select(Account).where(Account.id.in_(actor_ids)))} if actor_ids else {}
    summaries = {}
    for impact in comparison['impacts']:
        proj, snap_id = base_projections.get(impact.get('baseContextId'), (None, None))
        if not proj:
            continue
        event = events.get(proj.get('effectiveJudgmentEventId'))
        actor = actors.get(event.actor_id) if event else None
        summaries[impact['contextId']] = {
            'baseContextId': impact['baseContextId'],
            'baseSnapshotId': snap_id,
            'validity': proj['validity'],
            'resolution': proj['resolution'],
            'decision': event.payload.get('decision') if event else None,
            'actorId': event.actor_id if event else None,
            'actorDisplayName': actor.display_name if actor else None,
            'recordedAt': event.recorded_at if event else None,
            **reason_data(event.reason if event else None),
        }
    return summaries


def enrich_comparison(db, comparison):
    """Return a copy of the comparison document with priorDecision attached to each impact."""
    if not comparison:
        return comparison
    by_context = prior_decision_map(db, comparison)
    if not by_context:
        return comparison
    return {**comparison, 'impacts': [{**impact, 'priorDecision': by_context.get(impact['contextId'])} for impact in comparison.get('impacts', [])]}
