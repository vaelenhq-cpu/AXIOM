import sqlite3
from contextlib import contextmanager
from typing import Generator

from .database import create_connection


@contextmanager
def transaction() -> Generator[sqlite3.Connection, None, None]:
    connection = create_connection()

    try:
        connection.execute("BEGIN")

        yield connection

        connection.execute("COMMIT")

    except Exception:
        try:
            connection.execute("ROLLBACK")
        finally:
            connection.close()

        raise

    else:
        connection.close()
