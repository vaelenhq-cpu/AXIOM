from workers import WorkerEntrypoint
from fastapi import FastAPI, Request
import asgi


app = FastAPI(
    title="AXIOM Cloudflare API PoC",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {
        "service": "AXIOM API",
        "runtime": "Cloudflare Python Worker",
        "status": "ok",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
    }


@app.get("/environment")
async def environment(
    request: Request,
):
    env = request.scope["env"]

    return {
        "environment":
            getattr(
                env,
                "AXIOM_ENV",
                "unknown",
            ),
    }


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await asgi.fetch(
            app,
            request,
            self.env,
        )
