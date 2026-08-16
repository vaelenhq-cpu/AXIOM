#!/usr/bin/env python3

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"

sys.path.insert(
    0,
    str(BACKEND),
)

from app.workers.outbox import OutboxWorker
from app.workers.webhooks import WebhookWorker


def main():
    outbox = OutboxWorker().run_all()

    webhooks = WebhookWorker().run_once()

    print(
        json.dumps(
            {
                "outbox": outbox,
                "webhooks": webhooks,
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
