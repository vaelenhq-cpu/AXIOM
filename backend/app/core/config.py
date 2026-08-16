from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[2]

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

DEFAULT_DATABASE_PATH = (
    DATA_DIR / "axiom_dev.db"
)


class Settings:
    APP_NAME = os.getenv(
        "AXIOM_APP_NAME",
        "AXIOM",
    )

    ENV = os.getenv(
        "AXIOM_ENV",
        "development",
    )

    DATABASE_PATH = Path(
        os.getenv(
            "AXIOM_DATABASE_PATH",
            str(DEFAULT_DATABASE_PATH),
        )
    )

    DEBUG = os.getenv(
        "AXIOM_DEBUG",
        (
            "1"
            if ENV == "development"
            else "0"
        ),
    ) == "1"

    CLOUDFLARE_OAUTH_CLIENT_ID = os.getenv(
        "AXIOM_CLOUDFLARE_OAUTH_CLIENT_ID",
        "",
    )

    CLOUDFLARE_OAUTH_CLIENT_SECRET = os.getenv(
        "AXIOM_CLOUDFLARE_OAUTH_CLIENT_SECRET",
        "",
    )

    CLOUDFLARE_OAUTH_REDIRECT_URI = os.getenv(
        "AXIOM_CLOUDFLARE_OAUTH_REDIRECT_URI",
        "",
    )

    CLOUDFLARE_OAUTH_SCOPES = os.getenv(
        "AXIOM_CLOUDFLARE_OAUTH_SCOPES",
        "",
    )


settings = Settings()


def get_cors_origins():
    raw = os.getenv(
        "AXIOM_CORS_ORIGINS",
        (
            "http://localhost:5173,"
            "http://127.0.0.1:5173"
        ),
    )

    return [
        value.strip()
        for value in raw.split(",")
        if value.strip()
    ]
