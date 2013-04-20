from django.db import models

class ScreenStitchSession(models.Model):
  """
  Bare bones model for a session between a client and a host. This is currently
  setup to only have one connection, since the connected field is Boolean, its
  either connected or not. The timestamp can be used to delete old sessions if
  they don't get deleted when the host disconnects.
  """
  key_name = models.CharField(max_length=32)
  timestamp = models.DateTimeField(auto_now_add=True)
  connected = models.BooleanField(default=False)
