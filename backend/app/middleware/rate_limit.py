import threading
import time
from collections import defaultdict, deque

from starlette.middleware.base import (
    BaseHTTPMiddleware,
)
from starlette.responses import JSONResponse


class RateLimitMiddleware(
    BaseHTTPMiddleware
):
    def __init__(self, app):
        super().__init__(app)

        self.lock = threading.Lock()

        self.events = defaultdict(deque)

        self.rules = {
            "/api/auth/login": (
                10,
                60,
            ),
            "/driver/auth/login": (
                10,
                60,
            ),
            "/public/booking": (
                30,
                60,
            ),
        }

    async def dispatch(
        self,
        request,
        call_next,
    ):
        path = request.url.path

        rule = self.rules.get(path)

        if (
            rule is None
            or request.method != "POST"
        ):
            return await call_next(
                request
            )

        limit, window = rule

        client_ip = (
            request.client.host
            if request.client
            else "unknown"
        )

        key = (
            client_ip,
            path,
        )

        now = time.monotonic()

        with self.lock:
            queue = self.events[key]

            while (
                queue
                and queue[0]
                <= now - window
            ):
                queue.popleft()

            if len(queue) >= limit:
                retry_after = max(
                    1,
                    int(
                        window
                        - (
                            now
                            - queue[0]
                        )
                    ),
                )

                return JSONResponse(
                    status_code=429,
                    content={
                        "success": False,
                        "error":
                            "rate_limit_exceeded",
                        "message":
                            "Too many requests",
                    },
                    headers={
                        "Retry-After":
                            str(retry_after)
                    },
                )

            queue.append(now)

        return await call_next(
            request
        )
