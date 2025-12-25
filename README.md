# Illhm.github.io Spotify API Integration

This repository now supports streaming Spotify track audio through a Python API
adapted from `spotify_dl_v3.py`. The front-end requests audio from a backend
service (FastAPI) instead of embedding the native Spotify player.

## Architecture Overview

```
Browser (GitHub Pages)
  └─ index.html
     └─ Calls /api/stream?track_url=... on the backend
Backend (FastAPI)
  ├─ /api/info   → resolves metadata for a track
  └─ /api/stream → streams audio via spotify_dl_v3 logic
Upstream
  └─ spotify.downloaderize.com (WordPress AJAX endpoint)
```

### Key Changes

- **Front-end playback** uses `data-spotify-url` and an API base configured in
  `<body data-api-base="...">`.
- **Fallback previews** are kept in `music/` and used when the API is
  unavailable.
- **CORS** is configured in the backend to allow GitHub Pages to access the API.

## Backend Setup (FastAPI)

The backend lives in `backend/`:

```
backend/
  app.py
  spotify_service.py
  requirements.txt
```

### Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

### Configure CORS

Set `ALLOWED_ORIGINS` to restrict who can call the API:

```bash
export ALLOWED_ORIGINS="https://yourname.github.io,http://localhost:8000"
```

If `ALLOWED_ORIGINS` is not set, the API allows all origins (`*`). This is fine
for local testing but **should be locked down for production**.

### Hosting suggestions

GitHub Pages is static-only. Host the FastAPI service separately:

- **Render.com**: Free tier, easy Docker/uvicorn deployment.
- **Fly.io**: Global deployment, HTTPS support.
- **Railway**: Simple web service hosting.

Pick a host that supports Python + Uvicorn, then set the final URL in
`<body data-api-base="https://your-api.example.com">`.

## Front-end Integration

### Update API base

In `index.html`, edit the body tag:

```html
<body data-api-base="https://your-api.example.com">
```

### How playback works

- When a user clicks play, the front-end builds:
  `https://your-api.example.com/api/stream?track_url=<spotify-track-url>`
- The audio element streams from that endpoint.
- If the API fails, playback falls back to a local preview file.

### Track configuration

Each player uses a Spotify URL:

```html
<div class="music-player" data-spotify-url="https://open.spotify.com/track/...">
  ...
  <audio preload="none" data-fallback-src="music/example.mp3"></audio>
</div>
```

## API Endpoints

- `GET /health` → service heartbeat
- `GET /api/info?track_url=<spotify track URL>` → JSON metadata
- `GET /api/stream?track_url=<spotify track URL>` → audio stream

## Error Handling & Fallbacks

- If the API base is not configured, the player immediately uses the fallback
  audio file.
- If the stream fails or times out, the player switches to the fallback and
  shows a status message.

## Compliance Notes

This integration depends on a third-party downloader endpoint and is **not an
official Spotify API**. Review Spotify's terms of service and licensing rules
before deploying any playback solution. You are responsible for ensuring that
streaming and redistribution of audio complies with applicable policies.

## Maintenance Tips

- Update `backend/requirements.txt` regularly for security patches.
- If the downloader endpoint changes, update `backend/spotify_service.py` to
  match the new AJAX parameters.
- Monitor backend logs for rate limits or request failures.
