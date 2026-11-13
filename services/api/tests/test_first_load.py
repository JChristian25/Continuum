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
    assert result['progress']['steps'][1]['state'] == 'partial'
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
