"""Tests for OCR service: engine modes, error codes, response schema."""

import os
import pytest
from unittest.mock import patch, MagicMock

from app.schemas import OcrScanResponse, OcrLine, OcrLineBox
from app.core.errors import OcrError, OcrErrorCode


# ── Fixtures ──────────────────────────────────────────────────────────

FIXTURE_LINES_ARABIC = [
    {"text": "فاتورة# 101347", "confidence": 0.95, "box": {"x1": 10, "y1": 10, "x2": 200, "y2": 30}},
    {"text": "باباكا تشوكلت", "confidence": 0.92, "box": {"x1": 10, "y1": 40, "x2": 200, "y2": 60}},
    {"text": "SAR 17.00", "confidence": 0.98, "box": {"x1": 220, "y1": 40, "x2": 300, "y2": 60}},
    {"text": "المجموع الفرعي SAR 86.96", "confidence": 0.96, "box": {"x1": 10, "y1": 200, "x2": 300, "y2": 220}},
]

FIXTURE_LINES_ENGLISH = [
    {"text": "Invoice #INV-2024-001", "confidence": 0.97, "box": {"x1": 10, "y1": 10, "x2": 300, "y2": 30}},
    {"text": "1 Widget SAR 25.00", "confidence": 0.95, "box": {"x1": 10, "y1": 50, "x2": 300, "y2": 70}},
    {"text": "Subtotal SAR 25.00", "confidence": 0.98, "box": {"x1": 10, "y1": 100, "x2": 300, "y2": 120}},
]


def _make_paddle_v2_result(fixture_lines):
    """Build a PaddleOCR v2.x style result from fixture data."""
    page = []
    for fl in fixture_lines:
        box = fl["box"]
        coords = [
            [box["x1"], box["y1"]],
            [box["x2"], box["y1"]],
            [box["x2"], box["y2"]],
            [box["x1"], box["y2"]],
        ]
        page.append([coords, (fl["text"], fl["confidence"])])
    return [page]


def _make_paddle_v3_result(fixture_lines):
    """Build a PaddleOCR v3.x style result from fixture data."""
    return {
        "rec_texts": [fl["text"] for fl in fixture_lines],
        "rec_scores": [fl["confidence"] for fl in fixture_lines],
        "dt_polys": [
            [
                [fl["box"]["x1"], fl["box"]["y1"]],
                [fl["box"]["x2"], fl["box"]["y1"]],
                [fl["box"]["x2"], fl["box"]["y2"]],
                [fl["box"]["x1"], fl["box"]["y2"]],
            ]
            for fl in fixture_lines
        ],
    }


# ── Helper to reset cached engines between tests ──────────────────────

@pytest.fixture(autouse=True)
def reset_engines():
    """Reset cached OCR engines between tests."""
    import app.services.ocr_service as svc
    svc._ocr_engine = None
    svc._enhanced_engine = None
    yield
    svc._ocr_engine = None
    svc._enhanced_engine = None


# ── Tests: error codes ────────────────────────────────────────────────

class TestErrorCodes:
    def test_file_not_found(self, tmp_path):
        from app.services.ocr_service import run_ocr
        with pytest.raises(OcrError) as exc_info:
            run_ocr(str(tmp_path / "nonexistent.png"))
        assert exc_info.value.code == OcrErrorCode.FILE_NOT_FOUND

    def test_unsupported_file_type(self, tmp_path):
        from app.services.ocr_service import run_ocr
        bad_file = tmp_path / "test.exe"
        bad_file.write_text("not an image")
        with pytest.raises(OcrError) as exc_info:
            run_ocr(str(bad_file))
        assert exc_info.value.code == OcrErrorCode.UNSUPPORTED_FILE_TYPE

    def test_vl_mode_not_implemented(self, tmp_path):
        from app.services.ocr_service import run_ocr
        img_file = tmp_path / "test.png"
        img_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
        with pytest.raises(OcrError) as exc_info:
            run_ocr(str(img_file), mode="vl")
        assert exc_info.value.code == OcrErrorCode.VL_NOT_IMPLEMENTED


# ── Tests: engine mode routing ────────────────────────────────────────

class TestEngineModes:
    @patch("app.services.ocr_service._preprocess_image_file", side_effect=lambda f: f)
    @patch("app.services.ocr_service._get_engine")
    def test_ppocrv5_mode(self, mock_get_engine, mock_preprocess, tmp_path):
        mock_engine = MagicMock()
        mock_engine.ocr.return_value = _make_paddle_v2_result(FIXTURE_LINES_ARABIC)
        mock_get_engine.return_value = mock_engine

        img_file = tmp_path / "test.png"
        img_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

        from app.services.ocr_service import run_ocr
        result = run_ocr(str(img_file), mode="ppocrv5")

        assert result.engine == "paddleocr-ppocrv5"
        assert len(result.lines) == len(FIXTURE_LINES_ARABIC)
        assert result.usedEnhancedFallback is False
        mock_get_engine.assert_called()

    @patch("app.services.ocr_service._preprocess_image_file", side_effect=lambda f: f)
    @patch("app.services.ocr_service._get_engine")
    def test_hybrid_mode_default(self, mock_get_engine, mock_preprocess, tmp_path):
        mock_engine = MagicMock()
        mock_engine.ocr.return_value = _make_paddle_v2_result(FIXTURE_LINES_ENGLISH)
        mock_get_engine.return_value = mock_engine

        img_file = tmp_path / "test.jpg"
        img_file.write_bytes(b"\xff\xd8\xff" + b"\x00" * 100)

        from app.services.ocr_service import run_ocr
        result = run_ocr(str(img_file), mode="hybrid")

        assert result.engine == "paddleocr-ppocrv5"
        assert len(result.lines) == len(FIXTURE_LINES_ENGLISH)


# ── Tests: response schema ────────────────────────────────────────────

class TestResponseSchema:
    @patch("app.services.ocr_service._preprocess_image_file", side_effect=lambda f: f)
    @patch("app.services.ocr_service._get_engine")
    def test_response_has_all_fields(self, mock_get_engine, mock_preprocess, tmp_path):
        mock_engine = MagicMock()
        mock_engine.ocr.return_value = _make_paddle_v2_result(FIXTURE_LINES_ARABIC)
        mock_get_engine.return_value = mock_engine

        img_file = tmp_path / "test.png"
        img_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

        from app.services.ocr_service import run_ocr
        result = run_ocr(str(img_file), mode="ppocrv5")

        assert isinstance(result, OcrScanResponse)
        assert result.engine is not None
        assert result.rawText is not None
        assert isinstance(result.confidence, float)
        assert isinstance(result.pages, list)
        assert len(result.pages) == 1
        assert isinstance(result.lines, list)
        assert isinstance(result.warnings, list)
        assert isinstance(result.timings, dict)
        assert result.usedEnhancedFallback is False
        assert "total_ms" in result.timings

    @patch("app.services.ocr_service._preprocess_image_file", side_effect=lambda f: f)
    @patch("app.services.ocr_service._get_engine")
    def test_page_structure(self, mock_get_engine, mock_preprocess, tmp_path):
        mock_engine = MagicMock()
        mock_engine.ocr.return_value = _make_paddle_v3_result(FIXTURE_LINES_ARABIC)
        mock_get_engine.return_value = mock_engine

        img_file = tmp_path / "test.png"
        img_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

        from app.services.ocr_service import run_ocr
        result = run_ocr(str(img_file), mode="ppocrv5")

        assert len(result.pages) == 1
        page = result.pages[0]
        assert page.pageNumber == 1
        assert len(page.lines) == len(FIXTURE_LINES_ARABIC)
        assert page.rawText != ""
        assert page.confidence > 0

    @patch("app.services.ocr_service._preprocess_image_file", side_effect=lambda f: f)
    @patch("app.services.ocr_service._get_engine")
    def test_empty_result_warning(self, mock_get_engine, mock_preprocess, tmp_path):
        mock_engine = MagicMock()
        mock_engine.ocr.return_value = None
        mock_get_engine.return_value = mock_engine

        img_file = tmp_path / "test.png"
        img_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

        from app.services.ocr_service import run_ocr
        result = run_ocr(str(img_file), mode="ppocrv5")

        assert result.confidence == 0.0
        assert len(result.lines) == 0
        assert "OCR produced no text lines" in result.warnings


# ── Tests: QR/ZATCA parsing ───────────────────────────────────────────

class TestZatcaParsing:
    def test_parse_zatca_tlv(self):
        from app.services.qr_service import _parse_zatca_tlv
        import base64

        # Build a minimal TLV: tag=1 len=4 "Test", tag=2 len=15 "310227420600003"
        tlv = bytes([1, 4]) + b"Test" + bytes([2, 15]) + b"310227420600003"
        b64 = base64.b64encode(tlv).decode()

        result = _parse_zatca_tlv(b64)
        assert result is not None
        assert result.sellerName == "Test"
        assert result.vatNumber == "310227420600003"

    def test_parse_non_zatca_returns_none(self):
        from app.services.qr_service import _parse_zatca_tlv
        result = _parse_zatca_tlv("not-base64!!")
        assert result is None


# ── Tests: error code enum values ─────────────────────────────────────

class TestErrorCodeValues:
    def test_all_codes_have_correct_prefix(self):
        for code in OcrErrorCode:
            assert code.value.startswith("OCR_")

    def test_error_message_format(self):
        err = OcrError(OcrErrorCode.FILE_NOT_FOUND, "test.png missing")
        assert "[OCR_FILE_NOT_FOUND]" in str(err)
        assert "test.png missing" in str(err)
