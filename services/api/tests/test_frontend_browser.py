"""A real browser and TCP API, accepted source, isolated synthetic accounts/schema."""
import json
import os
import shutil
import socket
import subprocess
from threading import Thread
import time
from urllib.request import urlopen

from sqlalchemy import func, select
import uvicorn

from continuum.acquisition import WORKSPACE
from continuum.config import Settings
from continuum.main import create_app
from continuum.models import ReviewEvent
from continuum.worker import run_operation
from test_pipeline import ask, captured, pipeline, submit


def port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def test_real_frontend_session_snapshot_and_review(pipeline):
    captured = pipeline
    choice = {**captured['selection'], 'targetRevision': {'objectAlgorithm': 'sha1', 'commitId': 'c62d6648d81e1aebc65f80bddc72f165fba7320b'}}
    selected = ask(captured, captured['headers'], 'select_context', choice)
    target = {**captured, 'selection': choice, 'selected': selected}
    _, admission = submit(target)
    assert run_operation(captured['db'], admission['result']['operationId'])
    web_port, api_port = port(), port()
    origin = f'http://127.0.0.1:{web_port}'
    settings = Settings(str(captured['engine'].url.render_as_string(hide_password=False)), origin=origin, local_http=True)
    app = create_app(settings, captured['engine'], worker_enabled=True)
    server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=api_port, log_level='error'))
    thread = Thread(target=server.run, daemon=True)
    thread.start()
    env = {**os.environ, 'CONTINUUM_API_TARGET': f'http://127.0.0.1:{api_port}'}
    output = WORKSPACE / 'outputs/frontend-integration'
    output.mkdir(parents=True, exist_ok=True)
    with (output / 'vite-test.log').open('w') as log:
        vite = subprocess.Popen([shutil.which('node'), str(WORKSPACE / 'apps/web/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', str(web_port)], cwd=WORKSPACE / 'apps/web', env=env, stdout=log, stderr=log)
        try:
            deadline = time.monotonic() + 25
            while time.monotonic() < deadline:
                try:
                    with urlopen(origin, timeout=1) as response:
                        if response.status == 200 and server.started:
                            break
                except OSError:
                    pass
                time.sleep(.1)
            else:
                raise AssertionError('Isolated frontend/API did not start')
            result = subprocess.run([shutil.which('node'), str(WORKSPACE / 'apps/web/tests/service-browser.mjs')],
                input=json.dumps({'url': origin, 'password': captured['password']}), text=True, capture_output=True, timeout=240)
            assert result.returncode == 0, result.stdout + result.stderr
            evidence = json.loads(result.stdout.strip())
            assert evidence['passed']
            (output / 'browser-result.json').write_text(json.dumps(evidence, indent=2))
            with captured['db']() as db:
                assert db.scalar(select(func.count()).select_from(ReviewEvent).where(ReviewEvent.type == 'judgment')) == 19
        finally:
            vite.terminate()
            vite.wait(timeout=10)
            server.should_exit = True
            thread.join(timeout=10)
