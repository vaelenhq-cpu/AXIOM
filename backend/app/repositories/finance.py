from typing import Any, Dict, List

from app.core.tenant import get_company_id

from .base import BaseRepository


class PaymentRepository(BaseRepository):
    table_name = "payments"


class FinanceTransactionRepository(BaseRepository):
    table_name = "finance_transactions"

    def list_recent(
        self,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:

        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM finance_transactions
                WHERE company_id = ?
                ORDER BY transaction_date DESC
                LIMIT ?
                """,
                (
                    get_company_id(),
                    limit,
                ),
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
