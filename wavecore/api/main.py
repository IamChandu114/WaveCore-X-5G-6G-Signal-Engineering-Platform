import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from wavecore.api.routes import router


def create_app() -> FastAPI:
    app = FastAPI(
        title="WaveCore X API",
        version="0.1.0",
        description="Backend APIs for wireless communication simulation and engineering analytics.",
    )
    origins = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
    ]
    cors_env = os.getenv("CORS_ORIGINS")
    if cors_env:
        origins.extend([origin.strip().rstrip("/") for origin in cors_env.split(",") if origin.strip()])

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()
