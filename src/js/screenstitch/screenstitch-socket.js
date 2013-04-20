/**
 * @fileoverview Class definition for the screenstitch socket. A wrapper around
 * the channel and socket objects provided by the google appengine channel api.
 *
 * @author dan@leftfieldlabs.com (Dan Riley)
 */

goog.provide('screenstitch.Socket');

goog.require('screenstitch');

goog.require('goog.net.XhrIo');
goog.require('goog.events.EventTarget');


/**
 * @param {string=} opt_connectUri The uri to send connection to. If not
 *                  provided the global screenstitch.URI will be used.
 * @constructor
 * @extends {goog.events.EventTarget}
 */
screenstitch.Socket = function(opt_connectUri)
{
  // Call super
  goog.events.EventTarget.call(this);

  /**
   * @type {function}
   */
  this.onOpen = null;
  
  /**
   * @type {function}
   */
  this.onClose = null;
  
  /**
   * @type {function(message: string)}
   */
  this.onMessage = null;
  
  /**
   * @type {function(code: string|number, description: string)}
   */
  this.onError = null;
  
  /**
   * A pool of xhr objects in case requests are hapenning too fast.
   * @type {Array.<goog.net.XhrIo>}
   */
  this.xhrPool_ = [];

  /**
   * A url to connect to the server with.
   * @type {string}
   * @private
   */
  this.connectUri_ = opt_connectUri || screenstitch.URI;
  
  if (this.connectUri_.charAt(this.connectUri_.length - 1) !== '/') {
    this.connectUri_ = this.connectUri_ + '/';
  }
  
  /**
   * A url to connect to the server with.
   * @type {?string}
   * @private
   */
  this.endpointUri_ = null;
  
  /**
   * Quick lookup of xhr pool size.
   * @type {number}
   * @private
   */
  this.xhrPoolSize_ = 0;
  
  /**
   * The key used to connect to the server.
   * @type {string?}
   * @private
   */
  this.key_ = null;
  
  /**
   * The secret token returned form the server on successful connection.
   * @type {string?}
   * @private
   */
  this.token_ = null;
  
  /**
   * Not currently in use but could be used to store a client id.
   * @type {string?}
   * @private
   */
  this.id_ = null;
  
  /**
   * The channel for appengine-specific channel.
   * @type {appengine.Channel?}
   * @private
   */
  this.channel_ = null;
  
  /**
   * @type {appengine.Socket?}
   * @private
   */
  this.socket_ = null;
  
  /**
   * A cached string used to post messages to the server, so we don't have to
   * re-concat every time. Maybe not necessary.
   * @type {string}
   * @private
   */
  this.messageBase_ = '';
  
  /**
   * Map socket handler events to our handlers.
   * @type {Object}
   */
  this.socketHandler_ = {'onopen':goog.bind(this.notifyOpen_, this),
        'onmessage':goog.bind(this.notifyMessage_, this),
        'onerror':goog.bind(this.notifyError_, this),
        'onclose':goog.bind(this.notifyClose_, this)};
        
};
goog.inherits(screenstitch.Socket, goog.events.EventTarget);

screenstitch.Socket.prototype.getUri = function()
{
  return this.connectUri_;
};

/**
 * Returns the key used to create the channel between the socket and the server.
 * @return {string?} The key or null if doesn't have one.
 */
screenstitch.Socket.prototype.getKey = function()
{
  return this.key_;
};

/**
 * Returns the client id assigned to this socket after the channel is created.
 * @return {string?} The client id or null if doesn't have one.
 */
screenstitch.Socket.prototype.getClientId = function()
{
  return this.id_;
};

/**
 * Connects to the server with the given information.
 * @param {string=} opt_key The key to use to connect to the server with. If no
 *                  key is given we look for a global key set on screenstitch.KEY. 
 *                  The global should be ok since only one channel is allowed
 *                  per page anyway.
 * @returns {boolean} Whether the call resulted in contacting the server.
 */
screenstitch.Socket.prototype.connect = function(opt_key)
{ 
  if (opt_key || screenstitch.KEY) {
    if (this.socket_) {
      this.disconnect();
    }
  
    var xhr = this.createXhr_();

    if (xhr) {
      this.key_ = opt_key || screenstitch.KEY;
  
      goog.events.listen(xhr, goog.net.EventType.COMPLETE,   
          this.completeConnection_, false, this);
      
      xhr.send(this.connectUri_ + this.key_, 'POST');
      return true;
    }
  }
  
  return false;
};

/**
 * Connects to the server and generates a key for a new session.
 * @returns {boolean} Whether the call resulted in contacting the server.
 */
screenstitch.Socket.prototype.generateKey = function()
{ 
  if (this.socket_) {
    this.disconnect();
  }

  var xhr = this.createXhr_();

  if (xhr) {
    goog.events.listen(xhr, goog.net.EventType.COMPLETE,   
        this.completeConnection_, false, this);
    
    xhr.send(this.connectUri_, 'POST');
    return true;
  }
  
  return false;
};

/**
 * Used to test if there is a key provided either through args or through
 * the globals.
 * @return {boolean} Whether we have the necessary key to connect to a host.
 */
screenstitch.Socket.prototype.canConnectToHost = function(opt_key)
{
  return !!(opt_key || screenstitch.KEY);
};


/**
 * Disconnects from the channel and resets the socket so it can be used again
 * by calling @see connect.
 */
screenstitch.Socket.prototype.disconnect = function()
{
  if (this.socket_) {
    this.socket_.close();
    this.socket_.onopen = null;
    this.socket_.onclose = null;
    this.socket_.onmessage = null;
    this.socket_.onerror = null;
    this.socket_ = null;
  }

  this.channel_ = null;
  this.token_ = null;
  this.key_ = null;
  this.id_ = null;
  this.messageBase_ = null;
};


/**
 * Creates an XhrIo from the pool.
 * @return {goog.net.XhrIo} The xhr.
 */
screenstitch.Socket.prototype.createXhr_ = function()
{
  var xhr;
  
  if (this.xhrPoolSize_) {
    xhr = this.xhrPool_[--this.xhrPoolSize_];
  } else {
    xhr = new goog.net.XhrIo();
    goog.events.listen(xhr, goog.net.EventType.COMPLETE, this.releaseXhr_,
        false, this);
  }
  
  return xhr;
};

/**
 * Releases or destroys teh xhr.
 * @param {goog.events.Event|goog.net.XhrIo}
 * @private
 */
screenstitch.Socket.prototype.releaseXhr_ = function(xhr)
{
  if (xhr) {
    xhr = xhr.currentTarget || xhr;
    
    // Re-pool the xhr only if we have a connection, otherwise pass it off to
    // the garbage collector.
    if (this.socket_) {
      this.xhrPool_[this.xhrPoolSize_++] = xhr;
    } else {
      goog.events.unlisten(xhr, goog.net.EventType.COMPLETE, this.releaseXhr_,
        false, this);
    }
  }
};


/**
 * Sends a message to the server.
 * @param {message} message A string to send, this should probably be encoded.
 */
screenstitch.Socket.prototype.sendMessage = function(message)
{
  if (this.endpointUri_) {
    var xhr = this.createXhr_();
  
    if (xhr) {  
      xhr.send(this.endpointUri_, 'POST', this.messageBase_ + message);
    }
  }
};


/**
 * Sets the token and creates the channel.
 * @param {string} token The token used to create the socket channel.
 * @param {string=} opt_id A client id, if provided it will be sent with each
 *                  message to the server.
 * @private
 */
screenstitch.Socket.prototype.initConnection_ = function(token, endpoint, opt_id)
{
  goog.asserts.assert(!this.socket_, 'no socket');
  
  this.token_ = token;
  this.endpointUri_ = endpoint;
  this.id_ = opt_id;
  
  this.messageBase_ = 'k=' + this.key_;
  if (this.id_) this.messageBase_ += '&f=' + this.id_;
  this.messageBase_ += '&m=';
  
  this.channel_ = new appengine.Channel(token);
  this.socket_ = this.channel_.open(this.socketHandler_);
};

/**
 * Channel open callback. Notifies any observers.
 * @private
 */
screenstitch.Socket.prototype.notifyOpen_ = function()
{
  if (this.onOpen) {
    this.onOpen();
  }
};

/**
 * Channel message callback. Notifies observer, this contains appengine channel
 * api specific properties.
 * @param {{data: string}} message The message data.
 * @private
 */
screenstitch.Socket.prototype.notifyMessage_ = function(message)
{
  if (this.onMessage) {
    this.onMessage(message['data']);
  }
};

/**
 * Channel error callback. Notifies observers.
 * @param {{code: string|number, description: string}}
 * @private
 */
screenstitch.Socket.prototype.notifyError_ = function(error)
{
  if (this.onError) {
    this.onError(error['code'], error['description']);
  }
};

/** 
 * The channel has been closed by the server or disconnected for some unknown
 * reason.
 * @private
 */
screenstitch.Socket.prototype.notifyClose_ = function()
{
  // Clear out the socket
  if (this.socket_) {
    this.socket_.onopen = null;
    this.socket_.onclose = null;
    this.socket_.onmessage = null;
    this.socket_.onerror = null;
    this.socket_ = null;
  }
  
  // This should clear any remaining items
  this.disconnect();
  
  if (this.onClose) {
    this.onClose();
  }
};

/**
 * Xhr callback for when we first request a token for a connection.
 * @private
 */
screenstitch.Socket.prototype.completeConnection_ = function(e)
{
  var error, xhr = e.currentTarget;

  if (xhr) {    
    goog.events.unlisten(xhr, goog.net.EventType.COMPLETE,   
          this.completeConnection_, false, this);
                                
    if (xhr.isSuccess()) {
      var response = xhr.getResponseJson();
      if (!response || response['error']) {
        error = response ? response['error'] : 'unknown';
      } else { // Make sure its correct
        if (!this.key_ || response['key'] == this.key_) {
          this.key_ = response['key'];
          this.initConnection_(response['token'], response['endpoint'],
              response['id']);
        }
      }
    } else {
      error = 'server';
    }
  } else {
    error = 'implementation';
  }
  
  if (error) {
    alert('socket error:' + (response ? response['error'] : 'unknown'));
    this.key_ = null;
  }
};
