from __future__ import absolute_import

from django.conf import settings

ORBITAL_UDP_SERVER = getattr(settings, 'ORBITAL_UDP_SERVER', '127.0.0.1:5556')
