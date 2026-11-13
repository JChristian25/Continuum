import sys

from sqlalchemy import select

from continuum import admin
from continuum.models import Account, Grant, SecurityAudit
from continuum.security import passwords
from conftest import envelope, sign_in


def configure(setup, monkeypatch):
    url = setup["engine"].url.update_query_dict({"options": "-csearch_path=" + setup["schema"]})
    monkeypatch.setenv("CONTINUUM_DATABASE_URL", url.render_as_string(hide_password=False))
    monkeypatch.setenv("CONTINUUM_ORIGIN", "https://test")
    monkeypatch.delenv("CONTINUUM_LOCAL_HTTP", raising=False)


def run(monkeypatch, *arguments):
    monkeypatch.setattr(sys, "argv", ["continuum-admin", *arguments])
    admin.main()


def test_provision_named_account_without_default_grant_or_credential_output(setup, monkeypatch, capsys):
    configure(setup, monkeypatch)
    monkeypatch.setattr(admin.getpass, "getpass", lambda prompt: setup["password"])
    run(monkeypatch, "create-account", "Dana", "Dana Reviewer")
    assert setup["password"] not in capsys.readouterr().out
    with setup["db"]() as db:
        actor = db.scalar(select(Account).where(Account.login == "dana"))
        assert passwords.verify(actor.password_hash, setup["password"])
        assert db.get(Grant, (actor.id, "repo")) is None
        audit = db.scalar(select(SecurityAudit).where(SecurityAudit.subject_actor_id == actor.id))
        assert audit.action == "create_account"


def test_operator_grant_reset_and_disable_revoke_service_authority(setup, monkeypatch):
    configure(setup, monkeypatch)
    headers = sign_in(setup)
    run(monkeypatch, "grant", "alice", "repo", "viewer")
    assert setup["client"].post("/api/v1/commands", headers=headers, json=envelope()).status_code == 403
    run(monkeypatch, "grant", "alice", "repo", "reviewer")
    monkeypatch.setattr(admin.getpass, "getpass", lambda prompt: setup["password"])
    run(monkeypatch, "reset-password", "alice")
    assert setup["client"].get("/api/v1/auth/session").status_code == 401
    sign_in(setup)
    run(monkeypatch, "disable-account", "alice")
    assert setup["client"].get("/api/v1/auth/session").status_code == 401
