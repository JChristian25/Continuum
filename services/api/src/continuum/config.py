from dataclasses import dataclass
import os
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    database_url: str
    origin: str = "https://localhost:8443"
    local_http: bool = False

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
        return cls(
            database_url=os.environ["CONTINUUM_DATABASE_URL"],
            origin=os.getenv("CONTINUUM_ORIGIN", "https://localhost:8443"),
            local_http=os.getenv("CONTINUUM_LOCAL_HTTP") == "1",
        )
