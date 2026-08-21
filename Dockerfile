# The image the live site runs: one static Go binary plus the built frontend.
#
# The frontend lives at the repo root (it used to be under frontend/, built with
# bun), so stage 1 builds from the root with npm. Vite writes to `static/`
# because that is the directory main.go serves — see vite.config.ts.

# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS builder
WORKDIR /usr/src/orbital
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN CGO_ENABLED=0 go build -ldflags '-extldflags "-static"' -o /bin/orbital .

# Stage 3: Runtime
FROM scratch
COPY --from=builder /bin/orbital /bin/
COPY --from=frontend /app/static/ /static/

EXPOSE 7000
EXPOSE 5556/udp

WORKDIR /

ENTRYPOINT ["/bin/orbital"]
CMD ["-host=0.0.0.0"]
