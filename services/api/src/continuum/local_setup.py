"""Provision the authorized local workspace using only already accepted source."""
import argparse
from pathlib import Path
import uuid

from sqlalchemy import select

from .acquisition import WORKSPACE, load_accepted
from .config import Settings
from .db import initialize, make_engine, session_factory
from .models import Account, Grant, Repository, SecurityAudit
from .pipeline import admit, query, register_input, register_profile, stable
from .pipeline_schemas import QueryEnvelope
from .schemas import Envelope
from .security import passwords, utc
from .worker import run_operation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--password-file', type=Path, required=True)
    args = parser.parse_args()
    password = args.password_file.read_text(encoding='utf-8').rstrip('\r\n')
    if not 12 <= len(password) <= 128:
        parser.error('Password must contain 12–128 characters')
    factory_engine = make_engine(Settings.from_env().database_url)
    initialize(factory_engine)  # Additive schema only; never resets records.
    factory = session_factory(factory_engine)
    change = WORKSPACE / 'openspec/changes/establish-versioned-continuity-core'
    manifest_path = change / 'healthchecks-input-manifest.proposed.json'
    acceptance_path = change / 'healthchecks-input-acceptance.json'
    manifest, *_ = load_accepted(manifest_path, acceptance_path, WORKSPACE)
    with factory.begin() as db:
        actor = db.scalar(select(Account).where(Account.login == 'jc'))
        if actor is not None:
            parser.error('Account jc already exists; this tool never replaces credentials')
        actor = Account(login='jc', display_name='JC', password_hash=passwords.hash(password))
        password = None
        db.add(actor)
        repository_id = stable('local-workspace', 'healthchecks/healthchecks')
        repository = db.get(Repository, repository_id)
        if repository is None:
            repository = Repository(id=repository_id, name='Healthchecks')
            db.add(repository)
        db.flush()
        db.add(Grant(actor_id=actor.id, repository_id=repository.id, role='reviewer'))
        db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action='local_workspace_provision', outcome='success'))
        registered = register_input(db, repository.id, manifest_path, acceptance_path)
        profile = register_profile(db, repository.id, registered.id, change / 'discovery-profile.proposed.json', change / 'discovery-profile-acceptance.json')
        actor_id, inventory_id, configuration_id = actor.id, registered.id, profile.id
    for label, revision in manifest['revisions'].items():
        selection = {'repositoryId': repository_id, 'targetRevision': {k: revision[k] for k in ['objectAlgorithm', 'commitId']},
                     'baseRevision': None, 'inventoryId': inventory_id, 'configurationId': configuration_id}
        with factory.begin() as db:
            repository = db.get(Repository, repository_id)
            selected = query(db, repository, QueryEnvelope(schemaVersion='0.1.0', requestId=uuid.uuid4().hex,
                repositoryId=repository_id, query='select_context', input=selection))
        for command in ['capture_files', 'discover_candidates']:
            with factory.begin() as db:
                response = admit(db, db.get(Account, actor_id), db.get(Repository, repository_id), Envelope(
                    schemaVersion='0.1.0', requestId=uuid.uuid4().hex, repositoryId=repository_id,
                    viewId=selected['repositoryViewId'], command=command,
                    input={k: selection[k] for k in ['targetRevision', 'inventoryId', 'configurationId']}))
            if not run_operation(factory, response['result']['operationId']):
                raise RuntimeError('Operation did not publish; inspect the retained operation before retrying')
        print(label, 'captured and discovered; all automatic relationships remain unconfirmed')
    print('Local account jc and accepted Healthchecks workspace are ready. No source was acquired or executed.')


if __name__ == '__main__':
    main()
