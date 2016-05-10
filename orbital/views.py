from __future__ import absolute_import

from django.conf import settings
from django.conf.urls import *  # NOQA
from django.views.generic import TemplateView

from .constants import ORBITAL_STREAM_SERVER


class OrbitalView(TemplateView):
    def get_context_data(self, **kwargs):
        context = super(OrbitalView, self).get_context_data(**kwargs)
        context['ORBITAL_STREAM_SERVER'] = ORBITAL_STREAM_SERVER
        return context


map_view = OrbitalView.as_view(template_name='orbital/index.html')
