goog.provide('screenstitch.GestureWriter');

/**
 * An object used to serialize a continuous data stream like accelerometer data
 * or touch movement data. This protocol minimizes the amount of data and also
 * timestamps each event so it can be replayed on the other side.
 * @param {string} name The name of the event stream.
 * @param {string} id The assigned id used to actually represent in the stream.
 * @constructor
 */
screenstitch.GestureWriter = function(name, id)
{
  /**
   * The name is the readable name that the user will use.
   * @type {string}
   * @private
   */
  this.name_ = name;
  
  /**
   * The id is a non-readable name used in the stream to minimize size.
   * @type {string}
   * @private
   */
  this.id_ = id;
  
  /**
   * Object used to hold the values passed over.
   * @type {object} 
   * @private
   */
  this.properties_ = {'_time':0};
};

/**
 * Writes the protocol to the given buffer when it is changed. This declares the
 * name and associates the id, and the order of parameters.
 * @param {Array.<string|number>} out The buffer to write to.
 * @param {number} pos The position in the buffer to start writing to.
 * @return {number} The new position in the buffer after writing.
 * @private
 */
screenstitch.GestureWriter.prototype.writeProtocol_ = function(out, pos)
{
  out[pos++] = '_reg';      // Write the protocol register flag
  out[pos++] = this.name_;  // Write the readable name
  out[pos++] = this.id_;    // Write the encoded name
  
  var numProps = 0;
  var numPropsIndex = pos++;  // Store the slot we need to put the prop count
  for (var prop in this.properties_) {
    numProps++;
    out[pos++] = prop;        // Write each property name
  }
  
  out[numPropsIndex] = numProps; // Fill in the property count
  return pos;
};

/**
 * Writes the given data object to the given buffer. The data object passed in
 * is not retained so it can be re-used for memory efficiency.
 * @param {object} data The new data values.
 * @param {number} time The timestamp for the event. This is relative to the
 *                      start of the stream.
 * @return {number} The new position in the buffer after writing.
 */
screenstitch.GestureWriter.prototype.writeData = function(data, time, out, 
    pos, opt_event)
{
  var prop, protocolChanged = false;
  
  // Go through and see if the protocol has changed (a new item has been added)
  for (prop in data) {
    if (!this.properties_[prop]) {
      protocolChanged = true;
    }
    
    this.properties_[prop] = data[prop];
  }
  
  // Update the time property.
  this.properties_['_time'] = time;

  // If the protocol is updated add that to the data stream, this should rarely
  // if ever happen except for the first time.
  if (protocolChanged) {
    pos = this.writeProtocol_(out, pos);
  }
  
  // Write the id
  out[pos++] = this.id_;
  
  // It is sometimes important to mark the event with some flag such as the
  // start or end of a gesture so we do that here.
  if (opt_event && (opt_event === '_start' || opt_event === '_end')) {
    out[pos++] = opt_event
  }
  
  // Write out each property value.
  for (prop in this.properties_) {
    out[pos++] = this.properties_[prop];
  }
  
  return pos;
};





