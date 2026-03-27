# Stage 1: Build frontend with Bun
FROM oven/bun:1 AS frontend
WORKDIR /app
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY frontend/ .
RUN bun run build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS builder
RUN mkdir -p /usr/src/orbital
COPY . /usr/src/orbital
COPY --from=frontend /app/../static /usr/src/orbital/static
WORKDIR /usr/src/orbital
RUN CGO_ENABLED=0 go build -ldflags '-extldflags "-static"' -v ./...

# Stage 3: Runtime
FROM scratch
COPY --from=builder /usr/src/orbital/orbital /bin/
COPY --from=builder /usr/src/orbital/static/ /static/

EXPOSE 7000
EXPOSE 5556/udp

WORKDIR /

ENTRYPOINT ["/bin/orbital"]
CMD ["-host=0.0.0.0"]
