from __future__ import absolute_import

from django.conf import settings

ORBITAL_STREAM_SERVER = getattr(settings, 'ORBITAL_STREAM_SERVER', 'http://localhost:7000/')

ORBITAL_UDP_SERVER = getattr(settings, 'ORBITAL_UDP_SERVER', 'localhost:5556')
