# DHT — PDF Text Extractor

Async service that extracts text from PDFs. Uploads go through a Redis-backed job queue; extraction runs in isolated, sandboxed containers with OCR fallback for scanned documents.

## How to run

```bash
echo "DOCKER_GID=$(getent group docker | cut -d: -f3)" > .env
docker compose --profile build build parser
docker compose up --build
```

API is available at http://localhost:3000

## API

**POST /jobs** — upload a PDF (multipart/form-data, field: `file`)
Returns `202` with `{ jobId }`.

**GET /jobs/:id** — poll job status
Returns `{ status, pageCount?, error? }`. Status is `queued`, `processing`, `done`, or `failed`.

**GET /jobs/:id/pages?from=X&to=Y** — get extracted text
Returns `[{ page, text }]`, 20 pages per request by default.

## Architecture

```
Client ──POST──▸ API ──queue──▸ Redis ──poll──▸ Worker ──spawn──▸ Parser container
                  ▲                                                      │
                  └──────────────── GET results ◂── output.json ◂────────┘
```

- **API** (Node/Express) — file upload, validation, result serving
- **Worker** (Node) — polls Redis, spawns parser containers via Docker socket
- **Parser** (Python/PyMuPDF) — text extraction with Tesseract OCR fallback (en+de)
- **Redis** — job queue and status store

Parser containers run with no network, read-only filesystem, dropped capabilities, 512 MB RAM limit, and a 2-minute timeout.

## Limitations

- 20 MB upload size limit
- 2-minute processing timeout per PDF
- OCR languages limited to English and German
- No authentication or rate limiting
- Job data is ephemeral (local disk + Redis, not persisted across restarts)

## Possible improvements

- Configurable OCR language support
- Streaming extraction for very large files
- Queue-based horizontal scaling with multiple workers
- Persistent storage backend
- Auth and rate limiting
