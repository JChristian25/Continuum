import uuid
import pytest
from fastapi import HTTPException
from continuum.git_changes import compare_files
from test_pipeline import ask, captured, pipeline
from test_capture import send, record
from test_comparison import prepare, compare


def latest(env):
    snapshot = ask(env, env['headers'], 'read_snapshot', {'selection': env['selection']})
    return ask(env, env['headers'], 'read_workspace', {'snapshotId': snapshot['id']})


def test_git_detects_bytes_paths_and_deletion_without_checkout():
    changes, technology = compare_files({'folder/a b.py': 'a\n', 'gone.py': 'gone', 'line.py': 'a\r\n'}, {'folder/a b.py': 'b\n', 'added.py': 'added', 'line.py': 'a\n'})
    assert {r['path']: r['kind'] for r in changes} == {'folder/a b.py': 'modified', 'gone.py': 'deleted', 'added.py': 'added', 'line.py': 'modified'}
    assert technology['technology'] == 'Git'
    assert compare_files({'same.py': 'unchanged'}, {'same.py': 'unchanged'})[0] == []
    # A move is delete/add; it cannot silently transfer an affirmative judgment.
    assert {r['kind'] for r in compare_files({'old.py': 'same'}, {'new.py': 'same'})[0]} == {'added', 'deleted'}


def test_git_unavailable_fails_closed(monkeypatch):
    monkeypatch.setattr('continuum.git_changes.shutil.which', lambda _: None)
    with pytest.raises(HTTPException) as error:
        compare_files({}, {})
    assert error.value.status_code == 503


@pytest.mark.parametrize('path', ['../outside.py', '/absolute.py', 'C:/outside.py', 'a\\b.py'])
def test_git_rejects_path_escape(path):
    with pytest.raises(HTTPException):
        compare_files({path: 'no'}, {})


@pytest.mark.parametrize('kind, relation', [('requirement', 'implements'), ('decision', 'motivates')])
def test_typed_records_review_graph_and_historical_search(captured, kind, relation):
    data = {**record(kind), 'content': 'Straße continuity acceptance condition.'}
    created = send(captured, 'capture_record', data).json()['result']
    workspace = latest(captured)
    code = next(a for a in workspace['artifacts'] if a['kind'] == 'code')
    authored = next(a for a in workspace['artifacts'] if a['kind'] == kind)
    source, target = (code, authored) if kind == 'requirement' else (authored, code)
    candidate = {'targetRevision': captured['selection']['targetRevision'], 'type': relation,
        'sourceArtifactId': source['artifactId'], 'targetArtifactId': target['artifactId'],
        'sourceVersionId': source['versionId'], 'targetVersionId': target['versionId'],
        'evidence': [{'artifactVersionId': authored['versionId'], 'locator': {'kind': 'lines', 'startLine': 1, 'endLine': 1}}],
        'reason': 'Synthetic typed relation verification.', 'predecessorContextId': None}
    response = send(captured, 'capture_candidate', candidate)
    assert response.status_code == 200, response.text
    workspace = latest(captured)
    context_id = response.json()['result']['contextId']
    graph = ask(captured, captured['headers'], 'read_graph', {'snapshotId': workspace['snapshot']['id'], 'rootArtifactId': authored['artifactId'], 'relationTypes': [relation], 'direction': 'both', 'depth': 1})
    assert graph['edges'][0]['contextId'] == context_id
    assert {n['kind'] for n in graph['nodes']} == {kind, 'code'}
    assert graph['edges'][0]['validity'] == 'candidate'
    found = ask(captured, captured['headers'], 'search_records', {'snapshotId': workspace['snapshot']['id'], 'text': 'STRASSE', 'kinds': [kind], 'matchMode': 'literal'})
    assert found['items'][0]['artifactVersionId'] == created['artifactVersionId']
    changed = {k:v for k,v in record(kind).items() if k != 'kind'}
    changed.update(artifactId=authored['artifactId'], expectedRecordVersion=1, content='A newer record without the searched term.', reason='Synthetic revision.')
    assert send(captured, 'revise_record', changed).status_code == 200
    assert ask(captured, captured['headers'], 'search_records', {'snapshotId': workspace['snapshot']['id'], 'text': 'STRASSE', 'kinds': [kind]})['items'] == found['items']
    wrong = {**candidate, 'type': 'documents'}
    assert send(captured, 'capture_candidate', wrong).status_code == 422


def test_search_pages_bind_query_and_snapshot(captured):
    workspace = latest(captured)
    data = {'snapshotId': workspace['snapshot']['id'], 'text': 'return', 'kinds': ['code'], 'pageSize': 1}
    first = ask(captured, captured['headers'], 'search_records', data)
    assert first['nextCursor']
    second = ask(captured, captured['headers'], 'search_records', {**data, 'cursor': first['nextCursor']})
    assert first['items'][0]['artifactId'] != second['items'][0]['artifactId']
    bad = captured['client'].post('/api/v1/queries', headers=captured['headers'], json={'schemaVersion':'0.1.0','requestId':uuid.uuid4().hex,'repositoryId':'repo','query':'search_records','input':{**data,'text':'changed','cursor':first['nextCursor']}})
    assert bad.status_code == 422


def test_graph_pages_retain_exact_query_and_unique_edges(captured):
    from test_pipeline import submit
    from continuum.worker import run_operation
    _, queued = submit(captured, 'discover_candidates')
    assert run_operation(captured['db'], queued['result']['operationId'])
    workspace = latest(captured)
    root = workspace['assertions'][0]['assertion']['source']['artifactId']
    data = {'snapshotId': workspace['snapshot']['id'], 'rootArtifactId': root, 'relationTypes': ['documents'], 'direction': 'outgoing', 'depth': 1, 'pageSize': 1}
    first = ask(captured, captured['headers'], 'read_graph', data)
    assert first['nextCursor']
    second = ask(captured, captured['headers'], 'read_graph', {**data, 'cursor': first['nextCursor']})
    assert first['edges'][0]['contextId'] != second['edges'][0]['contextId']
    assert all(n['artifactVersionId'] for n in second['nodes'])
    bad = captured['client'].post('/api/v1/queries', headers=captured['headers'], json={'schemaVersion':'0.1.0','requestId':uuid.uuid4().hex,'repositoryId':'repo','query':'read_graph','input':{**data,'direction':'both','cursor':first['nextCursor']}})
    assert bad.status_code == 422


def test_comparison_preserves_authored_record_memberships_and_chains(captured):
    created = send(captured, 'capture_record', record('decision')).json()['result']
    base, target, snapshot = prepare(captured)
    incoming, _, _ = compare(captured, base, target, snapshot)
    assert any(a['versionId'] == created['artifactVersionId'] for a in incoming['artifacts'])
    chained, _, _ = compare(captured, incoming['snapshot'], captured, base)
    assert chained['comparison']['baseRevision'] == incoming['snapshot']['selection']['targetRevision']
    assert any(a['versionId'] == created['artifactVersionId'] for a in chained['artifacts'])
    assert chained['comparison']['technology']['technology'] == 'Git'


def test_completion_export_and_invalidation_are_snapshot_bound(captured):
    from continuum.worker import run_operation
    workspace = latest(captured)
    data = {'snapshotId': workspace['snapshot']['id'], 'acknowledgedLimitations': workspace['snapshot']['limitations']}
    first = send(captured, 'complete_cycle', data)
    assert first.status_code == 200, first.text
    assert send(captured, 'complete_cycle', data).json()['result']['completionId'] == first.json()['result']['completionId']
    assert latest(captured)['completion']['snapshotId'] == workspace['snapshot']['id']
    assert send(captured, 'capture_record', record()).status_code == 200
    assert latest(captured)['completion'] is None
    assert send(captured, 'complete_cycle', data).status_code == 409
    exported = send(captured, 'export_snapshot', {'snapshotId': workspace['snapshot']['id'], 'format': 'json'}).json()['result']
    assert exported['status'] == 'queued'
    assert run_operation(captured['db'], exported['operationId'])
    result = ask(captured, captured['headers'], 'read_export', {'operationId': exported['operationId']})
    assert result['status'] == 'complete'
    assert result['document']['completion']['completionId'] == first.json()['result']['completionId']
    assert result['document']['snapshotId'] == workspace['snapshot']['id']
    import json
    from continuum.security import digest
    assert result['digest']['value'] == digest(json.dumps(result['document'], sort_keys=True, separators=(',', ':'), ensure_ascii=False))
    assert ask(captured, captured['headers'], 'read_export', {'operationId': exported['operationId']}) == result


def test_completion_rejects_unsettled_processing(captured):
    from test_pipeline import submit
    workspace = latest(captured)
    submit(captured, 'discover_candidates')
    response = send(captured, 'complete_cycle', {'snapshotId':workspace['snapshot']['id'], 'acknowledgedLimitations':workspace['snapshot']['limitations']})
    assert response.status_code == 409 and response.json()['error']['code'] == 'processing_active'


def test_viewer_can_export_but_cannot_complete(captured):
    from conftest import sign_in
    from continuum.worker import run_operation
    workspace = latest(captured)
    captured['headers'] = sign_in(captured, 'bob')
    response = send(captured, 'export_snapshot', {'snapshotId':workspace['snapshot']['id'], 'format':'json'})
    assert response.status_code == 200, response.text
    assert run_operation(captured['db'], response.json()['result']['operationId'])
    denied = send(captured, 'complete_cycle', {'snapshotId':workspace['snapshot']['id'], 'acknowledgedLimitations':workspace['snapshot']['limitations']})
    assert denied.status_code == 403


def test_guided_continuity_keeps_prior_reason_and_authority(captured):
    base, target, target_snapshot = prepare(captured)
    before = ask(captured, captured['headers'], 'read_workspace', {'snapshotId': base['id']})
    after = ask(captured, captured['headers'], 'read_workspace', {'snapshotId': target_snapshot['id']})
    new_versions = {a['artifactId']:a for a in after['artifacts']}
    changed = {a['artifactId'] for a in before['artifacts'] if a['contentDigest'] != new_versions[a['artifactId']]['contentDigest']}
    row = next(r for r in before['assertions'] if {r['assertion']['source']['artifactId'],r['assertion']['target']['artifactId']} & changed)
    def judge(selection, repo_view, snapshot, item, decision, reason):
        view = ask(captured,captured['headers'],'open_review_view',{'repositoryViewId':repo_view,'snapshotId':snapshot['id'],'contextId':item['projection']['contextId']})
        body={'schemaVersion':'0.1.0','requestId':uuid.uuid4().hex,'repositoryId':'repo','viewId':view['viewId'],'command':'record_judgment','input':{'contextId':item['projection']['contextId'],'assertionRevisionId':item['assertion']['id'],'expectedProjectionVersion':item['projection']['projectionVersion'],'decision':decision,'reason':reason,'reviewedEvidenceIds':item['assertion']['evidenceIds'],'contentConcern':None,'followUpDisposition':{'kind':'none'}}}
        response=captured['client'].post('/api/v1/commands',headers=captured['headers'],json=body)
        assert response.status_code==200,response.text
        assert captured['client'].post('/api/v1/commands',headers=captured['headers'],json=body).json()==response.json()
        return response
    judge(captured['selection'],captured['selected']['repositoryViewId'],base,row,'confirm','Synthetic guided-task baseline reason.')
    base=latest(captured)['snapshot']
    incoming,_,receipt=compare(captured,base,target,target_snapshot)
    selected=ask(captured,captured['headers'],'select_context',receipt['result']['selection'])
    stale=next(r for r in incoming['assertions'] if r['projection']['validity']=='stale')
    decision='reconfirm' if all(e['availability']=='available' for e in stale['evidence']) else 'retire'
    judge(receipt['result']['selection'],selected['repositoryViewId'],incoming['snapshot'],stale,decision,'Synthetic incoming review reason; not a practitioner assessment.')
    prior=ask(captured,captured['headers'],'read_assertion',{'snapshotId':base['id'],'contextId':row['projection']['contextId'],'assertionRevisionId':row['assertion']['id'],'historical':True})
    assert prior['mode']=='historical'
    history=captured['client'].get(f"/api/v1/repositories/repo/contexts/{row['projection']['contextId']}/history",params={'viewId':prior['historyViewId']}).json()
    assert any(e['reason']=='Synthetic guided-task baseline reason.' for e in history['items'])
    assert prior['assertion']['source']==row['assertion']['source']
    import json
    from pathlib import Path
    from continuum.acquisition import WORKSPACE
    proof={'case':'G-01 through G-04 automated development verification','actorScope':'isolated synthetic account; not a practitioner assessment','databaseScope':'generated test schema managed by the pytest fixture','baselineRevision':before['snapshot']['selection']['targetRevision'],'incomingRevision':incoming['snapshot']['selection']['targetRevision'],'baselineSnapshotId':base['id'],'incomingSnapshotId':incoming['snapshot']['id'],'baselineAssertionRevisionId':row['assertion']['id'],'incomingAssertionRevisionId':stale['assertion']['id'],'incomingInitialValidity':stale['projection']['validity'],'incomingDecision':decision,'priorReasonRetrieved':True,'priorSourceReferencesUnchanged':True,'technology':incoming['comparison']['technology']}
    destination=WORKSPACE/'outputs/continuity-completion/guided-task-result.json'
    destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(json.dumps(proof,indent=2),encoding='utf-8')


def test_pending_reviews_block_completion(captured):
    from test_pipeline import submit
    from continuum.worker import run_operation
    _,job=submit(captured,'discover_candidates');assert run_operation(captured['db'],job['result']['operationId'])
    workspace=latest(captured)
    response=send(captured,'complete_cycle',{'snapshotId':workspace['snapshot']['id'],'acknowledgedLimitations':workspace['snapshot']['limitations']})
    assert response.status_code==409 and response.json()['error']['code']=='pending_review'


def test_deleted_endpoint_is_unresolved_and_cannot_be_confirmed(captured):
    # An isolated synthetic boundary snapshot, not an added upstream acquisition.
    from copy import deepcopy
    from continuum.pipeline_models import Snapshot
    base,target,target_snapshot=prepare(captured)
    old=ask(captured,captured['headers'],'read_workspace',{'snapshotId':base['id']})
    incoming=ask(captured,captured['headers'],'read_workspace',{'snapshotId':target_snapshot['id']})
    missing=old['assertions'][0]['assertion']['target']['artifactId']
    document={k:deepcopy(incoming[k]) for k in ['snapshot','artifacts','assertions','followUps','comparison']}
    document['artifacts']=[a for a in document['artifacts'] if a['artifactId']!=missing]
    for coverage in document['snapshot']['coverage']:
        if coverage['function']=='ingestion':coverage.update(processedCount=9,eligibleCount=9)
    identity=uuid.uuid4().hex
    document['snapshot']['id']=identity
    with captured['db'].begin() as db:
        original=db.get(Snapshot,target_snapshot['id'])
        db.add(Snapshot(id=identity,repository_id='repo',selection_id=original.selection_id,snapshot_version=original.snapshot_version,document=document))
    result,_,receipt=compare(captured,base,target,document['snapshot'])
    broken=next(i for i in result['assertions'] if i['assertion']['target']['artifactId']==missing)
    assert broken['assertion']['target']['versionId'] is None
    assert broken['assertion']['target']['availability']=='missing'
    assert broken['assertion']['target']['priorVersionId']
    selected=ask(captured,captured['headers'],'select_context',receipt['result']['selection'])
    view=ask(captured,captured['headers'],'open_review_view',{'repositoryViewId':selected['repositoryViewId'],'snapshotId':result['snapshot']['id'],'contextId':broken['projection']['contextId']})
    attempted=captured['client'].post('/api/v1/commands',headers=captured['headers'],json={'schemaVersion':'0.1.0','requestId':uuid.uuid4().hex,'repositoryId':'repo','viewId':view['viewId'],'command':'record_judgment','input':{'contextId':broken['projection']['contextId'],'assertionRevisionId':broken['assertion']['id'],'expectedProjectionVersion':0,'decision':'confirm','reason':'Synthetic missing-source boundary.','reviewedEvidenceIds':broken['assertion']['evidenceIds'],'contentConcern':None,'followUpDisposition':{'kind':'none'}}})
    assert attempted.status_code==422 and attempted.json()['error']['code']=='missing_evidence'
    graph=ask(captured,captured['headers'],'read_graph',{'snapshotId':result['snapshot']['id'],'rootArtifactId':broken['assertion']['source']['artifactId'],'relationTypes':['documents'],'direction':'both','depth':1})
    assert any(item['contextId']==broken['projection']['contextId'] for item in graph['unresolved'])


def test_authored_record_revision_requires_new_evidence_and_judgment(captured):
    from continuum.schemas import Envelope
    created=send(captured,'capture_record',{**record('requirement'),'content':'Original requirement.'}).json()['result']
    workspace=latest(captured)
    code=next(a for a in workspace['artifacts'] if a['kind']=='code')
    candidate=send(captured,'capture_candidate',{'targetRevision':captured['selection']['targetRevision'],'type':'implements','sourceArtifactId':code['artifactId'],'targetArtifactId':created['artifactId'],'sourceVersionId':code['versionId'],'targetVersionId':created['artifactVersionId'],'evidence':[{'artifactVersionId':created['artifactVersionId'],'locator':{'kind':'lines','startLine':1,'endLine':1}}],'reason':'Synthetic typed baseline.','predecessorContextId':None}).json()['result']
    workspace=latest(captured)
    view=ask(captured,captured['headers'],'open_review_view',{'repositoryViewId':captured['selected']['repositoryViewId'],'snapshotId':workspace['snapshot']['id'],'contextId':candidate['contextId']})
    judgment={'contextId':candidate['contextId'],'assertionRevisionId':candidate['assertionRevisionId'],'expectedProjectionVersion':0,'decision':'confirm','reason':'Original typed requirement judgment.','reviewedEvidenceIds':candidate['evidenceIds'],'contentConcern':None,'followUpDisposition':{'kind':'none'}}
    body={'schemaVersion':'0.1.0','requestId':uuid.uuid4().hex,'repositoryId':'repo','viewId':view['viewId'],'command':'record_judgment','input':judgment}
    assert captured['client'].post('/api/v1/commands',headers=captured['headers'],json=body).status_code==200
    prior=latest(captured)
    revised=send(captured,'revise_record',{'artifactId':created['artifactId'],'expectedRecordVersion':1,'title':'Updated requirement','content':'Changed requirement.','sourceReference':None,'sourceAbsenceReason':'Synthetic verification.','reason':'Explicit version change.'})
    assert revised.status_code==200,revised.text
    result=revised.json()['result']
    selection=ask(captured,captured['headers'],'select_context',result['selection'])
    incoming=ask(captured,captured['headers'],'read_workspace',{'snapshotId':selection['snapshot']['id']})
    row=next(i for i in incoming['assertions'] if i['assertion']['type']=='implements')
    assert row['projection']['validity']=='stale'
    assert row['assertion']['target']['versionId']==result['artifactVersionId']
    assert any(e['availability']=='unresolved' for e in row['evidence'])
    view=ask(captured,captured['headers'],'open_review_view',{'repositoryViewId':selection['repositoryViewId'],'snapshotId':incoming['snapshot']['id'],'contextId':row['projection']['contextId']})
    correction={'schemaVersion':'0.1.0','requestId':uuid.uuid4().hex,'repositoryId':'repo','viewId':view['viewId'],'command':'correct_assertion','input':{'contextId':row['projection']['contextId'],'assertionRevisionId':row['assertion']['id'],'expectedProjectionVersion':0,'reason':'Anchor the explicitly changed record.','replacement':{'type':'implements','sourceArtifactId':code['artifactId'],'sourceVersionId':code['versionId'],'targetArtifactId':created['artifactId'],'targetVersionId':result['artifactVersionId'],'evidenceIds':[],'newEvidence':[{'artifactVersionId':result['artifactVersionId'],'locator':{'kind':'lines','startLine':1,'endLine':1}}]}}}
    response=captured['client'].post('/api/v1/commands',headers=captured['headers'],json=correction)
    assert response.status_code==200,response.text
    fixed=response.json()['result']
    assert fixed['successorProjection']['validity']=='candidate'
    successor=captured['client'].get(f"/api/v1/repositories/repo/contexts/{fixed['successorProjection']['contextId']}",params={'viewId':fixed['successorViewId']}).json()
    assertion=successor['assertion']
    body.update(requestId=uuid.uuid4().hex,viewId=fixed['successorViewId'],input={**judgment,'contextId':fixed['successorProjection']['contextId'],'assertionRevisionId':assertion['id'],'reviewedEvidenceIds':assertion['evidenceIds'],'reason':'New typed requirement judgment.'})
    assert captured['client'].post('/api/v1/commands',headers=captured['headers'],json=body).status_code==200
    retained=ask(captured,captured['headers'],'read_workspace',{'snapshotId':prior['snapshot']['id']})
    old=next(i for i in retained['assertions'] if i['projection']['contextId']==candidate['contextId'])
    assert old['projection']['validity']=='confirmed' and old['assertion']['target']['versionId']==created['artifactVersionId']


def test_comparison_serializes_with_a_concurrent_baseline_decision(captured):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    base,target,snapshot=prepare(captured)
    workspace=latest(captured)
    target_versions={a['artifactId']:a for a in latest(target)['artifacts']}
    changed={a['artifactId'] for a in workspace['artifacts'] if a['contentDigest']!=target_versions[a['artifactId']]['contentDigest']}
    row=next(r for r in workspace['assertions'] if {r['assertion']['source']['artifactId'],r['assertion']['target']['artifactId']} & changed)
    view=ask(captured,captured['headers'],'open_review_view',{'repositoryViewId':captured['selected']['repositoryViewId'],'snapshotId':workspace['snapshot']['id'],'contextId':row['projection']['contextId']})
    reject={'schemaVersion':'0.1.0','requestId':uuid.uuid4().hex,'repositoryId':'repo','viewId':view['viewId'],'command':'record_judgment','input':{'contextId':row['projection']['contextId'],'assertionRevisionId':row['assertion']['id'],'expectedProjectionVersion':row['projection']['projectionVersion'],'decision':'reject','reason':'Concurrent synthetic terminal decision.','reviewedEvidenceIds':[],'contentConcern':None,'followUpDisposition':{'kind':'none'}}}
    comparison={'schemaVersion':'0.1.0','requestId':uuid.uuid4().hex,'repositoryId':'repo','viewId':target['selected']['repositoryViewId'],'command':'compare_revisions','input':{'baseSnapshotId':base['id'],'targetSnapshotId':snapshot['id']}}
    barrier=Barrier(2)
    def send_concurrently(body):
        barrier.wait(timeout=10)
        return captured['client'].post('/api/v1/commands',headers=captured['headers'],json=body)
    with ThreadPoolExecutor(max_workers=2) as pool:
        decision_future=pool.submit(send_concurrently,reject)
        comparison_future=pool.submit(send_concurrently,comparison)
        decision,compared=decision_future.result(),comparison_future.result()
    assert decision.status_code==200,decision.text
    assert compared.status_code in {200,409},compared.text
    if compared.status_code==200:
        selected=ask(captured,captured['headers'],'select_context',compared.json()['result']['selection'])
        incoming=ask(captured,captured['headers'],'read_workspace',{'snapshotId':selected['snapshot']['id']})
        assert all(i['projection']['validity']!='confirmed' for i in incoming['assertions'])
    # Reopening an already frozen comparison preserves it if comparison won the lock.
    comparison['requestId']=uuid.uuid4().hex
    retried=captured['client'].post('/api/v1/commands',headers=captured['headers'],json=comparison)
    if compared.status_code == 200:
        assert retried.status_code == 200
        assert retried.json()['result']['selection'] == compared.json()['result']['selection']
    else:
        assert retried.status_code == 409 and retried.json()['error']['code'] == 'snapshot_conflict'
    # A genuinely new comparison cannot consume that old base after rejection.
    assert send(target, 'capture_record', record('requirement')).status_code == 200
    comparison['requestId'] = uuid.uuid4().hex
    comparison['input']['targetSnapshotId'] = latest(target)['snapshot']['id']
    rejected = captured['client'].post('/api/v1/commands',headers=captured['headers'],json=comparison)
    assert rejected.status_code == 409 and rejected.json()['error']['code'] == 'snapshot_conflict'
    terminal = next(i for i in latest(captured)['assertions'] if i['projection']['contextId'] == row['projection']['contextId'])
    assert terminal['projection']['validity'] == 'rejected'


def test_release_lookup_rejects_path_input_and_reports_source_drift(captured,monkeypatch):
    import json
    import tempfile
    from pathlib import Path
    from continuum import release
    from continuum.acquisition import WORKSPACE
    current=release.fingerprints()
    with tempfile.TemporaryDirectory(prefix='release-test-',dir=WORKSPACE/'outputs/runtime') as temporary:
        home=Path(temporary)
        (home/'RELEASE.json').write_text(json.dumps({'id':'synthetic-release-fixture','sourceSha256':current,'limitations':[]}),encoding='utf-8')
        monkeypatch.setattr(release,'HOME',home)
        result=ask(captured,captured['headers'],'read_release_record',{'releaseRecordId':'current'})
        assert result['currentSourceMatchesRecord']
        monkeypatch.setattr(release,'fingerprints',lambda:{})
        assert not ask(captured,captured['headers'],'read_release_record',{'releaseRecordId':'current'})['currentSourceMatchesRecord']
        with pytest.raises(HTTPException) as error:release.read_record('../outside')
        assert error.value.status_code==404
