/**
 * @fileoverview Class definition for a screenstitch client that represents an
 * external controller. This will probably be a mobile device.
 *
 * @author dan@leftfieldlabs.com (Dan Riley)
 */

goog.provide('screenstitch.Controller');

goog.require('screenstitch');
goog.require('screenstitch.Client');

goog.require('goog.Timer');


/**
 * A socket client which establishes a connection via a socket with another
 * client.
 * @param {screenstitch.ClientOptions=} opt_options Configure options for client.
 * @constructor
 * @extends {screenstitch.Client}
 */
screenstitch.Controller = function(opt_options)
{
  screenstitch.Client.call(this, opt_options); 

  /**
   * @type {goog.Timer}
   * @private
   */
  this.statusPollTimer_ = new goog.Timer(screenstitch.POLL_TIME_MS);
  
  goog.events.listen(this.statusPollTimer_, 'tick', this.pollStatus_, 
      false, this);

};
goog.inherits(screenstitch.Controller, screenstitch.Client);

/**
 * Creates a channel using the given key.
 * @param {string=} opt_key An optional key to use (passed from server). If no
 *                  key is provided it will try to use a global key if set.
 */
screenstitch.Controller.prototype.connect = function(opt_key)
{     
  if (this.getSocket().connect(opt_key)) {
    this.setStatus(screenstitch.Status.CONTACTING);
    return true;
  }
  
  return false;
};

/**
 * Socket delegate method, called when the socket first opens. This must
 * call the super method.
 * @protected
 */
screenstitch.Controller.prototype.onSocketOpen = function()
{
  // Pass message off to super class
  screenstitch.Client.prototype.onSocketOpen.call(this);
  
  // We set status to connecting since we now have a token but server hasn't
  // verified us as connected.
  this.setStatus(screenstitch.Status.CONNECTING);
  
  // Begin polling for connection status. This is necessary because on mobile
  // devices we don't always receive the connection event on the server.
  this.statusPollTimer_.start();
};

/**
 * @override
 */
screenstitch.Controller.prototype.onStatusChange = function(status)
{
  if (status == screenstitch.Status.CONNECTED) {
    this.statusPollTimer_.stop();
  } else if (status === screenstitch.Status.DISCONNECTED) {
    this.statusPollTimer_.start();
  }
};

/**
 * Sends a poll message to the server after we have opened the socket, but
 * before we received the CONNECTED event.
 * @private
 */
screenstitch.Controller.prototype.pollStatus_ = function()
{
  this.getSocket().sendMessage('_poll');
};

goog.exportSymbol('screenstitch.Controller', screenstitch.Controller, window);
goog.exportProperty(screenstitch.Controller.prototype, 'connect', 
    screenstitch.Controller.prototype.connect);

  

