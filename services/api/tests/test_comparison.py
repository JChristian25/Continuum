import uuid
import pytest

from continuum.worker import run_operation
from test_pipeline import ask, captured, pipeline, submit


def prepare(captured):
    _, job = submit(captured, 'discover_candidates')
    assert run_operation(captured['db'], job['result']['operationId'])
    base = ask(captured, captured['headers'], 'read_snapshot', {'selection': captured['selection']})
    choice = {**captured['selection'], 'targetRevision': {'objectAlgorithm': 'sha1', 'commitId': 'c62d6648d81e1aebc65f80bddc72f165fba7320b'}}
    selected = ask(captured, captured['headers'], 'select_context', choice)
    target = {**captured, 'selection': choice, 'selected': selected}
    _, job = submit(target)
    assert run_operation(captured['db'], job['result']['operationId'])
    snapshot = ask(target, target['headers'], 'read_snapshot', {'selection': choice})
    return base, target, snapshot


def compare(captured, base, target, snapshot):
    body = {'schemaVersion': '0.1.0', 'requestId': uuid.uuid4().hex, 'repositoryId': 'repo',
            'viewId': target['selected']['repositoryViewId'], 'command': 'compare_revisions',
            'input': {'baseSnapshotId': base['id'], 'targetSnapshotId': snapshot['id']}}
    response = captured['client'].post('/api/v1/commands', headers=captured['headers'], json=body)
    assert response.status_code == 200, response.text
    assert captured['client'].post('/api/v1/commands', headers=captured['headers'], json=body).json() == response.json()
    selected = ask(captured, captured['headers'], 'select_context', response.json()['result']['selection'])
    workspace = ask(captured, captured['headers'], 'read_workspace', {'snapshotId': selected['snapshot']['id']})
    return workspace, body, response.json()


@pytest.mark.parametrize('confirmed', [False, True])
def test_comparison_keeps_exact_context_history_and_never_inherits_confirmation(captured, confirmed):
    base, target, snapshot = prepare(captured)
    old = ask(captured, captured['headers'], 'read_workspace', {'snapshotId': base['id']})
    new = ask(captured, captured['headers'], 'read_workspace', {'snapshotId': snapshot['id']})
    versions = {a['artifactId']: a for a in new['artifacts']}
    changed = {a['artifactId'] for a in old['artifacts'] if a['contentDigest'] != versions[a['artifactId']]['contentDigest']}
    affected = [a for a in old['assertions'] if {a['assertion']['source']['artifactId'], a['assertion']['target']['artifactId']} & changed]
    assert affected
    if confirmed:
        row = affected[0]
        view = ask(captured, captured['headers'], 'open_review_view', {'repositoryViewId': captured['selected']['repositoryViewId'], 'snapshotId': base['id'], 'contextId': row['projection']['contextId']})
        result = captured['client'].post('/api/v1/commands', headers=captured['headers'], json={
            'schemaVersion': '0.1.0', 'requestId': uuid.uuid4().hex, 'repositoryId': 'repo', 'viewId': view['viewId'], 'command': 'record_judgment',
            'input': {'contextId': row['projection']['contextId'], 'assertionRevisionId': row['assertion']['id'], 'expectedProjectionVersion': 0,
                      'decision': 'confirm', 'reason': 'Synthetic comparison verification, not a research judgment.', 'reviewedEvidenceIds': row['assertion']['evidenceIds'], 'contentConcern': None, 'followUpDisposition': {'kind': 'none'}}})
        assert result.status_code == 200, result.text
        base = ask(captured, captured['headers'], 'read_snapshot', {'selection': captured['selection']})
    workspace, body, receipt = compare(captured, base, target, snapshot)
    assert len(workspace['assertions']) == len(affected)
    assert all(a['projection']['validity'] in {'candidate', 'stale'} for a in workspace['assertions'])
    assert sum(a['projection']['validity'] == 'stale' for a in workspace['assertions']) == int(confirmed)
    assert workspace['comparison']['changes']
    assert all(a['assertion']['supersedesRevisionId'] for a in workspace['assertions'])
    # Same retained inputs under a new request ID keep the same comparison and contexts.
    repeated, _, _ = compare(captured, base, target, snapshot)
    assert repeated['assertions'] == workspace['assertions']
    assert ask(captured, captured['headers'], 'read_workspace', {'snapshotId': old['snapshot']['id']})['assertions'] == old['assertions']
    historical = ask(captured, captured['headers'], 'open_review_view', {'repositoryViewId': receipt['result']['baseRepositoryViewId'], 'snapshotId': base['id'], 'contextId': affected[0]['projection']['contextId']})
    assert historical['mode'] == 'historical'


def test_equal_revisions_are_empty_without_claiming_complete_coverage(captured):
    base, _, _ = prepare(captured)
    workspace, _, _ = compare(captured, base, captured, base)
    assert workspace['comparison']['changes'] == []
    assert workspace['assertions'] == []
    assert workspace['comparison']['limitations']


def test_uncaptured_target_fails_instead_of_fabricating_empty_changes(pipeline):
    empty = pipeline['selected']['snapshot']
    body = {'schemaVersion': '0.1.0', 'requestId': uuid.uuid4().hex, 'repositoryId': 'repo', 'viewId': pipeline['selected']['repositoryViewId'],
            'command': 'compare_revisions', 'input': {'baseSnapshotId': empty['id'], 'targetSnapshotId': empty['id']}}
    response = pipeline['client'].post('/api/v1/commands', headers=pipeline['headers'], json=body)
    assert response.json()['error']['code'] == 'revision_unavailable'
