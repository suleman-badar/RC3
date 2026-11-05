import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

from .config import settings
from .db import ensure_indexes, get_db
from .routers import analytics, applications, auth, interviews, jobs, notifications, profile, search

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("evident")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        ensure_indexes(get_db())
        log.info("MongoDB indexes ensured")
    except PyMongoError as exc:
        log.error("MongoDB not reachable at startup: %s", exc)
    yield


app = FastAPI(title="Evident API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, jobs, profile, applications, interviews, analytics, search, notifications):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health")
def health():
    try:
        get_db().command("ping")
        db_state = "ok"
    except Exception:
        db_state = "down"
    return {
        "status": "ok", "db": db_state,
        "ai_provider": settings.AI_PROVIDER,
        "ai_configured": bool(settings.generation_api_key.strip() and settings.GEMINI_API_KEY.strip()),
    }


@app.exception_handler(ServerSelectionTimeoutError)
async def db_down(request: Request, exc: ServerSelectionTimeoutError):
    return JSONResponse(status_code=503, content={"detail": "Database unavailable. Please try again shortly."})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
