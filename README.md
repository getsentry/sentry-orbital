# Orbital

Orbital is a geographical visualization of Sentry data — a real-time 3D globe showing error events as they happen worldwide.

## Architecture

- **Go backend** (`main.go`): Receives UDP events, samples them at 5%, and fans out via SSE to connected browsers
- **React frontend** (`frontend/`): Vite + React + TypeScript app using [cobe](https://github.com/shuding/cobe) for the WebGL globe

## Development

### Prerequisites

- Go 1.25+
- [Bun](https://bun.sh) (for the frontend)

### Running locally

You'll need two terminal windows:

**Terminal 1 — Go backend with test events:**
```bash
go run main.go -test
```

This starts the backend on `:7000` with a test event generator that simulates real-world traffic.

**Terminal 2 — Vite dev server:**
```bash
cd frontend
bun install
bun run dev
```

This starts the Vite dev server on `:5173` with HMR. API requests (`/stream`, `/healthz`) are proxied to the Go backend.

**Open http://localhost:5173** to see the live globe with test events.

### Production build

```bash
cd frontend
bun run build   # outputs to ../static/
cd ..
go run main.go -test
```

Open http://localhost:7000 to see the production build served by Go.

## Docker

```bash
docker build -t sentry-orbital .
docker run --rm -p 7000:7000 -p 5556:5556/udp -e HOST=0.0.0.0 sentry-orbital
```

## Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `-host` | `127.0.0.1` | Listen address |
| `-http-port` | `7000` | HTTP port |
| `-udp-port` | `5556` | UDP port for event ingest |
| `-sample-rate` | `0.05` | Fraction of events to forward (0.0–1.0) |
| `-test` | `false` | Enable test event generator |

## UDP Event Format

Events are sent as JSON arrays:
```json
[37.8, -122.4, 1700000000000, "javascript"]
```
Format: `[latitude, longitude, timestamp_ms, platform]`

## License

Apache 2.0
