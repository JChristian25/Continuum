import argparse
import getpass
from pathlib import Path

from sqlalchemy import select

from .config import Settings
from .db import initialize, make_engine, session_factory
from .models import Account, Grant, Repository, SecurityAudit, Session
from .security import passwords, utc


def main():
    parser = argparse.ArgumentParser(description="Local Continuum operator tool; no public account or role API.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-db", help="Create the initial additive schema; never resets existing data")
    commands.add_parser("worker-once", help="Process at most one durable queued/expired operation")
    register = commands.add_parser("register-input", help="Register an acquired accepted input; acquires no new source")
    register.add_argument("repository_id")
    register.add_argument("manifest", type=Path)
    register.add_argument("acceptance", type=Path)
    profile = commands.add_parser("register-profile", help="Register a separately accepted discovery profile")
    profile.add_argument("repository_id")
    profile.add_argument("inventory_id")
    profile.add_argument("profile", type=Path)
    profile.add_argument("acceptance", type=Path)
    create = commands.add_parser("create-account", help="Provision an individually named account; password is prompted")
    create.add_argument("login")
    create.add_argument("display_name")
    repository = commands.add_parser("create-repository", help="Register identity only; acquires no files")
    repository.add_argument("name")
    grant = commands.add_parser("grant")
    grant.add_argument("login")
    grant.add_argument("repository_id")
    grant.add_argument("role", choices=["viewer", "reviewer", "none"])
    disable = commands.add_parser("disable-account")
    disable.add_argument("login")
    reset = commands.add_parser("reset-password")
    reset.add_argument("login")
    args = parser.parse_args()
    engine = make_engine(Settings.from_env().database_url)
    if args.command == "init-db":
        initialize(engine)
        print("Initial schema is present. No records were removed.")
        return
    if args.command == "worker-once":
        from .worker import worker_once
        print("Processed one operation." if worker_once(session_factory(engine)) else "No eligible work was published.")
        return
    password_hash = None
    if args.command in {"create-account", "reset-password"}:
        password = getpass.getpass("New password (12–128 characters): ")
        if not 12 <= len(password) <= 128 or password != getpass.getpass("Repeat password: "):
            parser.error("Passwords must match and contain 12–128 characters")
        password_hash = passwords.hash(password)
    with session_factory(engine).begin() as db:
        if args.command == "create-account":
            normalized = args.login.strip().casefold()
            if not 1 <= len(normalized) <= 120 or not args.display_name.strip() or len(args.display_name) > 200:
                parser.error("Invalid login or display name")
            if db.scalar(select(Account).where(Account.login == normalized)):
                parser.error("Account already exists")
            actor = Account(login=normalized, display_name=args.display_name, password_hash=password_hash)
            db.add(actor)
            db.flush()
            db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action="create_account", outcome="success"))
            print("Created account", actor.id)
        elif args.command == "create-repository":
            if not args.name.strip() or len(args.name) > 200:
                parser.error("Repository name must contain 1–200 characters")
            repository = Repository(name=args.name)
            db.add(repository)
            db.flush()
            print("Created repository identity", repository.id)
        elif args.command in {"register-input", "register-profile"}:
            from .pipeline import register_input, register_profile
            if not db.get(Repository, args.repository_id):
                parser.error("Repository not found")
            if args.command == "register-input":
                registered = register_input(db, args.repository_id, args.manifest, args.acceptance)
            else:
                registered = register_profile(db, args.repository_id, args.inventory_id, args.profile, args.acceptance)
            db.add(SecurityAudit(subject_actor_id=None, recorded_at=utc(), action=args.command.replace("-", "_"), outcome="success"))
            print("Registered", registered.id)
        else:
            actor = db.scalar(select(Account).where(Account.login == args.login.strip().casefold()).with_for_update())
            if actor is None:
                parser.error("Account not found")
            if args.command == "grant":
                if not db.get(Repository, args.repository_id):
                    parser.error("Repository not found")
                grant = db.scalar(select(Grant).where(Grant.actor_id == actor.id, Grant.repository_id == args.repository_id).with_for_update())
                if grant:
                    if args.role == "none":
                        db.delete(grant)
                    else:
                        grant.role = args.role
                elif args.role != "none":
                    db.add(Grant(actor_id=actor.id, repository_id=args.repository_id, role=args.role))
            else:
                actor.credential_version += 1
                if args.command == "disable-account":
                    actor.enabled = False
                else:
                    actor.password_hash = password_hash
                for session in db.scalars(select(Session).where(Session.actor_id == actor.id).with_for_update()):
                    session.revoked = True
            db.add(SecurityAudit(subject_actor_id=actor.id, recorded_at=utc(), action=args.command.replace("-", "_"), outcome="success"))
            print("Updated", args.command)


if __name__ == "__main__":
    main()
