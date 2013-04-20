import logging
import random

from django.core.urlresolvers import reverse
from django.http import HttpResponse
from django.http import HttpResponseRedirect
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils import simplejson as json
from django.views.generic.simple import direct_to_template
from django.views.decorators.csrf import csrf_exempt

from google.appengine.api import channel

from models import ScreenStitchSession

def send_host(key, message):
  """Send the message to the host client.
  
  Given the key for the session, send the given message to the host
  whic is whatever first created the session.
  """
  channel.send_message(key + '1', message)
  
def send_controller(key, message):
  """Send the message to the controller client.
  
  Given the key for the session, send the given message to the controller
  which is whatever hooked on to the session second.
  """
  channel.send_message(key + '2', message)
  
def get_key_from_client(client_id):
  """Returns the key when provided a client id."""
  return client_id[:-1]

def is_client_host(client_id):
  """Returns whether the given client_id is the host or the controller."""
  return client_id[-1:] == '1'
  
def is_client_controller(client_id):
  """Returns whether the given client_id is the host or the controller."""
  return client_id[-1:] == '2'

def get_host_id(key):
  return key + '1'
  
def get_controller_id(key):
  return key + '2'
    
def create_host_channel(key):
  """Given the key, creates a host channel and returns token."""
  return channel.create_channel(key + '1')
  
def create_controller_channel(key):
  """Given the key, creates a controller channel and returns token."""
  return channel.create_channel(key + '2')

def poll_connection(client_id):
  if client_id:

    # If this is the controller
    if is_client_controller(client_id):
      key = get_key_from_client(client_id)
      stitch_sessions = ScreenStitchSession.objects.filter(key_name=key)
      if stitch_sessions and not stitch_sessions[0].connected:
        stitch_session = stitch_sessions[0]
        stitch_session.connected = True
        stitch_session.save()
        send_host(key, 'connected')
        send_controller(key, 'connected')
        
@csrf_exempt
def client_connected(request):
  """Socket connection handler.
  
  Called when one of the clients connects to the socket channel.
  """
  client_id = request.POST.get('from')
  poll_connection(client_id)
  return HttpResponse(status=200)

@csrf_exempt
def client_disconnected(request):
  """Socket connection handler.
  
  Called when one of the clients disconnects to the socket channel. If
  the host disconnects then the session is deleted. If the controller
  disconnects then it is noted and a new one can connect.
  """
  client_id = request.POST.get('from')
  
  if client_id:
    key = get_key_from_client(client_id)

    stitch_sessions = ScreenStitchSession.objects.filter(key_name=key)
    if stitch_sessions:
      stitch_session = stitch_sessions[0]
      if is_client_host(client_id):
        send_controller(key, 'disconnected')
        stitch_session.delete()
      elif is_client_controller(client_id):
        stitch_session.connected = False
        stitch_session.save()
        send_host(key, 'disconnected')
    
  return HttpResponse(status=200)


@csrf_exempt 
def message_with_key(request, key):
  """Socket message request handler.
  
  Called from a client when it wants to send a message.
  """
  #stitch_sessions = ScreenStitchSession.objects.filter(key_name=key)
  client_id = request.POST.get('f')
  message = request.POST.get('m')
  
  if message == '_poll':
    poll_connection(client_id)
  else:
    #if not stitch_sessions:
      #return HttpResponse(status=400)
    #else:
      #stitch_session = stitch_sessions[0]
      # TODO: save state here if need to persist
    
    # Send the message to everyone except
    if is_client_controller(client_id):
      send_host(key, message)
    elif is_client_host(client_id):
      send_controller(key, message)

  return HttpResponse(status=200)
    

  
@csrf_exempt
def connect_with_key(request, key):
  """Socket connection request handler.
  
  This could be called from xhr or from requesting the given page. If 
  the latter, then just load the template and pass the key. The client
  will then have to call this same url via post.
  
  If POST and no key provided, they are connecting as host. If there is
  a key, they are trying to join an existing key.
  """
  response_data = {}

  if request.method == 'POST':
    if not key:
      # Create new key with the request as the host
      key = str(random.randint(1000, 9999))
      while ScreenStitchSession.objects.filter(key_name=key):
        key = str(random.randint(1000, 9999))

      stitch_session = ScreenStitchSession(key_name = key)
      stitch_session.save()
      
      response_data['endpoint'] = reverse('screenstitch.views.message_with_key', args=(key,))
      response_data['token'] = create_host_channel(key)
      response_data['id'] = get_host_id(key)
      response_data['key'] = key
      
    else:
      # Attempt to join existing key
      stitch_sessions = ScreenStitchSession.objects.filter(key_name=key)

      if not stitch_sessions:
        response_data['error'] = 'bad key'
      elif stitch_sessions[0].connected:
        response_data['error'] = 'key already connected'
      else:
        response_data['endpoint'] = reverse('screenstitch.views.message_with_key', args=(key,))
        response_data['token'] = create_controller_channel(key)
        response_data['id'] = get_controller_id(key)
        response_data['key'] = key

    return HttpResponse(json.dumps(response_data), content_type="application/json")
  else:
    if key:
      response_data['screenstitch_key'] = key

    return direct_to_template(request, 'screenstitch/connect.html', response_data)
