import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routers import ocr
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="Invoice OCR Worker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr.router, prefix="/api/v1")


@app.get("/health")
def health():
    version = None
    try:
        import paddleocr
        version = getattr(paddleocr, "__version__", None)
    except ImportError:
        pass
    return {
        "status": "ok",
        "service": "ocr-worker",
        "engine": "paddleocr",
        "engineVersion": version,
    }


@app.get("/readiness")
def readiness():
    try:
        from app.services.ocr_service import _get_engine
        _get_engine()
        return {"status": "ready"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "error": str(e)},
        )
