import sqlite3
from contextlib import contextmanager
from typing import Generator

from .config import settings


def create_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(
        settings.DATABASE_PATH,
        timeout=30,
        isolation_level=None,
        check_same_thread=False,
    )

    connection.row_factory = sqlite3.Row

    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    connection.execute("PRAGMA busy_timeout = 5000")

    return connection


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    connection = create_connection()

    try:
        yield connection
    finally:
        connection.close()
