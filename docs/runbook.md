# Production Runbook

## Database Backup & Restore

### Backup
```bash
# Full backup
docker exec postgres pg_dump -U postgres invoice_ocr > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker exec postgres pg_dump -U postgres -Fc invoice_ocr > backup_$(date +%Y%m%d).dump
```

### Restore
```bash
# From SQL
docker exec -i postgres psql -U postgres invoice_ocr < backup_20240101.sql

# From compressed dump
docker exec -i postgres pg_restore -U postgres -d invoice_ocr --clean backup_20240101.dump
```

## Migrations

```bash
# Generate a new migration after entity changes
cd apps/api && npm run migration:generate -- src/migrations/DescriptiveName

# Run pending migrations
cd apps/api && npm run migration:run

# Revert last migration
cd apps/api && npm run migration:revert
```

**Important**: Never set `DB_SYNC=true` in production. The env validation will block startup if attempted.

## Troubleshooting

### OCR worker not processing jobs
1. Check worker health: `curl http://ocr-worker:8000/health`
2. Check readiness: `curl http://ocr-worker:8000/readiness`
3. Check BullMQ queue: Connect to Redis and inspect `bull:invoice-ocr:*` keys
4. Check worker logs: `docker logs ocr-worker --tail 100`
5. Common causes:
   - PaddleOCR engine failed to initialize (check GPU/memory)
   - Upload directory not mounted or not writable
   - Redis connection lost

### API returning 500 on upload
1. Check API health: `curl http://api:3000/api/v1`
2. Check logs: `docker logs api --tail 100`
3. Verify PostgreSQL is reachable: `docker exec api wget -qO- http://localhost:3000/api/v1`
4. Common causes:
   - Database connection lost
   - Upload directory full or not writable
   - Redis unavailable (BullMQ queue add fails)

### Invoice stuck in PROCESSING_OCR
1. Check if the OCR job exists in BullMQ
2. Check if the OCR worker is running and healthy
3. The job may have timed out (120s default) — check `timings` in OCR result
4. Manually retry: delete the stuck job and re-queue via API

### OCR returning low confidence
1. Check image quality (blurry, rotated, low DPI)
2. Enable enhanced fallback: set `ENABLE_ENHANCED_FALLBACK=true`
3. Lower `OCR_MIN_CONFIDENCE` threshold if needed
4. Check preprocessing logs for deskew/denoise failures

## OCR Worker Scaling

### Horizontal scaling with Docker Compose
```bash
docker compose up -d --scale ocr-worker=3
```

All OCR worker replicas consume from the same BullMQ queue — jobs are distributed automatically.

### Resource recommendations per OCR worker
- **CPU mode**: 2 vCPUs, 4GB RAM minimum
- **GPU mode**: 1 GPU, 8GB VRAM, set `OCR_USE_GPU=true`

## Environment Variables Reference

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `NODE_ENV` | API | `development` | Environment mode |
| `DATABASE_URL` | API | — | PostgreSQL connection string |
| `REDIS_HOST` | API | `localhost` | Redis hostname |
| `DB_SYNC` | API | `false` | TypeORM synchronize (blocked in production) |
| `STORAGE_DRIVER` | API | `local` | Storage backend (`local` or `s3`) |
| `OCR_ENGINE` | OCR Worker | `hybrid` | Engine mode: `ppocrv5`, `hybrid`, `vl` |
| `ENABLE_ENHANCED_FALLBACK` | OCR Worker | `false` | Enable enhanced OCR on low confidence |
| `OCR_MIN_CONFIDENCE` | OCR Worker | `0.75` | Confidence threshold for fallback |
| `OCR_TIMEOUT` | OCR Worker | `120` | OCR processing timeout (seconds) |

## Monitoring Checklist

- [ ] Docker healthchecks green for all services
- [ ] PostgreSQL connections not exhausted
- [ ] Redis memory usage under control
- [ ] BullMQ failed job count monitored
- [ ] Upload disk space monitored
- [ ] OCR worker response times tracked via `timings` field
- [ ] Error rate on `/api/v1/ocr/scan` endpoint
