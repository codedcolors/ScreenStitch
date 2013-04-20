goog.provide('screenstitch.Host');

goog.require('screenstitch.Client');


goog.require('goog.Uri');



/**
 * A socket client which establishes a connection via a socket with another
 * client. This type of client represents the client that started the session.
 * @param {screenstitch.ClientOptions=} opt_options Configure options for client.
 * @constructor
 * @extends {screenstitch.Client}
 */
screenstitch.Host = function(opt_options)
{
  screenstitch.Client.call(this, opt_options); 
};
goog.inherits(screenstitch.Host, screenstitch.Client);

/**
 * Creates a channel using the given key, or will generate the key if none is
 * provided.
 * @param {string=} opt_key An optional key to use (passed from server).
 */
screenstitch.Host.prototype.connect = function(opt_key)
{
  this.setStatus(screenstitch.Status.CONTACTING);
        
  if (opt_key) {
    this.getSocket().connect(opt_key);
  } else {
    this.getSocket().generateKey();
  }
};

/**
 * Call this after displaying instructions for the user to connect. For now
 * it just changes the connection status.
 */
screenstitch.Host.prototype.waitForClient = function()
{
  if (this.getStatus() === screenstitch.Status.DISCONNECTED) {
    this.setStatus(screenstitch.Status.CONNECTING);
    return true;
  }
  
  return false;
};

/**
 * Returns a code that the client can enter into the field on the client uri.
 * @return {string} The connect code.
 */
screenstitch.Host.prototype.getCode = function()
{
  return this.getSocket().getKey();
};

/**
 * Returns a uri that the client can go to to connecto this host. Append the 
 * key to have it automatically connect on load.
 * @return {string}
 */
screenstitch.Host.prototype.getConnectUri = function()
{
  var socketUri = this.getSocket().getUri();
  
  if (socketUri.indexOf('http') === 0) {
    return socketUri;
  } else {
    return goog.Uri.resolve(window.location.href, this.getSocket().getUri());
  }
};

/**
 * @param {number} The width in pixels of the image.
 * @param {number} The height in pixels of the image.
 * @return {HTMLImageElement}
 */
screenstitch.Host.prototype.generateQrImage = function(width, height)
{
  /** @type {HTMLImageElement} */
  var el = goog.dom.createDom('img');
  var link = encodeURIComponent(this.getConnectUri() + 
      this.getSocket().getKey());
  el.src = 'http://chart.googleapis.com/chart?cht=qr&chs=' + width + 'x' + 
      height + '&chl=' + link;
  
  return el;
};


/**
 * @override
 */
screenstitch.Host.prototype.onSocketOpen = function()
{
  // Pass message off to super class
  screenstitch.Client.prototype.onSocketOpen.call(this);
  
  // We started the session, and are waiting for mobile to connect.
  this.setStatus(screenstitch.Status.DISCONNECTED);
};  


goog.exportSymbol('screenstitch.Host', screenstitch.Host, window);
goog.exportProperty(screenstitch.Host.prototype, 'generateQrImage', 
    screenstitch.Host.prototype.generateQrImage);
goog.exportProperty(screenstitch.Host.prototype, 'waitForClient', 
    screenstitch.Host.prototype.waitForClient);
goog.exportProperty(screenstitch.Host.prototype, 'getConnectUri', 
    screenstitch.Host.prototype.getConnectUri);
goog.exportProperty(screenstitch.Host.prototype, 'getCode', 
    screenstitch.Host.prototype.getCode);
goog.exportProperty(screenstitch.Host.prototype, 'connect', 
    screenstitch.Host.prototype.connect);
