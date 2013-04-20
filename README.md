ScreenStitch
========

#### JavaScript Library for Connecting Device UI to Desktop UI via Sockets ####

This project allows connecting a device to a desktop so that the device can act as a user interface. It is currently very new so it probably shouldn't be used in production situations, just a starting point for this tech. Also note the javascript api is very new so it will probably change a lot in the future.

Currently the only server implementation provided is via GoogleAppEngine's Channel API. Also the only server implementation is Django. This is limiting for 3rd party users, so in the future it would be nice to make it more generic and add more possible server options.

The javascript library can be built by navigating to the 'utils/build' folder and executing './build debug' from the command line. Or if you want the minified version call './build min'. The builder may ask for the location of the closure library on your computer which is necessary for building.

### Usage ###

The example django project acts as a skeleton. You can add it to your GoogleAppEngineLauncher and run it locally to see the example. Note: Sockets work differently when running locally rather than on the server. It will be much slower locally, since the local implementation uses polling to fake sockets. 

The skeleton contains a single application called screenstitch which provides the server hooks for the socket code. Currently it uses templates in the two applications to show an example of how to use the file. Basically, this host connects to the index file, which generates a session key. Then the device would loads the url '/connect/' or processes a qr code to complete the link.

For the host, the code to initialize would be:
```html
var host = new screenstitch.Host();
host.listen('status', function() {
    var status = host.getStatus();
    if (status == screenstitch.Status.CONNECTED) {
      alert('connected');
    }
  });
host.connect();
```

For the device, the code to initialize would be:
```html
var controller = new screenstitch.Controller();
controller.listen('status', function() {
    var status = controller.getStatus();
    if (status == screenstitch.Status.CONNECTED) {
      alert('connected');
    }
  });
  
// Connect, this will only work if the server inserted the key on page load
controller.connect();

// Otherwise we need an input form and on submit call 
// controller.connect(input.value);
```

In javascript you can send basic events from host to device or device to host by  calling sendEvent on either a Controller or Host object:

```html
sendEvent({type:'alert', message:'a message'});
```

The event will then be received on the other end, if the other client had setup a listenr for that event type.

Note: events are not throttled so you shouldn't use them for data that goes quickly across the network (real-time), since each message requires a POST. Instead call sendEventStream(name, data, opt_event). This method will add the data to a buffer and send the buffer at a throttled pace. 

So if you were processing a touch drag you would do:

```html
document.body.onmousemove = function(e) {
    controller.sendEventStream('touch', {x:e.clientX, y:e.clientY});
  });
```html
