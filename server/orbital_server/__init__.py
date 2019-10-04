#!/usr/bin/env python3.7

import asyncio
from datetime import datetime

import click
from starlette.applications import Starlette


class UDPServer:
    def __init__(self, notifier):
        self.notifier = notifier

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        asyncio.create_task(self.notifier(data))

    def serve(self, host, port):
        return asyncio.get_event_loop().create_datagram_endpoint(
            lambda: self, local_addr=(host, port)
        )


class SSEHandler:
    def __init__(self, connections):
        self.connections = connections

    async def __call__(self, scope, receive, send):
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [[b"content-type", b"text/event-stream"]],
            }
        )
        self.connections.add(send)
        try:
            while True:
                if (await receive())["type"] == "http.disconnect":
                    break
        finally:
            self.connections.remove(send)


class HTTPServer(Starlette):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        from starlette.templating import Jinja2Templates
        from starlette.staticfiles import StaticFiles

        self.connections = set()
        self.templates = Jinja2Templates(directory="templates")
        self.mount("/static", StaticFiles(directory="static"), name="static")
        self.add_route("/", self.handle_index)
        self.add_route("/stream", SSEHandler(self.connections), name="stream")

    def serve(self, host, port):
        from uvicorn.config import Config
        from uvicorn.main import Server

        return Server(Config(self, host=host, port=port)).serve()

    async def handle_index(self, request):
        return self.templates.TemplateResponse(
            "index.html", {"request": request, "year": datetime.now().year}
        )

    async def notify_users(self, message):
        if not self.connections:
            return

        message = {
            "type": "http.response.body",
            "body": b"data: " + message + b"\n\n",
            "more_body": True,
        }
        for send in self.connections:
            asyncio.create_task(send(message))


def run_test(n, port):
    import json
    import socket
    from time import time

    udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    for _ in range(n):
        udp_socket.sendto(
            json.dumps([1, 2, int(time() * 1000), "javascript"]).encode("utf8"),
            ("127.0.0.1", port),
        )


@click.command()
@click.option("--host", default="127.0.0.1")
@click.option("--http-port", default=7000)
@click.option("--udp-port", default=5556)
@click.option("--test", default=0)
def main(host, http_port, udp_port, test):
    if test:
        return run_test(test, udp_port)

    loop = asyncio.get_event_loop()

    http_server = HTTPServer()
    udp_server = UDPServer(http_server.notify_users)

    loop.run_until_complete(udp_server.serve(host, udp_port))
    loop.run_until_complete(http_server.serve(host, http_port))


if __name__ == "__main__":
    main()
