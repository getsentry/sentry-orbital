from __future__ import absolute_import

from collections import deque
from django.conf import settings
from django.core.handlers.wsgi import WSGIHandler
from gevent import pywsgi, socket, sleep
from gevent.server import DatagramServer

from .constants import ORBITAL_STREAM_SERVER

class Client(object):
    def __init__(self, address, handler):
        self.address = address
        self.queue = deque(maxlen=1000)
        self.handler = handler
        self.connected = True

    def stream(self):
        while self.connected:
            while self.queue:
                message = self.queue.popleft()
                for line in message.splitlines():
                    yield "data: {}\n".format(line)
                yield "\n"
            sleep(0.01)

    def put(self, message):
        self.queue.append(message)
        sleep(0)


class PubServer(DatagramServer):
    def __init__(self, queues, *args, **kwargs):
        super(PubServer, self).__init__(*args, **kwargs)
        self.queues = queues

    def handle(self, data, address):
        for queue in self.queues:
            queue.put(data)


class EventSourceHandler(pywsgi.WSGIHandler):
    def run_application(self):
        if self.status and not self.headers_sent:
            self.write('')

        client = Client(self.client_address, self)
        self.server.clients.add(client)

        try:
            print "[%s] Client connected (%s clients total)" % (
                self.environ['REMOTE_ADDR'], len(self.server.clients))

            origin = self.environ.get('HTTP_ORIGIN', '')

            self.start_response("200 OK", [
                ('Content-Type', 'text/event-stream'),
                ('Cache-Control', 'no-cache'),
                ('Connection', 'keep-alive'),
                ('Access-Control-Allow-Origin', origin),
            ])

            self.result = client.stream()
            self.process_result()

            super(EventSourceHandler, self).run_application()
        except socket.error as exc:
            if exc.errno != 32:
                raise
        finally:
            self.server.clients.remove(client)


class EventSourceServer(pywsgi.WSGIServer):
    def __init__(self, *args, **kwargs):
        self.clients = set()
        kwargs['application'] = lambda e, s: ''
        kwargs['handler_class'] = EventSourceHandler
        super(EventSourceServer, self).__init__(*args, **kwargs)

    def handle(self, socket, address):
        handler = self.handler_class(socket, address, self)
        handler.handle()
