# Sentry Orbital

A globe that draws a beam for every event, with a terminal overlay reading out
throughput, SDK families and regions.

### **<https://live.sentry.io>**

That is the real thing, on the real feed. It is this repository's `master`
branch: merge to `master` and it deploys itself (see [Deploy](#deploy)).
Everything below is for running your own copy.

## Run it

```bash
npm install
npm run dev
```

<http://localhost:5190>. That is everything — it runs on synthetic data.

## Add the live feed

In a second terminal:

```bash
npm run backend          # Docker, nothing else to install
npm run backend:native   # or natively, needs Go 1.25
```

Reload the page. It finds the backend and switches over on its own.

## Data source

`auto` in development: synthetic until a backend answers `/healthz`, then live.
It does not switch back if the stream drops.

Force one, dev only:

```
?source=synthetic   ?source=real   ?source=auto
```

or `VITE_EVENT_SOURCE=synthetic|real|auto` before `npm run dev`.

A production build is hard-wired to the live feed — no override, and the
synthetic generator is not in the bundle.

## Backend

Serves `/stream` (SSE), `/healthz` and `/stats` on `:7010`. Vite proxies those
three paths.

`npm run backend:native` is `go run main.go`, so it takes any flag:

| flag | default | |
| --- | --- | --- |
| `-host` | `127.0.0.1` | listen address |
| `-http-port` | `7000` | HTTP port (npm scripts publish it on 7010) |
| `-udp-port` | `5556` | UDP port |
| `-test` | off | generate test events internally |
| `-sample-rate` | `1.0` | fraction of datagrams eligible to forward |
| `-max-forward-rate` | `50` | ceiling on events/sec sent to clients |

Both npm scripts pass `-test`. Port 7010 rather than 7000 because macOS AirPlay
squats on 7000; point the frontend elsewhere with
`ORBITAL_BACKEND=http://host:port npm run dev`.

The Docker script publishes only the HTTP port. For a real producer sending
UDP, publish that too:

```bash
docker run --rm -p 7010:7000 -p 5556:5556/udp \
  -v "$PWD":/src -w /src golang:1.25-alpine \
  sh -c 'go run main.go -host 0.0.0.0'
```

## In the browser

| | |
| --- | --- |
| `C` or `?dev` | style panel + diagnostics — localhost only |
| `F` | hide the readouts |
| `S` | mute |
| `?quality=low\|medium\|high` | force a rendering tier |

Every style control is documented in [SETTINGS.md](SETTINGS.md).

## Build

```bash
npm run build     # -> static/, which is the directory main.go serves
npm run preview   # serve it on :5190, still proxied to the backend
```

Or build the container — one static Go binary plus the built frontend, the same
image live.sentry.io runs:

```bash
docker build -t orbital .
docker run --rm -p 7010:7000 -p 5556:5556/udp orbital -host=0.0.0.0 -test
```

<http://localhost:7010> — 7010 for the same reason the npm scripts use it, that
macOS AirPlay answers on 7000. Drop `-test` when a real producer is sending UDP
to 5556.

## Deploy

Push to `master` builds the image and deploys it to <https://live.sentry.io>.
Nothing here is run by hand.

- **GitHub Actions** (`.github/workflows/build.yml`) builds the Dockerfile, runs
  a smoke test against the running container, and pushes
  `ghcr.io/getsentry/sentry-orbital:{nightly,<sha>}`.
- **GoCD** (`gocd/`) waits for that check by name — *Build and smoke test* — and
  rolls the image out to the `orbital` container in each US region.

The build output is `static/` and not `dist/` because `static/` is the directory
`main.go` serves. Point it elsewhere and the pipeline goes green on an image
that serves nothing.
