import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")
    OCR_USE_GPU: bool = os.getenv("OCR_USE_GPU", "false").lower() == "true"
    OCR_LANG: str = os.getenv("OCR_LANG", "arabic")
    OCR_ENGINE: str = os.getenv("OCR_ENGINE", "hybrid")  # ppocrv5 | hybrid | vl
    ENABLE_ENHANCED_FALLBACK: bool = os.getenv("ENABLE_ENHANCED_FALLBACK", "false").lower() == "true"
    OCR_MIN_CONFIDENCE: float = float(os.getenv("OCR_MIN_CONFIDENCE", "0.75"))
    OCR_ENHANCED_FALLBACK_CONFIDENCE: float = float(os.getenv("OCR_ENHANCED_FALLBACK_CONFIDENCE", "0.6"))
    OCR_TIMEOUT: int = int(os.getenv("OCR_TIMEOUT", "120"))
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/app/uploads")
    ALLOWED_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp", ".pdf"}


settings = Settings()
