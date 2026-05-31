# Invoice App OCR

End-to-end invoice processing system that extracts structured data from Arabic/English invoice images and PDFs using PaddleOCR, with automated line-item extraction, ZATCA QR code parsing, and posting to inventory & accounting.

## Architecture

```
┌─────────┐     ┌──────────┐     ┌────────────┐
│  React   │────▶│ NestJS   │────▶│  OCR       │
│  Web UI  │◀────│ API      │◀────│  Worker    │
│ :5173    │     │ :3000    │     │  :8000     │
└─────────┘     └────┬─────┘     └────────────┘
                     │                PaddleOCR
               ┌─────┴─────┐         + QR/ZATCA
               │           │
          PostgreSQL    Redis
            :5432      :6379
                      (BullMQ)
```

| Service | Stack | Path |
|---------|-------|------|
| **API** | NestJS, TypeORM, BullMQ | `apps/api` |
| **OCR Worker** | FastAPI, PaddleOCR, OpenCV | `apps/ocr-worker` |
| **Web** | React, Vite, Tailwind CSS | `apps/web` |
| **Shared Types** | TypeScript DTOs & enums | `packages/shared-types` |

## Features

- **OCR Engine Modes** — `ppocrv5` (standard), `hybrid` (enhanced fallback on low confidence), `vl` (stub)
- **Image Preprocessing** — orientation correction, deskew, denoise, CLAHE contrast, resize
- **Multi-page PDF** — splits PDF pages into images, runs OCR per page, aggregates results
- **QR / ZATCA** — detects QR codes in invoices, parses ZATCA Phase 2 TLV fields (seller, VAT, total)
- **Line-item Extraction** — regex-based header + line-item extractors for Arabic/English invoices
- **Footer Protection** — regression-tested safeguards preventing subtotal/VAT/total lines from leaking into products
- **Inventory & Accounting Posting** — posts extracted invoice lines to inventory movements and journal entries
- **Review Workflow** — validation pipeline with `NEEDS_REVIEW` / `READY` status flow

## Quick Start

### Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| OCR Worker | http://localhost:8000 |

### Local Development

```bash
# Install dependencies
npm install

# Start API (NestJS)
npm run dev:api

# Start Web (Vite)
npm run dev:web

# Start OCR Worker (Python)
cd apps/ocr-worker
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Prerequisites**: Node.js 20+, Python 3.11+, PostgreSQL 16, Redis 7

## Environment Variables

See [`.env.example`](.env.example) for all variables. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis host for BullMQ |
| `OCR_ENGINE` | `hybrid` | OCR mode: `ppocrv5`, `hybrid`, `vl` |
| `ENABLE_ENHANCED_FALLBACK` | `false` | Re-run OCR with enhanced engine on low confidence |
| `DB_SYNC` | `true` | TypeORM synchronize (blocked in production) |
| `STORAGE_DRIVER` | `local` | Storage backend: `local` or `s3` |

## Database Migrations

```bash
cd apps/api

# Generate migration after entity changes
npm run migration:generate -- src/migrations/AddNewColumn

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

> **Note**: `DB_SYNC=true` is blocked when `NODE_ENV=production`. Use migrations instead.

## Testing

```bash
# API tests (56 tests including regression suite)
cd apps/api && npm test

# OCR Worker tests
cd apps/ocr-worker && python -m pytest tests/ -v
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/invoices/upload` | Upload invoice image/PDF |
| `GET` | `/api/v1/invoices` | List all invoices |
| `GET` | `/api/v1/invoices/:id` | Get invoice details |
| `GET` | `/api/v1/invoices/:id/status` | Get processing status |
| `PATCH` | `/api/v1/invoices/:id/review` | Submit review corrections |
| `GET` | `/health` (OCR Worker) | Engine health + version |
| `GET` | `/readiness` (OCR Worker) | Engine initialization check |

## Project Structure

```
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── src/
│   │   │   ├── config/       # Env validation, TypeORM CLI config
│   │   │   ├── common/       # Storage abstraction, enums
│   │   │   └── modules/
│   │   │       ├── invoice-uploads/      # File upload + BullMQ queue
│   │   │       ├── invoice-ocr/          # OCR job processor + worker client
│   │   │       ├── invoice-extraction/   # Header + line-item extractors
│   │   │       ├── invoice-validation/   # Cross-check validation
│   │   │       ├── invoice-review/       # Manual review workflow
│   │   │       ├── purchase-invoices/    # Final invoice records
│   │   │       ├── inventory-posting/    # Inventory movements
│   │   │       └── accounting-posting/   # Journal entries
│   │   └── migrations/
│   ├── ocr-worker/           # Python FastAPI OCR service
│   │   ├── app/
│   │   │   ├── core/         # Config, error codes
│   │   │   ├── routers/      # /api/v1/ocr/scan
│   │   │   ├── services/     # OCR engine, preprocessing, QR/ZATCA
│   │   │   └── schemas.py    # Pydantic response models
│   │   └── tests/
│   └── web/                  # React + Vite frontend
├── packages/shared-types/    # Shared DTOs & enums
├── docs/runbook.md           # Production runbook
├── docker-compose.yml
└── .github/workflows/ci.yml  # CI pipeline
```

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`):
1. **Lint & Build** — ESLint, Prettier, `nest build`, `vite build`
2. **Test** — Jest (API), pytest (OCR Worker)
3. **Docker Build** — Multi-service matrix build with BuildKit cache
4. **Security Scan** — Snyk for npm + pip dependencies

## Production

See [`docs/runbook.md`](docs/runbook.md) for backup/restore, troubleshooting, scaling, and environment reference.

Key production safeguards:
- `DB_SYNC=true` blocked at startup in production
- Docker containers run as non-root users
- Health checks on all services
- Path traversal protection on uploads
- Idempotent BullMQ job IDs with exponential backoff
- Failed job logging with dead-letter alerting

## License

UNLICENSED
