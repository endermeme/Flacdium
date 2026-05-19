# Flacdium

Soft white old-school FLAC archive UI with:

- public FLAC and ZIP upload
- Vietnamese / English switch, default Vietnamese
- login required for downloads
- SQLite user store with optional env-seeded admin
- exact-hash dedupe and duplicate track-slot blocking
- acoustic fingerprint dedupe for near-identical uploads
- object storage for uploaded FLAC blobs
- admin account page with login IP logs
- embedded cover preservation
- browse and sort by uploader, artist, album, date, year, and title

## Run locally

```bash
python3 -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000`.

## Run with Docker

```bash
docker compose up --build
```

Open `http://127.0.0.1:8000`.

Ngrok is now dockerized as a sidecar service. Set `NGROK_AUTHTOKEN` in `.env` before starting compose so admin can create temporary public links from `/admin?tab=ngrok`.

## Environment

Copy `.env.example` to `.env` and set your own values there. Docker Compose loads `.env` automatically.
`FLACDIUM_STATE_DIR` controls where runtime data lives on the server host. This keeps SQLite, uploaded FLACs, covers, and temp files outside the git working tree.
Set `FLACDIUM_ADMIN_USERNAME` and `FLACDIUM_ADMIN_PASSWORD` yourself if you want automatic admin bootstrap on a fresh server.
`FLACDIUM_SECRET` is mandatory. The app now refuses startup if the secret is missing or left on the old dev value.
Set `FLACDIUM_TRUST_PROXY=1` only when the app is actually behind a reverse proxy that you control.
`NGROK_AUTHTOKEN` is required for the ngrok service.
`FLACDIUM_NGROK_API_URL` should stay `http://flacdium-ngrok:4040` when using docker compose.

## Ingest rules

- only accepts `.flac`
- ZIP ingest auto-unpacks and scans only `.flac`
- rejects files missing `artist`, `album`, `title`, `tracknumber`, `date`
- rejects FLAC files without embedded cover art
- rejects broken FLAC files
- rejects exact duplicate file hashes
- merges uploader credits when the same track is uploaded again
- compares acoustic fingerprints for same-slot uploads so hash-different but audio-identical files collapse into one track
- rejects FLAC files below the configured sample-rate / bit-depth floor
- rejects FLAC files whose spectrum strongly suggests a lossy transcode repack

## Storage notes

- accepted tracks go to `library/<artist>/<album>/`
- accepted covers go to `covers/<artist>/<album>/`
- SQLite lives in `data/flacdium.sqlite3`
- for large libraries, the next step is policy-driven dedupe, not blind recompression

## Security note

Passwords are stored with salted PBKDF2-SHA256 hashes. POST forms use CSRF tokens, login/signup/upload are rate-limited, and uploads are capped by file count and size.
The Docker image now starts as root only long enough to claim mounted state dirs, then drops to the unprivileged `flacdium` user before running `uvicorn`.
Keep `.env` private and rotate the secret/API key if this project is exposed beyond a trusted environment.
The app now emits `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` and serves `robots.txt` with `Disallow: /`.
