from django.conf.urls.defaults import *

urlpatterns = patterns('',
  # This is called whenever a client connects via socket, however I've
  # noticed it sometimes isn't called from mobile devices
  # channel_presence must be added to inbound_services.
  (r'^_ah/channel/connected/$', 'screenstitch.views.client_connected'),
  # Called when a client disconnects, channel_presence must be 
  # in inbound_services.
  (r'^_ah/channel/disconnected/$', 'screenstitch.views.client_disconnected'),
  # This is the url for when clients want to connect, it handles multiple
  # situations.
  (r'^connect/?(?:(\d{4})/?)?$', 'screenstitch.views.connect_with_key'),
  # The url when a message is posted from a client.
  (r'^message/(\d{4})/?$', 'screenstitch.views.message_with_key'),
)
