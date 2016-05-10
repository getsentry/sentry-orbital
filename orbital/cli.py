from __future__ import absolute_import

from sentry.runner import configure
configure()

from optparse import OptionParser

from .server import EventSourceServer, PubServer

def send_test_data():
    import os
    import random
    from sentry.signals import event_accepted
    from time import sleep

    def generate_ip():
        return '%s.%s.%s.%s' % (
            random.randint(1, 255),
            random.randint(0, 255),
            random.randint(0, 255),
            random.randint(0, 255),
        )

    platforms = [
        'php',
        'python',
        'javascript',
        'java',
        'ruby',
        'other',
    ]

    while True:
        event_accepted.send(
            ip=generate_ip(),
            data={
                'platform': random.choice(platforms),
            },
            sender=object,
        )
        sleep(0.0001)


def main():
    parser = OptionParser()
    parser.add_option('--host', dest='host', default='0.0.0.0')
    parser.add_option('--port', dest='port', type=int, default=7000)
    parser.add_option('--udp-port', dest='udp_port', type=int, default=5556)
    parser.add_option('--test', dest='test', action='store_true', default=False)

    (options, args) = parser.parse_args()

    if options.test:
        print "Sending mock data"

        try:
            send_test_data()
        except KeyboardInterrupt:
            print "...shutting down"
        return

    print "Listening for HTTP connections on %s:%s" % (options.host, options.port)

    web = EventSourceServer((options.host, options.port))
    web.start()

    print "Listening for UDP connections on %s:%s" % ('0.0.0.0', options.udp_port)

    try:
        PubServer(web.clients, ':%s' % (options.udp_port,)).serve_forever()
    except KeyboardInterrupt:
        print "...shutting down"


if __name__ == "__main__":
    main()
