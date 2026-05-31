"""Structured OCR error codes and exception class."""

from enum import Enum


class OcrErrorCode(str, Enum):
    FILE_NOT_FOUND = "OCR_FILE_NOT_FOUND"
    UNSUPPORTED_FILE_TYPE = "OCR_UNSUPPORTED_FILE_TYPE"
    ENGINE_INIT_FAILED = "OCR_ENGINE_INIT_FAILED"
    TIMEOUT = "OCR_TIMEOUT"
    EMPTY_RESULT = "OCR_EMPTY_RESULT"
    VL_NOT_IMPLEMENTED = "OCR_VL_NOT_IMPLEMENTED"


class OcrError(Exception):
    """Structured OCR exception with an error code."""

    def __init__(self, code: OcrErrorCode, detail: str):
        self.code = code
        self.detail = detail
        super().__init__(f"[{code.value}] {detail}")
