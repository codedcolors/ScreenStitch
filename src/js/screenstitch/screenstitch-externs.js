var appengine = {}; 

/**
 * The socket returned from channel open.
 * @constructor
 */
appengine.Socket = function() {};

/**
 * Closes the socket.
 */
appengine.Socket.prototype.close = function() {};

/**
 * @type {function}
 */
appengine.Socket.prototype.onopen;

/**
 * @type {function}
 */
appengine.Socket.prototype.onclose;

/**
 * @type {function({data: string})}
 */
appengine.Socket.prototype.onmessage;

/**
 * @type {function({code: string|number, description: string})}
 */
appengine.Socket.prototype.onerror;

/**
 * @param {string} token
 * @constructor
 */
appengine.Channel = function(token) {};

/**
 * @param {Object=} opt_handler
 * @return {appengine.Socket}
 */
appengine.Channel.prototype.open = function(opt_handler) {};

