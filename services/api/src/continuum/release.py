"""Reproducible development release disclosure; no migration or participant reset."""
import argparse
import importlib.metadata
import json
from pathlib import Path
import platform
import re
import subprocess
from .acquisition import WORKSPACE, contained
from .security import digest, fail, utc

HOME = Path(__file__).resolve().parents[2]

def fingerprints():
    paths = []
    for root, patterns in [('services/api/src', ['*.py']), ('services/api/tests', ['*.py']), ('apps/web/src', ['*.js', '*.jsx', '*.css']), ('apps/web/tests', ['*.mjs', '*.jsx', '*.html'])]:
        for pattern in patterns:
            paths.extend((WORKSPACE / root).rglob(pattern))
    paths.extend(WORKSPACE / name for name in ['services/api/pyproject.toml', 'services/api/requirements.lock', 'apps/web/package.json', 'apps/web/package-lock.json', 'apps/web/vite.config.js'])
    import hashlib
    return {p.relative_to(WORKSPACE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(set(paths)) if p.is_file()}


def read_record(identity):
    if identity == 'current':
        path = HOME / 'RELEASE.json'
    elif re.fullmatch(r'continuity-core-[0-9a-f]{24}', identity):
        path = HOME / 'releases' / (identity + '.json')
    else:
        fail('not_found', 404)
    if not path.is_file():
        fail('not_found', 404)
    record = json.loads(path.read_text(encoding='utf-8'))
    matches = record['sourceSha256'] == fingerprints()
    return {**record, 'currentSourceMatchesRecord': matches,
            'limitations': record['limitations'] + ([] if matches else ['Current source bytes differ from this recorded release; verification does not transfer to those changes.'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verification', type=Path, required=True)
    args = parser.parse_args()
    verification = contained(args.verification, WORKSPACE)
    checks = json.loads(verification.read_text(encoding='utf-8'))
    sources = fingerprints()
    build = digest(json.dumps(sources, sort_keys=True))
    identity = 'continuity-core-' + build[:24]
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=WORKSPACE, capture_output=True, text=True, check=True).stdout.strip()
    record = {'id': identity, 'softwareVersion': importlib.metadata.version('continuum-api'), 'buildId': build,
        'baseCommit': commit, 'recordedAt': utc(), 'configurationId': 'HC-LEXICAL-2026-11-13-P1', 'language': 'Python',
        'documentFormats': ['Markdown', 'plain-text'], 'sourceSha256': sources,
        'dependencies': sorted([{'name': d.metadata['Name'], 'version': d.version} for d in importlib.metadata.distributions()], key=lambda d:d['name'].lower()),
        'operatingRequirements': ['Python 3.12 or later; observed ' + platform.python_version(), 'PostgreSQL with the existing initialized review schema', 'Native Git on PATH', 'Node/npm for the Vite frontend', 'Accepted bounded Healthchecks bytes and frozen profile', 'Named operator-provisioned account; local HTTP is development only'],
        'supportMatrix': [{'function':name,'status':status,'limitations':limits} for name,status,limits in [
            ('ingestion','implemented',['Accepted 10-path, four-commit inventory only.']),('extraction','partially_implemented',['Python tokenize and document line scan; no AST or runtime dependency analysis.']),
            ('relationship_evidence','partially_implemented',['Frozen lexical documents candidates; manually anchored documents/implements/motivates; no semantic accuracy claim.']),
            ('change_handling','partially_implemented',['Native Git retained-byte comparison; exact path identity; no automatic rename identity or transitive propagation.']),
            ('human_review','implemented',['Exact-context authorization and evidence acknowledgment; initial candidate rationale optional; exceptional-action reasons required.', 'Existing databases require separately authorized nullable-reason migration before reason-free writes.']),
            ('search','implemented',['Unicode literal matching, retained snapshot, up to 1000 artifacts/5000 assertions and 100 results/page.']),
            ('graph','implemented',['Typed one-hop neighborhoods and explicit unresolved endpoints.']),('completion','implemented',['Current settled snapshot and explicit limitations acknowledgment.']),
            ('export','implemented',['Queued JSON export, at most 4 MiB; references rather than a full source archive.']),('AI_assistant','unsupported',['Outside this core continuation.'])]],
        'verificationReferences': [verification.relative_to(WORKSPACE).as_posix()], 'verification': checks,
        'guidedTaskIds': ['G-01','G-02','G-03','G-04'], 'practitionerEvaluation': 'not performed by development checks',
        'limitations': ['Development release record, not a deployment or practitioner acceptance.', 'Source build identity includes uncommitted working-tree changes; baseCommit alone does not identify this build.', 'Existing local user data was not migrated or reset.']}
    encoded = json.dumps(record, indent=2, ensure_ascii=False) + '\n'
    archive = HOME / 'releases' / (identity + '.json')
    archive.parent.mkdir(exist_ok=True)
    if archive.exists():
        record = json.loads(archive.read_text(encoding='utf-8'))
        encoded = json.dumps(record, indent=2, ensure_ascii=False) + '\n'
    else:
        archive.write_text(encoded, encoding='utf-8')
    (HOME / 'RELEASE.json').write_text(encoded, encoding='utf-8')
    print(identity)

if __name__ == '__main__':
    main()
