from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class OcrLineBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class OcrLine(BaseModel):
    text: str
    confidence: float
    box: OcrLineBox


class OcrPage(BaseModel):
    pageNumber: int
    lines: List[OcrLine] = []
    rawText: str = ""
    confidence: float = 0.0


class ZatcaFields(BaseModel):
    sellerName: Optional[str] = None
    vatNumber: Optional[str] = None
    timestamp: Optional[str] = None
    total: Optional[str] = None
    vatAmount: Optional[str] = None


class QrResult(BaseModel):
    rawText: str
    zatca: Optional[ZatcaFields] = None


class OcrScanRequest(BaseModel):
    invoiceUploadId: str
    filePath: str
    mode: str = "hybrid"
    languageHints: Optional[List[str]] = None


class OcrScanResponse(BaseModel):
    engine: str
    engineVersion: Optional[str] = None
    rawText: str
    confidence: float
    pages: List[OcrPage] = []
    lines: List[OcrLine] = []
    qr: Optional[QrResult] = None
    markdown: Optional[str] = None
    documentJson: Optional[Dict[str, Any]] = None
    usedEnhancedFallback: bool = False
    warnings: List[str] = []
    timings: Dict[str, float] = {}
