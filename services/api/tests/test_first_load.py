import uuid
import pytest
from sqlalchemy import select
from conftest import envelope, sign_in
from continuum.models import ReviewEvent, ReviewContext
from continuum.pipeline_models import Operation
from continuum.worker import run_operation
from test_pipeline import pipeline, captured, submit, ask
from test_continuity import latest
from test_capture import send
from test_comparison import prepare, compare


@pytest.mark.parametrize('reason', [None, '', '   ', '  Kept literally.  '])
def test_legacy_reason_read_shape(reason):
    from continuum.review import reason_data
    supplied = bool(reason and reason.strip())
    assert reason_data(reason) == {'reason': reason if supplied else None,
                                   'reasonStatus': 'provided' if supplied else 'not_provided'}


@pytest.mark.parametrize('reason', [None, '', '  ', '  Authored explanation.  ', 'omitted'])
@pytest.mark.parametrize('decision', ['confirm', 'reject'])
def test_optional_initial_reason_retains_receipt_and_history(setup, reason, decision):
    headers = sign_in(setup)
    body = envelope(reason=reason, decision=decision)
    if reason == 'omitted':
        del body['input']['reason']
    response = setup['client'].post('/api/v1/commands', headers=headers, json=body)
    assert response.status_code == 200, response.text
    assert setup['client'].post('/api/v1/commands', headers=headers, json=body).json() == response.json()
    events = setup['client'].get('/api/v1/repositories/repo/contexts/context1/history', params={'viewId': 'view1'}).json()['items']
    event = events[0]
    supplied = reason == '  Authored explanation.  '
    assert event['reason'] == (reason if supplied else None)
    assert event['reasonStatus'] == ('provided' if supplied else 'not_provided')
    assert event['actorId'] == 'reviewer' and event['recordedAt']
    assert event['references']['evidenceIds'] == ['evidence']
    with setup['db']() as db:
        assert len(list(db.scalars(select(ReviewEvent)))) == 1


def test_optional_reason_does_not_remove_evidence_or_incoming_guards(setup):
    headers = sign_in(setup)
    def post(body):
        return setup['client'].post('/api/v1/commands', headers=headers, json=body)
    assert post(envelope(reason=None, reviewedEvidenceIds=[])).status_code == 422
    with setup['db'].begin() as db:
        context = db.get(ReviewContext, 'context1')
        context.kind = 'incoming'
        context.comparison_id = 'synthetic-comparison'
    assert post(envelope(reason=None, decision='reject')).status_code == 422


def test_progress_capture_discovery_failure_and_historical_isolation(pipeline):
    first = latest(pipeline)
    assert first['progress']['steps'][0]['state'] == 'not_started'
    _, admitted = submit(pipeline)
    assert latest(pipeline)['progress']['steps'][0]['state'] == 'running'
    assert run_operation(pipeline['db'], admitted['result']['operationId'])
    captured_snapshot = latest(pipeline)
    assert captured_snapshot['progress']['steps'][0]['state'] == 'complete'
    _, discovered = submit(pipeline, 'discover_candidates')
    assert latest(pipeline)['progress']['steps'][1]['state'] == 'running'
    assert run_operation(pipeline['db'], discovered['result']['operationId'])
    result = latest(pipeline)
    assert result['progress']['steps'][1]['state'] == 'complete'
    assert result['progress']['counts']['pending'] == result['snapshot']['pendingReviewCount']
    old = ask(pipeline, pipeline['headers'], 'read_workspace', {'snapshotId': first['snapshot']['id']})
    assert old['progress']['historical']
    assert old['progress']['steps'][0]['state'] == 'not_started'
    assert old['progress']['steps'][1]['state'] != 'partial'


def test_progress_discloses_processing_failure_and_completion_invalidation(captured):
    workspace = latest(captured)
    completed = send(captured, 'complete_cycle', {'snapshotId': workspace['snapshot']['id'], 'acknowledgedLimitations': workspace['snapshot']['limitations']})
    assert completed.status_code == 200
    assert latest(captured)['progress']['steps'][2]['state'] == 'complete'
    _, admitted = submit(captured, 'discover_candidates')
    with captured['db'].begin() as db:
        operation = db.get(Operation, admitted['result']['operationId'])
        operation.status = 'failed'
        operation.limitations = ['Synthetic processing failure, not a source finding.']
    progress = latest(captured)['progress']
    assert progress['steps'][1]['state'] == 'blocked'
    assert any(o['status'] == 'failed' and o['limitations'] for o in progress['operations'])
    # A new published snapshot does not inherit the old completion.
    from test_capture import record
    assert send(captured, 'capture_record', record()).status_code == 200
    assert latest(captured)['progress']['completion'] is None


def test_reason_free_search_export_and_comparison_with_pending_reviews(captured):
    base, target, target_snapshot = prepare(captured)
    workspace = latest(captured)
    assert workspace['progress']['steps'][3]['state'] == 'ready'
    row = workspace['assertions'][0]
    view = ask(captured, captured['headers'], 'open_review_view', {'repositoryViewId': captured['selected']['repositoryViewId'], 'snapshotId': workspace['snapshot']['id'], 'contextId': row['projection']['contextId']})
    body = {'schemaVersion': '0.1.0', 'requestId': uuid.uuid4().hex, 'repositoryId': 'repo', 'viewId': view['viewId'], 'command': 'record_judgment', 'input': {
        'contextId': row['projection']['contextId'], 'assertionRevisionId': row['assertion']['id'], 'expectedProjectionVersion': row['projection']['projectionVersion'],
        'decision': 'reject', 'reviewedEvidenceIds': [], 'contentConcern': None, 'followUpDisposition': {'kind': 'none'}}}
    response = captured['client'].post('/api/v1/commands', headers=captured['headers'], json=body)
    assert response.status_code == 200, response.text
    workspace = latest(captured)
    assert workspace['progress']['counts']['rejected'] == 1
    assert workspace['progress']['counts']['reviewed'] == 1
    assert ask(captured, captured['headers'], 'search_records', {'snapshotId': workspace['snapshot']['id'], 'text': 'reason', 'kinds': ['code', 'document'], 'matchMode': 'literal'}) is not None
    exported = send(captured, 'export_snapshot', {'snapshotId': workspace['snapshot']['id'], 'format': 'json'}).json()['result']
    assert run_operation(captured['db'], exported['operationId'])
    document = ask(captured, captured['headers'], 'read_export', {'operationId': exported['operationId']})['document']
    event = next(j['effectiveEvent'] for j in document['judgments'] if j['effectiveEvent'])
    assert event['reason'] is None and event['reasonStatus'] == 'not_provided'
    incoming, _, _ = compare(captured, workspace['snapshot'], target, target_snapshot)
    assert incoming['progress']['comparisonPublished']
    assert incoming['progress']['counts']['pending'] == incoming['snapshot']['pendingReviewCount']
    assert incoming['progress']['baseline']['pending'] == workspace['snapshot']['pendingReviewCount']
    assert incoming['progress']['baseline']['rejected'] == 1


def _post_context_command(captured, row, snapshot_id, command, payload, repo_view_id=None):
    view = ask(captured, captured['headers'], 'open_review_view', {
        'repositoryViewId': repo_view_id or captured['selected']['repositoryViewId'],
        'snapshotId': snapshot_id,
        'contextId': row['projection']['contextId'],
    })
    body = {
        'schemaVersion': '0.1.0',
        'requestId': uuid.uuid4().hex,
        'repositoryId': 'repo',
        'viewId': view['viewId'],
        'command': command,
        'input': {
            'contextId': row['projection']['contextId'],
            'assertionRevisionId': row['assertion']['id'],
            'expectedProjectionVersion': row['projection']['projectionVersion'],
            **payload,
        },
    }
    return captured['client'].post('/api/v1/commands', headers=captured['headers'], json=body)


def test_triage_workflow_preserves_candidate_validity_and_supports_scoped_completion(captured):
    base, target, target_snapshot = prepare(captured)
    old = latest(captured)
    new = ask(captured, captured['headers'], 'read_workspace', {'snapshotId': target_snapshot['id']})
    versions = {a['artifactId']: a for a in new['artifacts']}
    changed = {a['artifactId'] for a in old['artifacts'] if a['contentDigest'] != versions[a['artifactId']]['contentDigest']}
    affected_ids = {a['projection']['contextId'] for a in old['assertions'] if {a['assertion']['source']['artifactId'], a['assertion']['target']['artifactId']} & changed}
    affected_list = [a for a in old['assertions'] if a['projection']['contextId'] in affected_ids]
    impacted = affected_list[0]
    others = [a for a in old['assertions'] if a['projection']['contextId'] != impacted['projection']['contextId']]
    row0 = next((a for a in others if a['projection']['contextId'] not in affected_ids), others[0])
    row1 = next((a for a in others if a['projection']['contextId'] != row0['projection']['contextId'] and a['projection']['contextId'] in affected_ids), others[1])
    row2 = next(a for a in others if a['projection']['contextId'] not in {row0['projection']['contextId'], row1['projection']['contextId']})

    # Defer row0 without note: validity stays candidate, effectiveJudgmentEventId stays None, triage event appended.
    r_defer = _post_context_command(captured, row0, old['snapshot']['id'], 'triage_candidate', {'disposition': 'defer', 'note': '   '})
    assert r_defer.status_code == 200, r_defer.text
    ws = latest(captured)
    p0 = next(a['projection'] for a in ws['assertions'] if a['projection']['contextId'] == row0['projection']['contextId'])
    assert p0['validity'] == 'candidate' and p0['resolution'] == 'deferred' and p0['effectiveJudgmentEventId'] is None
    assert ws['snapshot']['deferredCount'] == 1
    assert ws['progress']['counts']['deferred'] == 1 and ws['progress']['counts']['triaged'] == 1
    hist_view = ask(captured, captured['headers'], 'open_review_view', {
        'repositoryViewId': captured['selected']['repositoryViewId'],
        'snapshotId': ws['snapshot']['id'],
        'contextId': row0['projection']['contextId'],
    })
    hist_res = captured['client'].get(
        f"/api/v1/repositories/repo/contexts/{row0['projection']['contextId']}/history",
        headers=captured['headers'],
        params={'viewId': hist_view['viewId']},
    )
    assert hist_res.status_code == 200, hist_res.text
    hist = hist_res.json()
    assert hist['items'][0]['type'] == 'triage'
    assert hist['items'][0]['payload']['disposition'] == 'defer'
    assert hist['items'][0]['reasonStatus'] == 'not_provided' and hist['items'][0]['reason'] is None

    # Screen row1 with explicit note -> Restore row0 back to open -> Re-defer row0 and formally confirm directly from deferred.
    r_screen = _post_context_command(captured, row1, ws['snapshot']['id'], 'triage_candidate', {'disposition': 'screen', 'note': 'Outside immediate focus.'})
    assert r_screen.status_code == 200, r_screen.text
    ws = latest(captured)
    row0_v = next(a for a in ws['assertions'] if a['projection']['contextId'] == row0['projection']['contextId'])
    assert _post_context_command(captured, row0_v, ws['snapshot']['id'], 'triage_candidate', {'disposition': 'restore', 'note': None}).status_code == 200
    ws = latest(captured)
    row0_v = next(a for a in ws['assertions'] if a['projection']['contextId'] == row0['projection']['contextId'])
    assert row0_v['projection']['resolution'] == 'open'
    assert _post_context_command(captured, row0_v, ws['snapshot']['id'], 'triage_candidate', {'disposition': 'defer', 'note': None}).status_code == 200
    ws = latest(captured)
    row0_v = next(a for a in ws['assertions'] if a['projection']['contextId'] == row0['projection']['contextId'])
    assert _post_context_command(captured, row0_v, ws['snapshot']['id'], 'record_judgment', {
        'decision': 'confirm', 'reason': None, 'reviewedEvidenceIds': row0_v['assertion']['evidenceIds'],
        'contentConcern': None, 'followUpDisposition': {'kind': 'none'},
    }).status_code == 200

    # Defer row2 and formally confirm one impacted relationship so incoming comparison produces stale + preserved triage.
    ws = latest(captured)
    row2_v = next(a for a in ws['assertions'] if a['projection']['contextId'] == row2['projection']['contextId'])
    assert _post_context_command(captured, row2_v, ws['snapshot']['id'], 'triage_candidate', {'disposition': 'defer', 'note': 'Revisit next pass.'}).status_code == 200
    ws = latest(captured)
    impacted_v = next(a for a in ws['assertions'] if a['projection']['contextId'] == impacted['projection']['contextId'])
    assert _post_context_command(captured, impacted_v, ws['snapshot']['id'], 'record_judgment', {
        'decision': 'confirm', 'reason': 'Verified impacted link before target comparison.', 'reviewedEvidenceIds': impacted_v['assertion']['evidenceIds'],
        'contentConcern': None, 'followUpDisposition': {'kind': 'none'},
    }).status_code == 200

    # Full completion fails with pending_review; scoped completion succeeds while staleReviewCount == 0 and export discloses triage honestly.
    ws = latest(captured)
    assert ws['snapshot']['staleReviewCount'] == 0
    full_attempt = send(captured, 'complete_cycle', {'snapshotId': ws['snapshot']['id'], 'acknowledgedLimitations': ws['snapshot']['limitations'], 'scope': 'full'})
    assert full_attempt.status_code == 409 and full_attempt.json()['error']['code'] == 'pending_review'
    scoped_attempt = send(captured, 'complete_cycle', {'snapshotId': ws['snapshot']['id'], 'acknowledgedLimitations': ws['snapshot']['limitations'], 'scope': 'scoped'})
    assert scoped_attempt.status_code == 200, scoped_attempt.text
    scoped_result = scoped_attempt.json()['result']
    assert scoped_result['completionScope'] == 'scoped_review'
    assert scoped_result['deferredCount'] == 1 and scoped_result['screenedCount'] == 1 and scoped_result['confirmedCount'] == 2

    exported = send(captured, 'export_snapshot', {'snapshotId': ws['snapshot']['id'], 'format': 'json'}).json()['result']
    assert run_operation(captured['db'], exported['operationId'])
    document = ask(captured, captured['headers'], 'read_export', {'operationId': exported['operationId']})['document']
    screened_export = next(j for j in document['judgments'] if j['projection']['contextId'] == row1['projection']['contextId'])
    assert screened_export['triageStatus'] == 'screened' and screened_export['effectiveEvent'] is None
    assert screened_export['latestTriageEvent']['payload']['disposition'] == 'screen'
    assert any('unresolved candidate' in lim for lim in document['limitations'])

    # Incoming revision comparison turns impacted link stale, preserves unconfirmed triage, and blocks scoped completion until stale items are resolved.
    incoming, _, _ = compare(captured, ws['snapshot'], target, target_snapshot)
    assert incoming['snapshot']['staleReviewCount'] >= 1
    if row1['projection']['contextId'] in affected_ids:
        assert incoming['snapshot']['screenedCount'] >= 1
    inc_selected = ask(captured, captured['headers'], 'select_context', incoming['snapshot']['selection'])
    inc_scoped = captured['client'].post('/api/v1/commands', headers=captured['headers'], json={
        'schemaVersion': '0.1.0', 'requestId': uuid.uuid4().hex, 'repositoryId': 'repo',
        'viewId': inc_selected['repositoryViewId'], 'command': 'complete_cycle',
        'input': {'snapshotId': incoming['snapshot']['id'], 'acknowledgedLimitations': incoming['snapshot']['limitations'], 'scope': 'scoped'},
    })
    assert inc_scoped.status_code == 409 and inc_scoped.json()['error']['code'] == 'pending_review'
