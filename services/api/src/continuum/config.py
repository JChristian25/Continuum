from dataclasses import dataclass
import os
from pathlib import Path
from urllib.parse import urlsplit


def _local_env():
    env_path = Path(__file__).resolve().parents[2] / ".env"
    values = {}
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8-sig").splitlines():
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value
    return values


def env_value(key: str, default: str | None = None) -> str | None:
    value = os.getenv(key)
    if value is not None:
        return value
    return _local_env().get(key, default)


@dataclass(frozen=True)
class Settings:
    database_url: str
    origin: str = "https://localhost:8443"
    local_http: bool = False
    redis_url: str = "redis://127.0.0.1:56379/0"
    neo4j_uri: str = "bolt://127.0.0.1:57687"
    neo4j_user: str = "neo4j"
    neo4j_password: str | None = None
    neo4j_database: str = "neo4j"
    allow_custom_workspaces: bool = False
    allow_local_git: bool = False
    local_git_roots: tuple[str, ...] = ()
    custom_inputs_root: str | None = None

    def __post_init__(self):
        parsed = urlsplit(self.origin)
        if parsed.path or parsed.query or parsed.fragment or parsed.username:
            raise ValueError("Origin must contain only scheme, host and optional port")
        if parsed.scheme != "https" and not (
            self.local_http and parsed.scheme == "http"
            and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        ):
            raise ValueError("HTTPS required; HTTP development must explicitly use loopback")
        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("Continuum requires PostgreSQL via psycopg")

    @property
    def session_cookie(self):
        return "continuum_dev_session" if self.local_http else "__Host-continuum_session"

    @property
    def pre_cookie(self):
        return "continuum_dev_pre" if self.local_http else "__Host-continuum_pre"

    @classmethod
    def from_env(cls):
        local_http = os.getenv("CONTINUUM_LOCAL_HTTP") == "1"
        raw_custom = env_value("CONTINUUM_ALLOW_CUSTOM_WORKSPACES")
        allow_custom = (raw_custom == "1") if raw_custom is not None else local_http
        allow_git = env_value("CONTINUUM_ALLOW_LOCAL_GIT", "0") == "1"
        raw_roots = env_value("CONTINUUM_LOCAL_GIT_ROOTS", "") or ""
        git_roots = tuple(part.strip() for part in raw_roots.split(os.pathsep) if part.strip())
        return cls(
            database_url=os.environ["CONTINUUM_DATABASE_URL"],
            origin=os.getenv("CONTINUUM_ORIGIN", "https://localhost:8443"),
            local_http=local_http,
            redis_url=env_value("CONTINUUM_REDIS_URL", "redis://127.0.0.1:56379/0") or "redis://127.0.0.1:56379/0",
            neo4j_uri=env_value("CONTINUUM_NEO4J_URI", "bolt://127.0.0.1:57687") or "bolt://127.0.0.1:57687",
            neo4j_user=env_value("CONTINUUM_NEO4J_USER", "neo4j") or "neo4j",
            neo4j_password=env_value("CONTINUUM_NEO4J_PASSWORD") or env_value("POSTGRES_PASSWORD"),
            neo4j_database=env_value("CONTINUUM_NEO4J_DATABASE", "neo4j") or "neo4j",
            allow_custom_workspaces=allow_custom,
            allow_local_git=allow_git,
            local_git_roots=git_roots,
            custom_inputs_root=env_value("CONTINUUM_CUSTOM_INPUTS_ROOT") or None,
        )
