"""Read-only lifecycle facts; historical snapshots never inherit current processing."""
from sqlalchemy import select
from .pipeline_models import Operation, Selection, Snapshot
from .cycle import completion


def captured(document):
    coverage = next((c for c in document['snapshot']['coverage'] if c['function'] == 'ingestion'), {})
    return coverage.get('status') == 'complete' and coverage.get('processedCount') == coverage.get('eligibleCount')


def workspace_progress(db, snapshot, selection):
    document, header = snapshot.document, snapshot.document['snapshot']
    active = snapshot.snapshot_version == selection.snapshot_version
    operations = ([{'id': o.id, 'kind': o.kind, 'status': o.status, 'limitations': o.limitations}
                   for o in db.scalars(select(Operation).where(Operation.selection_id == selection.id,
                       Operation.kind.in_(['capture', 'discovery'])))] if active else document.get('processing', []))
    processing = [o for o in operations if o['status'] in {'queued', 'running'}]
    failures = [o for o in operations if o['status'] in {'failed', 'cancelled'}]
    pending = header['pendingReviewCount']
    counts = {state: sum(a['projection']['validity'] == state for a in document['assertions'])
              for state in ['candidate', 'stale', 'confirmed', 'rejected', 'retired']}
    reviewed = sum(bool(a['projection']['effectiveJudgmentEventId']) for a in document['assertions'])
    completed = completion(db, snapshot)
    comparison = document.get('comparison')
    baseline = db.get(Snapshot, comparison['baseSnapshotId']) if comparison else snapshot
    baseline_header = baseline.document['snapshot']
    baseline_pending = baseline_header['pendingReviewCount']
    baseline_reviewed = sum(bool(a['projection']['effectiveJudgmentEventId']) for a in baseline.document['assertions'])
    baseline_completed = completion(db, baseline)
    discovery_operations = baseline.document.get('processing', []) if comparison else operations
    discovered = any(o['kind'] == 'discovery' and o['status'] in {'complete', 'partial'} for o in discovery_operations)
    # Return exact captured choices, not a claim that the user has selected a baseline.
    choices = []
    if active:
        for row in db.scalars(select(Snapshot).join(Selection, Selection.id == Snapshot.selection_id).where(
                Selection.repository_id == selection.repository_id, Selection.inventory_id == selection.inventory_id,
                Selection.configuration_id == selection.configuration_id).order_by(Snapshot.snapshot_version.desc())):
            if captured(row.document):
                choices.append({'snapshotId': row.id, 'selection': row.document['snapshot']['selection']})
    def step(identity, label, state, action, blockers=()):
        return {'id': identity, 'label': label, 'state': state, 'action': action, 'blockers': list(blockers)}
    capture_running = any(o['kind'] == 'capture' for o in processing)
    discovery_running = any(o['kind'] == 'discovery' for o in processing)
    capture_ok = captured(document)
    steps = [
        step('capture', 'Capture repository snapshot', 'running' if capture_running else 'complete' if capture_ok else 'blocked' if failures else 'not_started', 'sources',
             [] if capture_ok else ['Capture the selected revision’s accepted inventory.']),
        step('discovery', 'Discover relationships', 'running' if discovery_running else 'partial' if discovered else 'unknown' if not active and 'processing' not in document else 'blocked' if not capture_ok or failures else 'ready', 'discovery',
             ['Baseline discovery is retained; incoming review comes from comparison. Frozen lexical scope only.'] if discovered and comparison else ['Discovery covers the frozen lexical profile only.'] if discovered else ['Capture inputs first.'] if not capture_ok else ['Run discovery or inspect processing failures.']),
        step('review', 'Review the baseline', 'blocked' if processing and not comparison else 'complete' if baseline_completed else 'blocked' if baseline_pending else 'ready', 'review',
             [f'{baseline_pending} pending baseline reviews.'] if baseline_pending else ['Wait for processing to settle.'] if processing and not comparison else [] if baseline_completed else ['Acknowledge the exact limitations to record completion.']),
        step('compare', 'Compare a revision', 'complete' if comparison else 'ready' if capture_ok and choices else 'blocked', 'compare',
             [] if comparison else ['Select captured baseline and target snapshots; pending baseline reviews do not block comparison.']),
        step('revalidate', 'Revalidate changes', 'complete' if comparison and completed else 'ready' if comparison else 'not_started', 'incoming',
             [] if comparison else ['Compare captured revisions to create the incoming queue.']),
    ]
    current = next((s['id'] for s in steps if s['state'] != 'complete' and not (s['id'] == 'discovery' and discovered)), None)
    return {'snapshotId': snapshot.id, 'snapshotVersion': snapshot.snapshot_version, 'historical': not active,
            'steps': steps, 'currentStep': current, 'counts': {**counts, 'reviewed': reviewed, 'pending': pending},
            'operations': operations, 'capturedChoices': choices, 'coverage': header['coverage'],
            'baseline': {'snapshotId': baseline.id, 'selection': baseline_header['selection'], 'reviewed': baseline_reviewed,
                         'pending': baseline_pending, 'completion': baseline_completed,
                         'rejected': sum(a['projection']['validity'] == 'rejected' for a in baseline.document['assertions'])},
            'completion': completed, 'comparisonPublished': bool(comparison)}
