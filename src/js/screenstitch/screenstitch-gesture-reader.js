goog.provide('screenstitch.GestureReader');


/**
 * An object used to deserialize a continuous data stream like accelerometer 
 * data or touch movement data.
 * @param {string} name The name of the event stream.
 * @param {goog.events.EventTarget} dispatcher Used to dispatch the events.
 * @constructor
 */
screenstitch.GestureReader = function(name, dispatcher)
{
  /**
   * The readable name of the gesture.
   * @type {string}
   * @private
   */
  this.name_ = name;
  
  /**
   * An ordered array of property names that will be coming over the wire.
   * @type {Array.<string>}
   * @private
   */
  this.propertyNames_ = [];
  
  /**
   * The number of properties per event.
   * @private
   */
  this.propertyCount_ = 0;
  
  /**
   * An ordered array of events to dispatch at the correct time.
   * @type {Array.<Object>}
   * @private
   */
  this.eventQueue_ = [];
  
  /**
   * @type {number}
   * @private
   */
  this.eventQueueSize_ = 0;
  
  /**
   * @type {goog.events.EventTarget}
   * @private
   */
  this.dispatcher_ = dispatcher;
};

/**
 * Updates the internal protocol representation.
 * @param {Array.<string>} input The protocol.
 * @param {number} Position in the input to read from.
 * @return {number} The new position in the stream after reading.
 */
screenstitch.GestureReader.prototype.readProtocol = function(input, pos)
{
  // First item is the property count
  this.propertyCount_ = input[pos++];
  
  // TODO: maybe a sanity check in case there is a stream error.
  
  for (var i = 0; i < this.propertyCount_; ++i) {
    this.propertyNames_[i] = input[pos++];
  }
  
  return pos;
};

/**
 * Reads an event from the data stream.
 * @param {number} startTime The start time to which timestamps are relative.
 * @param {number} startTimeAccurate A more accurate start time which may result 
 *                 in events staying in sync better, but lose some detail.
 * @type {Array.<string>} input The data stream.
 * @type {number} pos Position in the input to read from.
 * @return {number} The new position in the stream after reading.
 */
screenstitch.GestureReader.prototype.readData = function(startTime, startTimeAccurate, input, pos)
{
  var event = {};   // TODO: maybe use an event pool

  if (input[pos] === '_start') { // If there is an event tag insert it
    // Start event, make note of the time
    event.type = this.name_ + 'start';
    pos++;
  } else if (input[pos] === '_end') {
    event.type = this.name_ + 'end';
    pos++;
  } else {
    event.type = this.name_ + 'change';
  }

  // TODO: we could add type information to the protocol and coerce values
  // here to numbers, strings, etc.
  for (var i = 0; i < this.propertyCount_; ++i) {
    event[this.propertyNames_[i]] = input[pos++];
  }
  
  // Convert the event's time into our time so we know when to call it
  event.dispatchTime = parseInt(event['_time']) + startTime;
  
  this.eventQueue_[this.eventQueueSize_++] = event;
  
  if (this.eventQueueSize_ === 1) {
    setTimeout(goog.bind(this.dispatch_, this), 0);
  }

  return pos;
};

/**
 * Dispatches any events that are ready.
 * @private
 */
screenstitch.GestureReader.prototype.dispatch_ = function()
{
  var realTime = new Date().getTime();
  var time = realTime + 15;

  for (var i = 0; i < this.eventQueueSize_; ++i) {
    var event = this.eventQueue_[i];

    // Avoid dispatching data that will be changed immediately
    if (i < this.eventQueueSize_ - 1) {
      var nextEvent = this.eventQueue_[i + 1];
      if (nextEvent.type === event.type && nextEvent.dispatchTime <= time) {
        continue;
      }
    }
    
    if (this.eventQueue_[i].dispatchTime <= time) {
      this.dispatcher_.dispatchEvent(event);
    } else {
      break;
    }
  }

  if (i) {
    this.eventQueueSize_ -= i;
    var completedEvents = this.eventQueue_.splice(0, i);
  }
  
  if (this.eventQueueSize_) {
    var delay = this.eventQueue_[0].dispatchTime - new Date().getTime();
    if (delay < 5) {
      delay = 5;
    }
    
    setTimeout(goog.bind(this.dispatch_, this), delay);
  }
};
