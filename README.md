ScreenStitch
========

#### JavaScript Library for Connecting UI to Desktop UI via Sockets ####

This project allows connecting a device to a desktop so that the device can act as a user interface. It is currently very new so it probably shouldn't be used in production situations, just a starting point for this tech.

Currently the only server implementation provided is via GoogleAppEngine's Channel API. Also the only server implementation is Django. This is limiting for 3rd party users, so in the future it would be nice to make it more generic and add more possible server options.

The javascript library can be built by navigating to the 'utils/build' folder and executing './build debug' from the command line. Or if you want the minified version call './build min'. The builder may as for the location of the closure library on your computer which is necessary for building.

### Usage ###

The example django project acts as a skeleton. It contains a single application called screenstitch which provides the server hooks for the socket code. Currently it uses templates in the two applications to show an example of how to use the file. Basically the device would load the url '/connect/' and the host simply loads the index file. After the host connects to the index file it can pass the key to the device via a Qr code or a link.

In javascript you can send events across the sockets by calling:

host.sendEvent({type:'alert', message:'a message'});

In the current setup the controller will then receive an event of type 'alert' with the given data. This works the other way as well from controller to host. So a host might call sendEvent({type:'jump'}) to send a jump message, etc. Note: events are not throttled so you shouldn't use them for data that goes quickly across the network, since each message requires a POST. Instead call sendEventStream(name, data, opt_event); This method will add the data to a buffer and send the buffer at a throttled pace. So if you were processing a touch drag you would right sendEventStream('touch', {x:32, y:104}) to send touch data on mouse move.

