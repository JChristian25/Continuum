import os
import socket
import subprocess
import sys
import time

import httpx

from conftest import envelope


def test_tcp_service_restart_retains_session_and_committed_history(setup):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    url = setup["engine"].url.update_query_dict({"options": "-csearch_path=" + setup["schema"]})
    environment = {**os.environ, "CONTINUUM_DATABASE_URL": url.render_as_string(hide_password=False),
                   "CONTINUUM_ORIGIN": origin, "CONTINUUM_LOCAL_HTTP": "1"}

    def start():
        process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "continuum.main:app_factory", "--factory", "--host", "127.0.0.1", "--port", str(port), "--no-access-log"],
            env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise AssertionError(f"API process exited: {process.returncode}")
            try:
                if httpx.get(origin + "/api/v1/health", timeout=0.5).status_code == 200:
                    return process
            except httpx.TransportError:
                pass
            time.sleep(0.05)
        process.terminate()
        process.wait(timeout=10)
        raise AssertionError("API process did not become ready")

    process = start()
    try:
        with httpx.Client(base_url=origin, timeout=10) as client:
            bootstrap = client.get("/api/v1/auth/bootstrap").json()
            response = client.post("/api/v1/auth/login", headers={"Origin": origin, "X-CSRF-Token": bootstrap["csrfToken"]},
                json={"schemaVersion": "0.1.0", "requestId": "process-login", "login": "alice", "password": setup["password"]})
            assert response.status_code == 200
            session = client.get("/api/v1/auth/session").json()
            body = envelope()
            response = client.post("/api/v1/commands", headers={"Origin": origin, "X-CSRF-Token": session["csrfToken"]}, json=body)
            assert response.status_code == 200, response.text
            committed = response.json()
            process.terminate()
            process.wait(timeout=10)
            process = start()
            retained = client.get("/api/v1/repositories/repo/contexts/context1/history", params={"viewId": "view1"})
            assert retained.status_code == 200, retained.text
            assert retained.json()["items"][0]["id"] == committed["result"]["eventIds"][0]
            replayed = client.post("/api/v1/commands", headers={"Origin": origin, "X-CSRF-Token": session["csrfToken"]}, json=body)
            assert replayed.status_code == 200
            assert replayed.json() == committed
    finally:
        process.terminate()
        process.wait(timeout=10)
