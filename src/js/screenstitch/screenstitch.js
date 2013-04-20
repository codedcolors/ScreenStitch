goog.provide('screenstitch');

/**
 * The global url used to communicate with the server if no specific url is
 * passed to the instance.
 * @type {string}
 */
screenstitch.URI = '/connect/';

/**
 * The global key, this is a way for the server to pass a key through html to
 * the javascript instance, this could also be passed to the instance itself.
 * @type {string}
 */
screenstitch.KEY = null;

/**
 * The number of milliseconds between posts. Data will be buffered.
 */
screenstitch.POST_THROTTLE_MS = 250;

/**
 * The number of milliseconds between posts. Data will be buffered.
 * @type {number}
 */
screenstitch.POLL_TIME_MS = 2000;

/**
 * The number of milliseconds after which if no dispatches are necessary, the
 * throttle timer stops.
 * @type {number}
 */
screenstitch.POST_THROTTLE_TIMEOUT_MS = 2000;

goog.exportSymbol('screenstitch.URI', screenstitch.URI, window);
goog.exportSymbol('screenstitch.KEY', screenstitch.KEY, window);