from __future__ import absolute_import

from django.conf.urls import *  # NOQA

from .views import map_view

urlpatterns = patterns(
    '',
    url(r'^$', map_view, name='orbital'),
)
