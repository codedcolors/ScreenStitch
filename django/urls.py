from django.conf.urls.defaults import *
from django.views.generic.simple import direct_to_template

import screenstitch.urls

urlpatterns = patterns('',
  (r'^$', direct_to_template, {'template': 'home.html'}),
  # Allow screenstitch to handle anything else
  (r'^', include(screenstitch.urls)),
)
