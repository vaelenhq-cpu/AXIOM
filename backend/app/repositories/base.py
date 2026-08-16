import sqlite3
from typing import Any, Dict, Iterable, List, Optional

from app.core.database import create_connection
from app.core.tenant import get_company_id


class BaseRepository:
    table_name: str = ""
    tenant_scoped: bool = True

    def __init__(self, connection: Optional[sqlite3.Connection] = None):
        if not self.table_name:
            raise RuntimeError("Repository table_name is not configured")

        self.connection = connection

    def _conn(self) -> tuple[sqlite3.Connection, bool]:
        if self.connection is not None:
            return self.connection, False

        return create_connection(), True

    def _close_if_owned(
        self,
        connection: sqlite3.Connection,
        owned: bool,
    ) -> None:
        if owned:
            connection.close()

    def get_by_id(self, entity_id: str) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            if self.tenant_scoped:
                row = connection.execute(
                    f"""
                    SELECT *
                    FROM {self.table_name}
                    WHERE id = ?
                      AND company_id = ?
                    LIMIT 1
                    """,
                    (
                        entity_id,
                        get_company_id(),
                    ),
                ).fetchone()
            else:
                row = connection.execute(
                    f"""
                    SELECT *
                    FROM {self.table_name}
                    WHERE id = ?
                    LIMIT 1
                    """,
                    (entity_id,),
                ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)

    def list(
        self,
        limit: int = 100,
        offset: int = 0,
        order_by: str = "created_at",
        descending: bool = True,
    ) -> List[Dict[str, Any]]:
        allowed_order_fields = {
            "id",
            "created_at",
            "updated_at",
        }

        if order_by not in allowed_order_fields:
            order_by = "created_at"

        direction = "DESC" if descending else "ASC"

        connection, owned = self._conn()

        try:
            if self.tenant_scoped:
                rows = connection.execute(
                    f"""
                    SELECT *
                    FROM {self.table_name}
                    WHERE company_id = ?
                    ORDER BY {order_by} {direction}
                    LIMIT ?
                    OFFSET ?
                    """,
                    (
                        get_company_id(),
                        limit,
                        offset,
                    ),
                ).fetchall()
            else:
                rows = connection.execute(
                    f"""
                    SELECT *
                    FROM {self.table_name}
                    ORDER BY {order_by} {direction}
                    LIMIT ?
                    OFFSET ?
                    """,
                    (
                        limit,
                        offset,
                    ),
                ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)

    def insert(self, data: Dict[str, Any]) -> Dict[str, Any]:
        payload = dict(data)

        if self.tenant_scoped:
            payload["company_id"] = get_company_id()

        columns = list(payload.keys())

        if not columns:
            raise ValueError("Insert payload cannot be empty")

        placeholders = ", ".join("?" for _ in columns)
        column_sql = ", ".join(columns)

        values = [payload[column] for column in columns]

        connection, owned = self._conn()

        try:
            connection.execute(
                f"""
                INSERT INTO {self.table_name}
                ({column_sql})
                VALUES ({placeholders})
                """,
                values,
            )

            if owned:
                connection.commit()

            entity_id = payload.get("id")

            if entity_id:
                result = self.get_by_id(entity_id)

                if result is None:
                    raise RuntimeError(
                        f"Inserted entity could not be reloaded: {entity_id}"
                    )

                return result

            return payload

        except Exception:
            if owned:
                connection.rollback()
            raise

        finally:
            self._close_if_owned(connection, owned)

    def update(
        self,
        entity_id: str,
        data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        payload = {
            key: value
            for key, value in data.items()
            if key not in {
                "id",
                "company_id",
                "created_at",
            }
        }

        if not payload:
            return self.get_by_id(entity_id)

        assignments = ", ".join(
            f"{column} = ?"
            for column in payload.keys()
        )

        values = list(payload.values())

        connection, owned = self._conn()

        try:
            if self.tenant_scoped:
                values.extend(
                    [
                        entity_id,
                        get_company_id(),
                    ]
                )

                cursor = connection.execute(
                    f"""
                    UPDATE {self.table_name}
                    SET {assignments}
                    WHERE id = ?
                      AND company_id = ?
                    """,
                    values,
                )
            else:
                values.append(entity_id)

                cursor = connection.execute(
                    f"""
                    UPDATE {self.table_name}
                    SET {assignments}
                    WHERE id = ?
                    """,
                    values,
                )

            if owned:
                connection.commit()

            if cursor.rowcount == 0:
                return None

            return self.get_by_id(entity_id)

        except Exception:
            if owned:
                connection.rollback()
            raise

        finally:
            self._close_if_owned(connection, owned)

    def delete(self, entity_id: str) -> bool:
        connection, owned = self._conn()

        try:
            if self.tenant_scoped:
                cursor = connection.execute(
                    f"""
                    DELETE FROM {self.table_name}
                    WHERE id = ?
                      AND company_id = ?
                    """,
                    (
                        entity_id,
                        get_company_id(),
                    ),
                )
            else:
                cursor = connection.execute(
                    f"""
                    DELETE FROM {self.table_name}
                    WHERE id = ?
                    """,
                    (entity_id,),
                )

            if owned:
                connection.commit()

            return cursor.rowcount > 0

        except Exception:
            if owned:
                connection.rollback()
            raise

        finally:
            self._close_if_owned(connection, owned)
