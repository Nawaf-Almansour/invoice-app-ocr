import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.schemas import OcrScanRequest, OcrScanResponse
from app.services.ocr_service import run_ocr
from app.core.errors import OcrError, OcrErrorCode

router = APIRouter(prefix="/ocr", tags=["OCR"])
logger = logging.getLogger(__name__)

_ERROR_STATUS_MAP = {
    OcrErrorCode.FILE_NOT_FOUND: 404,
    OcrErrorCode.UNSUPPORTED_FILE_TYPE: 400,
    OcrErrorCode.ENGINE_INIT_FAILED: 503,
    OcrErrorCode.TIMEOUT: 504,
    OcrErrorCode.EMPTY_RESULT: 422,
    OcrErrorCode.VL_NOT_IMPLEMENTED: 501,
}


@router.post("/scan", response_model=OcrScanResponse)
async def scan_invoice(request: OcrScanRequest) -> OcrScanResponse:
    try:
        result = run_ocr(
            file_path=request.filePath,
            mode=request.mode,
            language_hints=request.languageHints,
        )
        return result
    except OcrError as e:
        status = _ERROR_STATUS_MAP.get(e.code, 500)
        logger.warning(f"OCR error [{e.code.value}] for upload {request.invoiceUploadId}: {e.detail}")
        return JSONResponse(
            status_code=status,
            content={"error": e.code.value, "detail": e.detail},
        )
    except Exception as e:
        logger.exception(f"OCR scan failed for upload {request.invoiceUploadId}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")
