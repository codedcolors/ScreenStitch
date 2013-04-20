/**
 * @fileoverview Class definition for the screenstitch client. An object that
 * handles socket events. And ascertains the status of the connection with 
 * another client.
 *
 * @author dan@leftfieldlabs.com (Dan Riley)
 */
 
goog.provide('screenstitch.Client');
goog.provide('screenstitch.ClientOptions');
goog.provide('screenstitch.Status');

goog.require('screenstitch.Socket');
goog.require('screenstitch.GestureReader');
goog.require('screenstitch.GestureWriter');

goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.EventTarget');
goog.require('goog.net.XhrIo');


/**
 * A set of options to configure the client. For now this just contains the uri
 * used to connect to the server but could be expanded in the future.
 * @constructor
 */
screenstitch.ClientOptions = function()
{
  this.uri = null;
};

/**
 * The client status. These are interpreted slightly differently for a host and
 * a controller.
 * @enum {string}
 */
screenstitch.Status = {
  'UNKNOWN':'unknown',              // Not initialized
  'CONTACTING':'contacting-server', // Requesting validation
  'DISCONNECTED':'disconnected',    // Connected to channel but no one else
  'CONNECTING':'connecting',        // Trying to connect
  'CONNECTED':'connected'           // Connected with channel
};

goog.exportSymbol('screenstitch.Status', screenstitch.Status, window);

/**
 * A socket client which establishes a connection via a socket with another
 * client.
 * @param {screenstitch.ClientOptions=} opt_options Configure options for client.
 * @constructor
 * @extends {goog.events.EventTarget}
 */
screenstitch.Client = function(opt_options)
{
  goog.events.EventTarget.call(this);

  /**
   * @type {?screenstitch.Socket}
   * @private
   */
  this.socket_ = null;
    
  /**
   * @type {screenstitch.Status}
   * @private
   */
  this.status_ = screenstitch.Status.UNKNOWN;

  /**
   * @type {screenstitch.ClientOptions}
   * @private
   */
  this.options_ = opt_options || new screenstitch.ClientOptions();
  
    
  /**
   * @type {Object.<string, screenstitch.GestureReader>}
   * @private
   */
  this.gestureReaders_ = {};
  
    
  /**
   * @type {Object.<string, screenstitch.GestureWriter>}
   * @private
   */
  this.gestures_ = {};
  
  /**
   * @type {number}
   * @private
   */
  this.gestureCount_ = 0;
  
  /**
   * Used to keep track of the difference between client time and host time.
   * @type {number}
   * @private
   */
  this.timeOffset_ = 0;
  
    
  /**
   * The start time of the next data buffer in ms.
   * @type {number}
   * @private
   */
  this.dataBufferStartTime_ = 0;
  
  /**
   * The duration of the next data buffer in ms.
   * @type {number}
   * @private
   */
  this.dataBufferDuration_ = 0;
  
  /**
   * The position/length of the next data buffer.
   * @type {number}
   * @private
   */
  this.dataBufferPos_ = 0;
  
  /**
   * The data buffer used to send continuous events.
   * @private
   */
  this.dataBuffer_ = [];

  /**
   * Timer used to throttle the continuous event buffer.
   * @type {goog.Timer}
   * @private
   */
  this.throttleTimer_ = new goog.Timer(screenstitch.POST_THROTTLE_MS);
  
  goog.events.listen(this.throttleTimer_, 'tick', this.sendBuffer_, 
      false, this);
      
  /**
   * @type {number}
   * @private
   */
  this.lastThrottle_ = 0;
  
  /**
   * @type {number}
   * @private
   */
  this.throttleTimeout_ = screenstitch.POST_THROTTLE_TIMEOUT_MS;
};
goog.inherits(screenstitch.Client, goog.events.EventTarget);

/**
 * Returns the socket. If the socket doesn't exist yet it creates it so only
 * call this method if the socket should already exist.
 * @return {screenstitch.Socket} The socket.
 * @protected
 */
screenstitch.Client.prototype.getSocket = function()
{
  if (!this.socket_) {
    this.socket_ = new screenstitch.Socket(this.options_.uri);
    this.socket_.onOpen = goog.bind(this.onSocketOpen, this);
    this.socket_.onMessage = goog.bind(this.onSocketMessage, this);
  }
  
  return this.socket_;
};

screenstitch.Client.prototype.listen = function(type, handler, opt_target)
{
  goog.events.listen(this, type, handler, false, opt_target);
};

screenstitch.Client.prototype.unlisten = function(type, handler, opt_target)
{
  goog.events.unlisten(this, type, handler, false, opt_target);
};


/**
 * Sends an object over the socket. This event object must be event-like so it
 * must have a type property.
 * @param {goog.events.EventLike} event
 */
screenstitch.Client.prototype.sendEvent = function(event)
{
  if (this.status_ === screenstitch.Status.CONNECTED) {
    if (event['type']) {
      this.socket_.sendMessage(JSON.stringify(event));
    } else {
      console.log('Events must have type property.');
    }
  }
};


/**
 * Call this like sendGestureData('accel', {'x':0, 'y':20})
 * Sends an event stream over the wire by compressing the data and attaching 
 * timestamps to each event so they can be replayed.
 * Posts are throttled to 250ms.
 * @param {string} name The readable name to send the event stream on.
 * @param {Object} data The data to send.
 * @param {string=} opt_event The type of evt for this data could be start/end.
 */ 
screenstitch.Client.prototype.sendEventStream = function(name, data, opt_event)
{
  if (this.status_ === screenstitch.Status.CONNECTED) {
    var protocol = this.gestures_[name];
  
    // Create the protocol if not done so and automatically assign a name.
    if (!protocol) {
      this.gestures_[name] = protocol = new screenstitch.GestureWriter(name, 
          'g' + this.gestureCount_++);
    }
  
    var pos = this.dataBufferPos_;
    var time = new Date().getTime();

    // If its the first event, not the start timestamp
    if (pos === 0) {
      this.dataBufferStartTime_ = time;
    }
    
    // Update the duration of the stream
    this.dataBufferDuration_ = time - this.dataBufferStartTime_;
    // Write the data to the stream
    this.dataBufferPos_ = protocol.writeData(data, 
                                this.dataBufferDuration_, 
                                this.dataBuffer_, 
                                this.dataBufferPos_, 
                                opt_event);
    
    // If its the first event start the throttle timer and send.
    if (pos === 0 && !this.throttleTimer_.enabled) {
      this.throttleTimer_.start();
      this.sendBuffer_(); // Send the first event immediately
    }
  }
};


/**
 * Returns the status of the client.
 * @return {screenstitch.Status}
 */
screenstitch.Client.prototype.getStatus = function()
{
  return this.status_;
};

/**
 * Called by implementations at various points in the connection process to
 * update the user about the status of the connection.
 * @param {screenstitch.Status} status The new status.
 * @protected
 */
screenstitch.Client.prototype.setStatus = function(status)
{
  if (status !== this.status_) {
    this.status_ = status;
    this.onStatusChange(this.status_);
    this.dispatchEvent(new goog.events.Event('status'));
  }
};

/**
 * Implementation hook for being updated about status changes.
 * @param {screenstitch.Status} status The new status.
 * @protected
 */
screenstitch.Client.prototype.onStatusChange = function(status)
{
};

/**
 * Called when a socket first opens. This means that we have a token from the
 * server but have yet to make a connection. Since the meaning of this depends
 * on if you are a host or controller, the implementation should update the
 * status here appropriately.
 * @param {string} message The message received from server.
 * @protected
 */
screenstitch.Client.prototype.onSocketOpen = function(e)
{
};

/**
 * Called from the socket when a message is received. Implementations can
 * override this, but shoud always call the super classes handler so we
 * can catch connection events.
 * @param {string} message The message received from server.
 * @protected
 */
screenstitch.Client.prototype.onSocketMessage = function(message)
{
  var messageFlag = message.charAt(0);
  
  if (messageFlag === '[') {
    // Split the message string into an array of even data
    var events = message.substr(1, message.length - 2).split(',');
    var pos = 0,  l = events.length;
    
    var startTimeClient = parseInt(events[pos++]);
    if (this.timeOffset_ === 0) {
      this.timeOffset_ = new Date().getTime() - startTimeClient;
    }
    
    var startTimeSmooth = new Date().getTime();//startTimeClient + this.timeOffset_;
    var startTimeAccurate = startTimeClient + this.timeOffset_;
    var duration = parseInt(events[pos++]);
    var timeScale = 1;//500 / duration;
    
    //if (timeScale > 1) {
    //  timeScale = 1;
    //}
    
    // Parse the data stream by passing off data blocks to various readers.
    // The readers then dispatch events when they parse events.
    while (pos < l) {
      // Each event starts with an event id, which should be first declared
      // with a register id, otherwise it will be ignored.
      var eventId = events[pos++];

      if (this.gestureReaders_[eventId]) {
        // There is a reader for this event type so pass the buffer to
        // the reader to parse
        pos = this.gestureReaders_[eventId].readData(startTimeSmooth, startTimeAccurate, events, pos);
      } else if (eventId === '_reg') {
        // Registering a new event type, create a reader for it and store it
        var name = events[pos++];
        var id = events[pos++];

        var reader = new screenstitch.GestureReader(name, 
            this);
            
        this.gestureReaders_[id] = reader;
        
        pos = reader.readProtocol(events, pos);
      }
    }
  } else if (messageFlag === '{') { // Its a json event
    try {
      this.dispatchEvent(JSON.parse(message));
    } catch (e) {
      console.log('Failed to parse message');
    }
  } else { // Its just a string event
    if (message === 'connected') {
      if (this.status_ === screenstitch.Status.CONNECTING ||
          this.status_ === screenstitch.Status.DISCONNECTED) {
        this.setStatus(screenstitch.Status.CONNECTED);
      }
    } else if (message === 'disconnected') {
      if (this.status_ === screenstitch.Status.CONNECTED) {
        this.setStatus(screenstitch.Status.DISCONNECTED);
      }
    }
  }
  
  
};


/**
 * Sends the gesture buffer.
 * @private
 */
screenstitch.Client.prototype.sendBuffer_ = function()
{
  var time = new Date().getTime();
  
  if (this.dataBufferPos_ > 0) {
    var buffer = '[' + this.dataBufferStartTime_ + ',' + 
        this.dataBufferDuration_ + ',';
    for (var i = 0; i < this.dataBufferPos_; ++i) {
      buffer += this.dataBuffer_[i] + ',';
    }

    this.getSocket().sendMessage(buffer);
    this.dataBufferPos_ = 0;
    this.dataBufferDuration_ = 0;
    this.dataBufferStartTime_ = 0;
    this.lastThrottle_ = time;
  } else if (time - this.lastThrottle_ > this.throttleTimeout_) {
    this.throttleTimer_.stop();
  }
};


goog.exportProperty(screenstitch.Client.prototype, 'getStatus', 
    screenstitch.Client.prototype.getStatus);
goog.exportProperty(screenstitch.Client.prototype, 'listen', 
    screenstitch.Client.prototype.listen);
goog.exportProperty(screenstitch.Client.prototype, 'unlisten', 
    screenstitch.Client.prototype.unlisten);
goog.exportProperty(screenstitch.Client.prototype, 'sendEvent', 
    screenstitch.Client.prototype.sendEvent);
goog.exportProperty(screenstitch.Client.prototype, 'sendEventStream', 
    screenstitch.Client.prototype.sendEventStream);



