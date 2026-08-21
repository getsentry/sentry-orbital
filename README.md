# Sentry Orbital

A globe that draws a beam for every event as it arrives, with a character-cell
terminal overlay reading out throughput, SDK families and regions.

It runs in two halves. The **frontend** is Vite + React + three.js. The
**backend** is a small Go service that owns a UDP socket and re-broadcasts what
it receives over SSE, because a browser cannot receive UDP itself.

You do not need the backend. Without it the globe runs on a synthetic generator
and everything works — the backend is only there when you want the real feed.

---

## Quick start

**Frontend only** (synthetic data, no other setup):

```bash
npm install && npm run dev
```

Open <http://localhost:5190>. That is the whole thing.

**With the live feed**, add the backend in a second terminal:

```bash
npm run backend
```

Then reload the page. Nothing else to configure — the frontend notices the
backend and switches over on its own.

---

## How the two halves fit together

```
  producer ──UDP:5556──▶  Go service  ──SSE──▶  Vite dev server  ──▶  browser
                          (main.go)    /stream   :5190 proxies       :5190
                          :7010                  /stream /healthz
                                                 /stats to :7010
```

The Vite dev server proxies three paths through to the backend, so the browser
only ever talks to its own origin and there is no CORS to think about:

| path | what it is |
| --- | --- |
| `/stream` | the SSE feed — one message per event |
| `/healthz` | `ok`, used to detect whether a backend is there at all |
| `/stats` | counters: received, forwarded, dropped, and the two rate limits |

The wire format is the raw datagram, passed through untouched:

```
[latitude, longitude, epochMillis, platform]
```

It carries no identifiers — a point, a millisecond and a platform string. The
coordinate is derived by the producer from an IP that never leaves it.

---

## Which data source am I looking at?

In development the source is `auto`, and it works like this:

1. Start on the synthetic generator, so the globe is never empty.
2. Ask `/healthz` whether a backend exists (1.5s timeout).
3. If something answers, switch to the live feed.

So **start the backend and reload** — that is the entire switch.

`auto` does not switch back if the live stream later drops. EventSource
reconnects on its own, and quietly resuming synthetic data would redraw an
outage as healthy traffic, which is the one thing this display must not do.

**To force a source**, in development only:

```
http://localhost:5190/?source=synthetic
http://localhost:5190/?source=real
http://localhost:5190/?source=auto
```

or set `VITE_EVENT_SOURCE=synthetic|real|auto` before `npm run dev`.

**To tell which one you got**, watch the rows in the event stream panel. The
live feed carries no country, so its region column is a coarse longitude bucket
and rows arrive tagged `backend`. Or just check the counters:

```bash
curl -s localhost:7010/stats
```

> **A production build is hard-wired to the live feed.** There is no `?source=`
> override there and the synthetic generator is dropped from the bundle
> entirely — otherwise anyone could put fabricated numbers on screen with a
> query string, or a backend outage would quietly redraw itself as traffic.

---

## The backend

Two ways to run it. Both serve HTTP on `:7010` and both pass `-test`, which
starts a generator inside the service that sends itself UDP datagrams — that is
what gives you a live-looking feed with no real producer pointed at it.

**Docker** — nothing to install but Docker:

```bash
npm run backend
```

**Native** — needs Go 1.25 on your machine:

```bash
npm run backend:native
```

They differ in one way that only matters once you have a **real** producer. The
native run listens for UDP on `127.0.0.1:5556` and anything on your machine can
reach it. The Docker run publishes only the HTTP port, so its UDP socket is
sealed inside the container — fine for `-test`, useless for real datagrams.
Publish it too if you need that:

```bash
docker run --rm -p 7010:7000 -p 5556:5556/udp \
  -v "$PWD":/src -w /src golang:1.25-alpine \
  sh -c 'go run main.go -host 0.0.0.0'
```

### Flags

`npm run backend:native` is just `go run main.go`, so you can pass anything:

| flag | default | what it does |
| --- | --- | --- |
| `-host` | `127.0.0.1` | listen address |
| `-http-port` | `7000` | HTTP port (the npm scripts publish it on 7010) |
| `-udp-port` | `5556` | UDP port |
| `-test` | off | generate test events internally |
| `-sample-rate` | `1.0` | fraction of datagrams eligible to forward |
| `-max-forward-rate` | `50` | ceiling on events/sec sent to clients |

`-sample-rate` thins the stream, then `-max-forward-rate` caps what is left.
`/stats` reports received, forwarded and dropped separately, so the difference
between the three is visible rather than guessed at.

### Why port 7010 and not 7000?

`main.go` defaults to `:7000`, but on macOS the AirPlay Receiver squats on that
port. The npm scripts publish it on **7010** instead and the Vite proxy follows
suit. To point the frontend somewhere else:

```bash
ORBITAL_BACKEND=http://127.0.0.1:9999 npm run dev
```

---

## Other things worth knowing

Everything below is documented properly in [SETTINGS.md](SETTINGS.md).

| | |
| --- | --- |
| `C` or `?dev` | the style panel and the diagnostics readout — **localhost only** |
| `F` | hide the readouts for a clean shot of the globe |
| `S` | mute |
| `?quality=low\|medium\|high` | force a rendering tier, to see what a slower device sees |

The style panel writes to `localStorage`, so whatever you tune there survives a
reload. It is not shipped to a deployed page: the flag that gates it is
substituted at build time, so the panel's code — leva included, ~75 kB
gzipped — is never emitted in a production bundle.

---

## Building for production

```bash
npm run build     # -> dist/
npm run preview   # serve that build on :5190
```

`npm run preview` still proxies to the backend, so a production build can be
checked against the live feed locally.

> **The container build does not work yet.** The `Dockerfile` expects the
> frontend in a `frontend/` subdirectory and its output at `/static`, but the
> frontend lives at the repo root and Vite emits `dist/`. The Go service serves
> `/` from `static/`, which nothing currently produces. Deploying as one
> process needs those three paths reconciled first.

---

## Layout

| | |
| --- | --- |
| `src/render/` | three.js scene — globe, beams, clouds, post FX, the Seer easter egg |
| `src/ui/` | the terminal overlay: panels, gauges, the boot sequence |
| `src/data/` | event sources (synthetic and live), the rolling buffer, the world map |
| `src/dev/` | the style panel, local only |
| `main.go` | the UDP-to-SSE service |
| `SETTINGS.md` | every style control, and why each one is the way it is |
