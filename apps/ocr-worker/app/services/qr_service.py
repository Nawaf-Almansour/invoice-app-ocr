"""QR code detection and ZATCA TLV parsing service."""

import base64
import logging
from typing import Optional

from PIL import Image

from app.schemas import QrResult, ZatcaFields

logger = logging.getLogger(__name__)


def _decode_qr_from_image(img: Image.Image) -> Optional[str]:
    """Detect and decode a QR code from a PIL Image using pyzbar."""
    try:
        from pyzbar.pyzbar import decode as zbar_decode

        results = zbar_decode(img)
        for result in results:
            if result.type in ("QRCODE", "QR_CODE"):
                return result.data.decode("utf-8", errors="replace")
    except ImportError:
        logger.warning("pyzbar not installed, skipping QR detection")
    except Exception as e:
        logger.warning(f"QR decode failed: {e}")
    return None


def _parse_zatca_tlv(raw_b64: str) -> Optional[ZatcaFields]:
    """
    Parse ZATCA Phase 2 TLV-encoded QR data.
    TLV tags:
      1 = Seller Name
      2 = VAT Registration Number
      3 = Timestamp (ISO 8601)
      4 = Invoice Total
      5 = VAT Amount
    """
    try:
        data = base64.b64decode(raw_b64)
    except Exception:
        return None

    fields: dict = {}
    i = 0
    while i < len(data) - 1:
        tag = data[i]
        length = data[i + 1]
        i += 2
        if i + length > len(data):
            break
        value = data[i : i + length].decode("utf-8", errors="replace")
        fields[tag] = value
        i += length

    if not fields:
        return None

    return ZatcaFields(
        sellerName=fields.get(1),
        vatNumber=fields.get(2),
        timestamp=fields.get(3),
        total=fields.get(4),
        vatAmount=fields.get(5),
    )


def extract_qr(file_path: str) -> Optional[QrResult]:
    """Extract QR code from an image file and attempt ZATCA TLV parsing."""
    try:
        img = Image.open(file_path)
    except Exception as e:
        logger.warning(f"Cannot open image for QR extraction: {e}")
        return None

    raw_text = _decode_qr_from_image(img)
    if not raw_text:
        return None

    zatca = _parse_zatca_tlv(raw_text)

    return QrResult(
        rawText=raw_text,
        zatca=zatca,
    )
