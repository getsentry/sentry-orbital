from __future__ import absolute_import

import GeoIP
import socket
import warnings

from sentry.signals import event_accepted
from sentry.utils.json import dumps
from time import time

from .constants import GEOIP_PATH, ORBITAL_UDP_SERVER

try:
    geocoder = GeoIP.open(GEOIP_PATH, GeoIP.GEOIP_MEMORY_CACHE)
except Exception:
    warnings.warn('Unable to find GeoIP data at %r' % GEOIP_PATH)
    geocoder = None
    geocode_addr = lambda ip: None
else:
    geocode_addr = geocoder.record_by_addr

udp_addr = ORBITAL_UDP_SERVER.split(':', 1)
udp_addr[1] = int(udp_addr[1])
udp_addr = tuple(udp_addr)

udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

@event_accepted.connect(weak=False)
def notify_orbital(ip, data=None, **kwargs):
    try:
        result = geocode_addr(ip)
    except Exception:
        return

    if not result:
        return

    if data:
        platform = (data.get('platform') or 'other').lower()
    else:
        platform = ''

    data = [
        round(result['latitude'], 4),
        round(result['longitude'], 4),
        int(time() * 1000),
        platform,
    ]

    udp_socket.sendto(dumps(data), udp_addr)
