"""Snapshot-bound lexical access using Unicode built-ins and retained page records."""
import json
from typing import Literal
from pydantic import Field
from sqlalchemy import select
from .models import ArtifactVersion, ReviewEvent, ReviewContext, View
from .pipeline_models import ResultPage, ReviewViewBinding, Selection, Snapshot
from .review import scoped
from .schemas import Strict, Id
from .relations import RelationType
from .security import digest, fail

KINDS = Literal["code", "document", "requirement", "decision"]
class PageInput(Strict):
    snapshotId: Id
    cursor: Id | None = None
    pageSize: int = Field(default=30, ge=1, le=100)

class SearchInput(PageInput):
    text: str = Field(min_length=1, max_length=256, pattern=r"\S")
    kinds: list[KINDS] = Field(min_length=1, max_length=4)
    matchMode: Literal["literal"] = "literal"

class GraphInput(PageInput):
    rootArtifactId: Id
    relationTypes: list[RelationType] = Field(min_length=1, max_length=3)
    direction: Literal["incoming", "outgoing", "both"]
    depth: Literal[1]

class AssertionInput(Strict):
    snapshotId: Id
    assertionRevisionId: Id
    contextId: Id
    historical: bool = False


def bounded_snapshot(db, repository_id, snapshot_id):
    snapshot = scoped(db, Snapshot, snapshot_id, repository_id)
    if len(snapshot.document['artifacts']) > 1000 or len(snapshot.document['assertions']) > 5000:
        fail('limit_exceeded', 422, {'limitName': 'snapshotAccessRecords', 'maximum': 5000, 'unit': 'records'})
    return snapshot


def frozen_page(db, repository, name, data, build):
    snapshot = bounded_snapshot(db, repository.id, data.snapshotId)
    binding = digest(json.dumps(data.model_dump(exclude={'cursor'}), sort_keys=True))
    if data.cursor:
        page = scoped(db, ResultPage, data.cursor, repository.id)
        if page.query != name or page.binding != binding:
            fail('invalid_input', details={'fields': ['cursor']})
        items, metadata, after = page.items, page.metadata_document, page.after_index
    else:
        items, additional = build(snapshot)
        metadata = {'snapshotId': snapshot.id, 'coverage': snapshot.document['snapshot']['coverage'],
                    'limitations': snapshot.document['snapshot']['limitations'], **additional}
        after = 0
    cursor = None
    if after + data.pageSize < len(items):
        page = ResultPage(repository_id=repository.id, query=name, binding=binding, items=items,
                          metadata_document=metadata, after_index=after + data.pageSize)
        db.add(page); db.flush(); cursor = page.id
    return {**metadata, 'items': items[after:after + data.pageSize], 'nextCursor': cursor, 'snapshotResultCount': len(items)}


def search(db, repository, data):
    if len(set(data.kinds)) != len(data.kinds):
        fail('invalid_input')
    def build(snapshot):
        text, hits = data.text.casefold(), []
        # Only history at this retained snapshot's high-water marks is eligible.
        reasons = {}
        for item in snapshot.document['assertions']:
            projection, assertion = item['projection'], item['assertion']
            for event in db.scalars(select(ReviewEvent).where(ReviewEvent.context_id == projection['contextId'], ReviewEvent.sequence <= item['historySequence']).order_by(ReviewEvent.sequence)):
                if text in event.reason.casefold():
                    for endpoint in [assertion['source'], assertion['target']]:
                        reasons.setdefault(endpoint['artifactId'], []).append({'field': 'rationale', 'locator': None,
                            'excerpt': event.reason[:500], 'eventId': event.id, 'contextId': projection['contextId']})
        for row in sorted(snapshot.document['artifacts'], key=lambda a: (a['artifactId'], a['versionId'])):
            if row['kind'] not in data.kinds:
                continue
            version = scoped(db, ArtifactVersion, row['versionId'], repository.id)
            readable = digest(version.content) == version.digest
            matches = list(reasons.get(row['artifactId'], []))
            for field, value in [('path', row['path']), ('title', row['identity'].get('title', ''))]:
                if text in value.casefold():
                    matches.append({'field': field, 'locator': {'kind': 'field', 'fieldPath': field}, 'excerpt': value[:500]})
            if readable:
                for line, value in enumerate(version.content.splitlines(), 1):
                    if text in value.casefold():
                        matches.append({'field': 'content', 'locator': {'kind': 'lines', 'startLine': line, 'endLine': line}, 'excerpt': value[:500]})
                        if len(matches) >= 20:
                            break
            if matches:
                hits.append({'artifactId': row['artifactId'], 'artifactVersionId': row['versionId'], 'kind': row['kind'],
                    'label': row['identity'].get('title') or row['path'], 'path': row['path'], 'matches': matches[:20],
                    'availability': 'available' if readable else 'unresolved',
                    'limitations': ['Literal matching within this snapshot; at most 20 excerpts of 500 characters per record.', *([] if readable else ['Exact source digest could not be verified.'])]})
        return hits, {'searchedKinds': data.kinds, 'matchMode': 'literal', 'scopeComplete': False,
                      'searchNotice': 'No match means no match within the selected captured scope, not no relevant project knowledge.'}
    return frozen_page(db, repository, 'search_records', data, build)


def graph(db, repository, data):
    if len(set(data.relationTypes)) != len(data.relationTypes):
        fail('invalid_input')
    def build(snapshot):
        artifacts = {row['artifactId']: row for row in snapshot.document['artifacts']}
        if data.rootArtifactId not in artifacts:
            fail('not_found', 404)
        items = []
        for item in sorted(snapshot.document['assertions'], key=lambda a: (a['assertion']['id'], a['projection']['contextId'])):
            a, p = item['assertion'], item['projection']
            incoming = a['target']['artifactId'] == data.rootArtifactId
            outgoing = a['source']['artifactId'] == data.rootArtifactId
            if a['type'] not in data.relationTypes or not ((data.direction in {'incoming', 'both'} and incoming) or (data.direction in {'outgoing', 'both'} and outgoing)):
                continue
            nodes, unavailable = [], []
            for endpoint in [a['source'], a['target']]:
                row = artifacts.get(endpoint['artifactId'])
                if endpoint['availability'] != 'available' or row is None or row['versionId'] != endpoint['versionId']:
                    unavailable.append(endpoint)
                else:
                    nodes.append({'artifactId': row['artifactId'], 'artifactVersionId': row['versionId'], 'kind': row['kind'],
                        'label': row['identity'].get('title') or row['path'], 'representationOnly': row['kind'] in {'requirement', 'decision'}, 'availability': 'available', 'limitations': []})
            edge = {'assertionId': a['assertionId'], 'assertionRevisionId': a['id'], 'contextId': p['contextId'],
                'sourceArtifactId': a['source']['artifactId'], 'sourceVersionId': a['source']['versionId'],
                'targetArtifactId': a['target']['artifactId'], 'targetVersionId': a['target']['versionId'],
                'type': a['type'], 'validity': p['validity'], 'resolution': p['resolution'], 'evidenceIds': a['evidenceIds']}
            items.append({'edge': edge if not unavailable else None, 'nodes': nodes,
                          'unresolved': {'contextId': p['contextId'], 'endpoints': unavailable} if unavailable else None})
        root = artifacts[data.rootArtifactId]
        root_node = {'artifactId': root['artifactId'], 'artifactVersionId': root['versionId'], 'kind': root['kind'], 'label': root['identity'].get('title') or root['path'], 'representationOnly': root['kind'] in {'requirement','decision'}, 'availability': 'available', 'limitations': []}
        return items, {'rootArtifactId': data.rootArtifactId, 'rootNode': root_node}
    page = frozen_page(db, repository, 'read_graph', data, build)
    nodes = {n['artifactId']: n for item in page['items'] for n in item['nodes']}
    nodes.setdefault(page['rootNode']['artifactId'], page['rootNode'])
    return {**page, 'nodes': list(nodes.values()), 'edges': [i['edge'] for i in page['items'] if i['edge']],
            'unresolved': [i['unresolved'] for i in page['items'] if i['unresolved']]}


def read_assertion(db, repository, data):
    snapshot = bounded_snapshot(db, repository.id, data.snapshotId)
    item = next((i for i in snapshot.document['assertions'] if i['projection']['contextId'] == data.contextId and i['assertion']['id'] == data.assertionRevisionId), None)
    if item is None:
        fail('not_found', 404)
    selection = scoped(db, Selection, snapshot.selection_id, repository.id)
    context = scoped(db, ReviewContext, data.contextId, repository.id)
    mode = 'active' if not data.historical and selection.snapshot_version == snapshot.snapshot_version and context.resolution != 'superseded' else 'historical'
    view = View(repository_id=repository.id, context_id=data.contextId, assertion_revision_id=data.assertionRevisionId, mode=mode)
    db.add(view); db.flush()
    db.add(ReviewViewBinding(view_id=view.id, selection_id=selection.id, snapshot_id=snapshot.id)); db.flush()
    return {'snapshotId': snapshot.id, **item, 'mode': mode, 'viewId': view.id, 'historyViewId': view.id,
            'followUps': [w for w in snapshot.document['followUps'] if w['contextId'] == data.contextId], 'limitations': snapshot.document['snapshot']['limitations']}
