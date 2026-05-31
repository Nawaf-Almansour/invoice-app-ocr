"""Image preprocessing pipeline for OCR quality improvement."""

import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def correct_orientation(img: Image.Image) -> Image.Image:
    """Auto-rotate based on EXIF orientation tag."""
    try:
        from PIL import ExifTags

        exif = img.getexif()
        if not exif:
            return img

        orientation_key = None
        for key, val in ExifTags.TAGS.items():
            if val == "Orientation":
                orientation_key = key
                break

        if orientation_key is None or orientation_key not in exif:
            return img

        orientation = exif[orientation_key]
        rotations = {
            3: 180,
            6: 270,
            8: 90,
        }
        if orientation in rotations:
            img = img.rotate(rotations[orientation], expand=True)
            logger.info(f"Corrected orientation: rotated {rotations[orientation]}°")
    except Exception as e:
        logger.warning(f"Orientation correction failed: {e}")
    return img


def deskew(img: Image.Image) -> Image.Image:
    """Deskew a tilted document image using Hough line detection."""
    try:
        import cv2

        gray = np.array(img.convert("L"))
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=100, maxLineGap=10)

        if lines is None or len(lines) == 0:
            return img

        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            if abs(angle) < 15:
                angles.append(angle)

        if not angles:
            return img

        median_angle = float(np.median(angles))
        if abs(median_angle) < 0.3:
            return img

        logger.info(f"Deskew: rotating {median_angle:.2f}°")
        img = img.rotate(median_angle, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
    except ImportError:
        logger.warning("cv2 not available, skipping deskew")
    except Exception as e:
        logger.warning(f"Deskew failed: {e}")
    return img


def denoise(img: Image.Image) -> Image.Image:
    """Apply light denoising using non-local means."""
    try:
        import cv2

        arr = np.array(img)
        if len(arr.shape) == 2:
            denoised = cv2.fastNlMeansDenoising(arr, None, h=10, templateWindowSize=7, searchWindowSize=21)
        else:
            denoised = cv2.fastNlMeansDenoisingColored(arr, None, h=10, hForColorComponents=10, templateWindowSize=7, searchWindowSize=21)
        return Image.fromarray(denoised)
    except ImportError:
        logger.warning("cv2 not available, skipping denoise")
    except Exception as e:
        logger.warning(f"Denoise failed: {e}")
    return img


def enhance_contrast(img: Image.Image) -> Image.Image:
    """Apply CLAHE contrast enhancement."""
    try:
        import cv2

        gray = np.array(img.convert("L"))
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        return Image.fromarray(enhanced)
    except ImportError:
        logger.warning("cv2 not available, skipping contrast enhancement")
    except Exception as e:
        logger.warning(f"Contrast enhancement failed: {e}")
    return img


def resize_for_ocr(img: Image.Image, max_dimension: int = 4096) -> Image.Image:
    """Resize large images to a max dimension while preserving aspect ratio."""
    w, h = img.size
    if max(w, h) <= max_dimension:
        return img
    scale = max_dimension / max(w, h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    logger.info(f"Resizing from {w}x{h} to {new_w}x{new_h}")
    return img.resize((new_w, new_h), Image.LANCZOS)


def preprocess_image(img: Image.Image) -> Image.Image:
    """Run the full preprocessing pipeline on a PIL Image."""
    img = correct_orientation(img)
    img = deskew(img)
    img = denoise(img)
    img = enhance_contrast(img)
    img = resize_for_ocr(img)
    return img
