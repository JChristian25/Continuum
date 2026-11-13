from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker


def make_engine(url, **kwargs):
    engine = create_engine(url, pool_pre_ping=True, **kwargs)

    @event.listens_for(engine, "connect")
    def configure(connection, _):
        with connection.cursor() as cursor:
            cursor.execute("SET lock_timeout = '5s'")
        connection.commit()

    return engine


def session_factory(engine):
    return sessionmaker(engine, expire_on_commit=False)


def initialize(engine):
    from .models import Base

    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE OR REPLACE FUNCTION continuum_immutable() RETURNS trigger
            LANGUAGE plpgsql AS $$ BEGIN
                RAISE EXCEPTION 'Continuum retained records are immutable';
            END $$
        """))
        for table in ("artifact_versions", "assertions", "assertion_revisions", "review_events", "receipts", "security_audit"):
            connection.execute(text(f"""
                CREATE OR REPLACE TRIGGER retained_record
                BEFORE UPDATE OR DELETE ON {table}
                FOR EACH ROW EXECUTE FUNCTION continuum_immutable()
            """))
