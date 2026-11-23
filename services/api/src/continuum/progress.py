"""Read-only lifecycle facts; historical snapshots never inherit current processing."""
from sqlalchemy import func, select
from .acquisition import WORKSPACE
from .local_repo import is_custom_manifest
from .pipeline_models import InputRegistration, Operation, Selection, Snapshot
from .cycle import completion


def captured(document):
    coverage = next((c for c in document['snapshot']['coverage'] if c['function'] == 'ingestion'), {})
    return coverage.get('status') == 'complete' and coverage.get('processedCount') == coverage.get('eligibleCount')


def workspace_progress(db, snapshot, selection):
    document, header = snapshot.document, snapshot.document['snapshot']
    active = snapshot.snapshot_version == selection.snapshot_version
    operations = ([{'id': o.id, 'kind': o.kind, 'status': o.status, 'limitations': o.limitations}
                   for o in db.scalars(select(Operation).where(Operation.selection_id == selection.id,
                       Operation.kind.in_(['capture', 'discovery'])).order_by(Operation.published_version, Operation.id))]
                  if active else document.get('processing', []))
    processing = [o for o in operations if o['status'] in {'queued', 'running'}]
    failures = [o for o in operations if o['status'] in {'failed', 'cancelled'}]
    pending = header['pendingReviewCount']
    counts = {state: sum(a['projection']['validity'] == state for a in document['assertions'])
              for state in ['candidate', 'stale', 'confirmed', 'rejected', 'retired']}
    deferred = sum(a['projection']['resolution'] == 'deferred' for a in document['assertions'])
    screened = sum(a['projection']['resolution'] == 'screened' for a in document['assertions'])
    triaged = deferred + screened
    open_candidates = sum(a['projection']['validity'] == 'candidate' and a['projection']['resolution'] == 'open' for a in document['assertions'])
    unresolved_candidates = sum(a['projection']['validity'] == 'candidate' and a['projection']['resolution'] in {'open', 'deferred', 'screened'} for a in document['assertions'])
    reviewed = sum(bool(a['projection']['effectiveJudgmentEventId']) for a in document['assertions'])
    completed = completion(db, snapshot)
    comparison = document.get('comparison')
    baseline = db.get(Snapshot, comparison['baseSnapshotId']) if comparison else snapshot
    baseline_header = baseline.document['snapshot']
    baseline_pending = baseline_header['pendingReviewCount']
    baseline_reviewed = sum(bool(a['projection']['effectiveJudgmentEventId']) for a in baseline.document['assertions'])
    baseline_deferred = sum(a['projection']['resolution'] == 'deferred' for a in baseline.document['assertions'])
    baseline_screened = sum(a['projection']['resolution'] == 'screened' for a in baseline.document['assertions'])
    baseline_unresolved = sum(a['projection']['validity'] == 'candidate' and a['projection']['resolution'] in {'open', 'deferred', 'screened'} for a in baseline.document['assertions'])
    baseline_completed = completion(db, baseline)
    discovery_operations = baseline.document.get('processing', []) if comparison else operations
    discovery_result = next((o for o in reversed(discovery_operations)
                             if o['kind'] == 'discovery' and o['status'] in {'complete', 'partial'}), None)
    # Return exact captured choices, reading only the latest snapshot per distinct selection.
    choices = []
    if active:
        inventory = db.get(InputRegistration, selection.inventory_id)
        custom_repo = bool(inventory and is_custom_manifest(WORKSPACE / inventory.acceptance_path, WORKSPACE))
        filters = [Selection.repository_id == selection.repository_id]
        if not custom_repo:
            filters.extend([
                Selection.inventory_id == selection.inventory_id,
                Selection.configuration_id == selection.configuration_id,
            ])
        latest_versions = (
            select(Snapshot.selection_id, func.max(Snapshot.snapshot_version).label("max_version"))
            .join(Selection, Selection.id == Snapshot.selection_id)
            .where(*filters)
            .group_by(Snapshot.selection_id)
            .subquery()
        )
        rows = db.scalars(
            select(Snapshot)
            .join(
                latest_versions,
                (Snapshot.selection_id == latest_versions.c.selection_id)
                & (Snapshot.snapshot_version == latest_versions.c.max_version),
            )
            .order_by(Snapshot.snapshot_version.desc(), Snapshot.id.desc())
        )
        seen_selections = set()
        for row in rows:
            if row.selection_id in seen_selections:
                continue
            seen_selections.add(row.selection_id)
            if captured(row.document):
                choices.append({'snapshotId': row.id, 'selection': row.document['snapshot']['selection']})
    def step(identity, label, state, action, blockers=()):
        return {'id': identity, 'label': label, 'state': state, 'action': action, 'blockers': list(blockers)}
    capture_running = any(o['kind'] == 'capture' for o in processing)
    discovery_running = any(o['kind'] == 'discovery' for o in processing)
    capture_ok = captured(document)
    if discovery_running:
        discovery_state, discovery_notes = 'running', []
    elif discovery_result:
        discovery_state = discovery_result['status']
        discovery_notes = discovery_result['limitations'] if discovery_state == 'partial' else []
    elif not capture_ok:
        discovery_state, discovery_notes = 'blocked', ['Capture the selected revision first.']
    elif not active and 'processing' not in document:
        discovery_state, discovery_notes = 'unknown', ['Discovery status was not recorded for this snapshot.']
    elif failures:
        discovery_state, discovery_notes = 'blocked', ['Inspect the failed operation before retrying.']
    else:
        discovery_state, discovery_notes = 'ready', ['Find suggested relationships for review.']
    steps = [
        step('capture', 'Capture repository snapshot', 'running' if capture_running else 'complete' if capture_ok else 'blocked' if failures else 'not_started', 'sources',
             [] if capture_ok else ['Capture the selected revision’s accepted inventory.']),
        step('discovery', 'Discover relationships', discovery_state, 'discovery', discovery_notes),
        step('review', 'Review the baseline', 'blocked' if processing and not comparison else 'complete' if baseline_completed else 'in_progress' if baseline_pending else 'ready', 'review',
             [f'{baseline_pending} candidate reviews open. Review key links or compare revisions anytime.'] if baseline_pending else ['Wait for processing to settle.'] if processing and not comparison else [] if baseline_completed else ['Acknowledge the exact limitations to record completion.']),
        step('compare', 'Compare a revision', 'complete' if comparison else 'ready' if capture_ok and choices else 'blocked', 'compare',
             [] if comparison else ['Select captured baseline and target snapshots; pending baseline reviews do not block comparison.']),
        step('revalidate', 'Revalidate changes', 'complete' if comparison and completed else 'ready' if comparison else 'not_started', 'incoming',
             [] if comparison else ['Compare captured revisions to create the incoming queue.']),
    ]
    current = next((s['id'] for s in steps if s['state'] != 'complete' and not (s['id'] == 'discovery' and s['state'] == 'partial')), None)
    return {'snapshotId': snapshot.id, 'snapshotVersion': snapshot.snapshot_version, 'historical': not active,
            'steps': steps, 'currentStep': current,
            'counts': {**counts, 'reviewed': reviewed, 'pending': pending, 'deferred': deferred, 'screened': screened,
                       'triaged': triaged, 'openCandidate': open_candidates, 'unresolvedCandidate': unresolved_candidates},
            'operations': operations, 'capturedChoices': choices, 'coverage': header['coverage'],
            'baseline': {'snapshotId': baseline.id, 'selection': baseline_header['selection'], 'reviewed': baseline_reviewed,
                         'pending': baseline_pending, 'completion': baseline_completed,
                         'deferred': baseline_deferred, 'screened': baseline_screened,
                         'triaged': baseline_deferred + baseline_screened, 'unresolvedCandidate': baseline_unresolved,
                         'rejected': sum(a['projection']['validity'] == 'rejected' for a in baseline.document['assertions'])},
            'completion': completed, 'comparisonPublished': bool(comparison)}
