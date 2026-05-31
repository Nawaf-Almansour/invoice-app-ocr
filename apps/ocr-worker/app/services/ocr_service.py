import os
import time
import logging
from typing import List, Optional

from app.schemas import OcrLine, OcrLineBox, OcrPage, OcrScanResponse
from app.core.config import settings
from app.core.errors import OcrError, OcrErrorCode

logger = logging.getLogger(__name__)

_ocr_engine = None
_enhanced_engine = None


def _get_engine():
    """Get or lazily initialize the standard PaddleOCR engine."""
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            _ocr_engine = PaddleOCR(
                lang="ar",
            )
            logger.info("PaddleOCR ppocrv5 engine initialized")
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            raise OcrError(OcrErrorCode.ENGINE_INIT_FAILED, str(e))
    return _ocr_engine


def _get_enhanced_engine():
    """Get or lazily initialize the enhanced PaddleOCR engine (orientation cls)."""
    global _enhanced_engine
    if _enhanced_engine is None:
        try:
            from paddleocr import PaddleOCR
            _enhanced_engine = PaddleOCR(
                lang="ar",
                use_doc_orientation_cls=True,
            )
            logger.info("PaddleOCR enhanced engine initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize enhanced PaddleOCR: {e}")
            raise OcrError(OcrErrorCode.ENGINE_INIT_FAILED, str(e))
    return _enhanced_engine


def _get_engine_version() -> Optional[str]:
    """Return PaddleOCR package version if available."""
    try:
        import paddleocr
        return getattr(paddleocr, "__version__", None)
    except ImportError:
        return None


def _resolve_path(file_path: str) -> str:
    if os.path.isabs(file_path):
        return file_path
    return os.path.join(settings.UPLOAD_DIR, os.path.basename(file_path))


def _validate_file(resolved: str) -> None:
    """Validate file exists and has an allowed extension."""
    if not os.path.exists(resolved):
        raise OcrError(OcrErrorCode.FILE_NOT_FOUND, f"Invoice file not found: {resolved}")
    ext = os.path.splitext(resolved)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise OcrError(
            OcrErrorCode.UNSUPPORTED_FILE_TYPE,
            f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(settings.ALLOWED_EXTENSIONS))}",
        )


def _parse_v3_page(page_dict: dict, lines: List[OcrLine]):
    """Parse PaddleOCR v3.x page result (dict with rec_texts, rec_scores, dt_polys)."""
    texts = page_dict.get('rec_texts', [])
    scores = page_dict.get('rec_scores', [])
    polys = page_dict.get('dt_polys', [])
    for i, text in enumerate(texts):
        conf = float(scores[i]) if i < len(scores) else 0.0
        if i < len(polys):
            poly = polys[i]
            x_coords = [float(pt[0]) for pt in poly]
            y_coords = [float(pt[1]) for pt in poly]
            box = OcrLineBox(
                x1=min(x_coords),
                y1=min(y_coords),
                x2=max(x_coords),
                y2=max(y_coords),
            )
        else:
            box = OcrLineBox(x1=0, y1=i * 30, x2=500, y2=i * 30 + 25)
        lines.append(OcrLine(text=str(text), confidence=conf, box=box))


def _paddle_result_to_lines(result) -> List[OcrLine]:
    lines: List[OcrLine] = []
    if not result:
        return lines

    logger.info(f"OCR result type: {type(result).__name__}")

    # PaddleOCR v3.x returns a single dict or a list of dicts (one per page)
    if isinstance(result, dict):
        _parse_v3_page(result, lines)
    elif isinstance(result, list):
        if len(result) > 0 and isinstance(result[0], dict):
            # v3.x: list of page dicts
            for page_dict in result:
                _parse_v3_page(page_dict, lines)
        elif len(result) > 0 and isinstance(result[0], list):
            # Legacy v2.x: list of pages, each page is list of [box, (text, conf)]
            page = result[0]
            for item in page:
                box_coords, (text, confidence) = item
                x_coords = [pt[0] for pt in box_coords]
                y_coords = [pt[1] for pt in box_coords]
                box = OcrLineBox(
                    x1=min(x_coords),
                    y1=min(y_coords),
                    x2=max(x_coords),
                    y2=max(y_coords),
                )
                lines.append(OcrLine(text=text, confidence=float(confidence), box=box))
    else:
        logger.warning(f"Unexpected OCR result type: {type(result)}")

    logger.info(f"Parsed {len(lines)} OCR lines")
    return lines


def _preprocess_image_file(file_path: str) -> str:
    """Apply preprocessing pipeline and save to a temp file. Returns the preprocessed path."""
    try:
        from PIL import Image
        from app.services.preprocessing import preprocess_image
        import tempfile

        img = Image.open(file_path)
        processed = preprocess_image(img)
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        processed.save(tmp.name, "PNG")
        return tmp.name
    except Exception as e:
        logger.warning(f"Preprocessing failed, using original: {e}")
        return file_path


def _run_engine_on_image(resolved: str, use_enhanced: bool = False) -> List[OcrLine]:
    """Run OCR engine on a single image file (with preprocessing) and return lines."""
    preprocessed = _preprocess_image_file(resolved)
    try:
        engine = _get_enhanced_engine() if use_enhanced else _get_engine()
        result = engine.ocr(preprocessed)
        return _paddle_result_to_lines(result)
    finally:
        if preprocessed != resolved:
            try:
                os.unlink(preprocessed)
            except OSError:
                pass


def _is_pdf(file_path: str) -> bool:
    return os.path.splitext(file_path)[1].lower() == ".pdf"


def _convert_pdf_to_images(pdf_path: str) -> List[str]:
    """Convert a PDF to a list of temporary image file paths (one per page)."""
    try:
        from pdf2image import convert_from_path
    except ImportError:
        raise OcrError(
            OcrErrorCode.ENGINE_INIT_FAILED,
            "pdf2image is not installed; cannot process PDF files",
        )

    import tempfile
    images = convert_from_path(pdf_path, dpi=300)
    paths: List[str] = []
    for i, img in enumerate(images):
        tmp = tempfile.NamedTemporaryFile(suffix=f"_page_{i}.png", delete=False)
        img.save(tmp.name, "PNG")
        paths.append(tmp.name)
    return paths


def _compute_avg_confidence(lines: List[OcrLine]) -> float:
    if not lines:
        return 0.0
    return sum(line.confidence for line in lines) / len(lines)


def run_ocr(
    file_path: str,
    mode: str = "hybrid",
    language_hints: Optional[List[str]] = None,
) -> OcrScanResponse:
    timings: dict = {}
    t_start = time.time()

    resolved = _resolve_path(file_path)
    _validate_file(resolved)

    effective_engine = settings.OCR_ENGINE
    if mode != "hybrid":
        effective_engine = mode

    logger.info(f"Running OCR on: {resolved} (mode={mode}, engine={effective_engine})")

    warnings: List[str] = []

    # ── VL mode: not implemented, return error ──
    if effective_engine == "vl":
        raise OcrError(
            OcrErrorCode.VL_NOT_IMPLEMENTED,
            "PaddleOCR-VL mode is not yet implemented. Use 'ppocrv5' or 'hybrid'.",
        )

    # ── PDF multi-page support ──
    pages: List[OcrPage] = []
    all_lines: List[OcrLine] = []

    if _is_pdf(resolved):
        t_pdf = time.time()
        image_paths = _convert_pdf_to_images(resolved)
        timings["pdf_conversion_ms"] = round((time.time() - t_pdf) * 1000, 1)

        for page_num, img_path in enumerate(image_paths, start=1):
            try:
                t_page = time.time()
                page_lines = _run_engine_on_image(img_path)
                timings[f"ocr_page_{page_num}_ms"] = round((time.time() - t_page) * 1000, 1)

                page_text = "\n".join(line.text for line in page_lines)
                page_conf = _compute_avg_confidence(page_lines)
                pages.append(OcrPage(
                    pageNumber=page_num,
                    lines=page_lines,
                    rawText=page_text,
                    confidence=round(page_conf, 4),
                ))
                all_lines.extend(page_lines)
            finally:
                try:
                    os.unlink(img_path)
                except OSError:
                    pass
    else:
        t_ocr = time.time()
        all_lines = _run_engine_on_image(resolved)
        timings["ocr_ms"] = round((time.time() - t_ocr) * 1000, 1)

        page_text = "\n".join(line.text for line in all_lines)
        page_conf = _compute_avg_confidence(all_lines)
        pages.append(OcrPage(
            pageNumber=1,
            lines=all_lines,
            rawText=page_text,
            confidence=round(page_conf, 4),
        ))

    raw_text = "\n".join(line.text for line in all_lines)
    avg_confidence = _compute_avg_confidence(all_lines)

    if not all_lines:
        warnings.append("OCR produced no text lines")

    # ── QR / ZATCA extraction ──
    qr_result = None
    if not _is_pdf(resolved):
        try:
            from app.services.qr_service import extract_qr
            t_qr = time.time()
            qr_result = extract_qr(resolved)
            timings["qr_ms"] = round((time.time() - t_qr) * 1000, 1)
        except Exception as exc:
            logger.warning(f"QR extraction failed: {exc}")
            warnings.append(f"QR extraction failed: {exc}")

    # ── Hybrid fallback: try enhanced engine if confidence is low ──
    used_enhanced = False
    threshold = settings.OCR_MIN_CONFIDENCE
    if (
        effective_engine in ("hybrid", "ppocrv5")
        and settings.ENABLE_ENHANCED_FALLBACK
        and avg_confidence < threshold
        and all_lines
    ):
        logger.warning(
            f"Low confidence ({avg_confidence:.2f} < {threshold}), attempting enhanced fallback"
        )
        try:
            t_enhanced = time.time()
            if _is_pdf(resolved):
                enhanced_lines: List[OcrLine] = []
                image_paths = _convert_pdf_to_images(resolved)
                for img_path in image_paths:
                    try:
                        enhanced_lines.extend(_run_engine_on_image(img_path, use_enhanced=True))
                    finally:
                        try:
                            os.unlink(img_path)
                        except OSError:
                            pass
            else:
                enhanced_lines = _run_engine_on_image(resolved, use_enhanced=True)

            timings["enhanced_fallback_ms"] = round((time.time() - t_enhanced) * 1000, 1)

            enhanced_conf = _compute_avg_confidence(enhanced_lines)
            if enhanced_conf > avg_confidence and enhanced_lines:
                all_lines = enhanced_lines
                raw_text = "\n".join(line.text for line in all_lines)
                avg_confidence = enhanced_conf
                used_enhanced = True
                # Rebuild pages with enhanced results
                pages = [OcrPage(
                    pageNumber=1,
                    lines=all_lines,
                    rawText=raw_text,
                    confidence=round(avg_confidence, 4),
                )]
            else:
                warnings.append(
                    f"Enhanced fallback did not improve confidence ({enhanced_conf:.2f} vs {avg_confidence:.2f})"
                )
        except OcrError:
            warnings.append("Enhanced OCR engine unavailable for fallback")
        except Exception as exc:
            logger.warning(f"Enhanced fallback failed: {exc}")
            warnings.append(f"Enhanced fallback failed: {exc}")

    markdown = _build_markdown(all_lines)

    timings["total_ms"] = round((time.time() - t_start) * 1000, 1)

    engine_label = "paddleocr-enhanced" if used_enhanced else "paddleocr-ppocrv5"

    return OcrScanResponse(
        engine=engine_label,
        engineVersion=_get_engine_version(),
        rawText=raw_text,
        confidence=round(avg_confidence, 4),
        pages=pages,
        lines=all_lines,
        qr=qr_result,
        markdown=markdown,
        documentJson=None,
        usedEnhancedFallback=used_enhanced,
        warnings=warnings,
        timings=timings,
    )


def _build_markdown(lines: List[OcrLine]) -> str:
    if not lines:
        return ""
    sorted_lines = sorted(lines, key=lambda l: l.box.y1)
    return "\n".join(f"{line.text}" for line in sorted_lines)
