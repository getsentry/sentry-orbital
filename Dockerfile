FROM golang:1.22-alpine AS builder
RUN mkdir -p /usr/src/orbital
COPY . /usr/src/orbital
WORKDIR /usr/src/orbital
RUN CGO_ENABLED=0 go build -ldflags '-extldflags "-static"' -v ./...

FROM scratch
COPY --from=builder /usr/src/orbital/orbital /bin/
COPY --from=builder /usr/src/orbital/templates/ /templates/
COPY --from=builder /usr/src/orbital/static/ /static/

EXPOSE 7000
EXPOSE 5556/udp

WORKDIR /

ENTRYPOINT ["/bin/orbital"]
CMD ["-host=0.0.0.0"]
