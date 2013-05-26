var path = require('path');
var fs = require('fs');
var events = require('events');
var util = require('util');
var http = require('http');
var express = require('express');
var notemplate = require('express-notemplate');
var SerialPort = require('serialport2').SerialPort;
var port = new SerialPort();

var deviceName = '/dev/cu.usbserial-FTCAAI6X';
var timeRemaining = 0;
var time = "";
var zeroCharCode = '0'.charCodeAt(0);

function driverIndex(mask) {
    for (var index = 0; ; mask <<= 1, index++) {
        if (mask & 0x80) {
            return index;
        }
    }
}

function processByte(byte) {
    if (timeRemaining) {
        time += String.fromCharCode(zeroCharCode + (byte >> 4));
        time += String.fromCharCode(zeroCharCode + (byte & 0x0f));
        if (timeRemaining == 3) {
            time += '.';
        }
        timeRemaining--;
        if (timeRemaining == 0) {
            console.log('time: ', time);
        }
    } else {
        switch(byte) {
        case 0x80: case 0x40: case 0x20: case 0x10:
            time = '';
            timeRemaining = 3;
            console.log('time for ', driverIndex(byte));
            break;
        case 0xa0:
            console.log('ready');
            break;
        case 0xa1:
            console.log('set');
            break;
        case 0xa2:
            console.log('go');
            break;
        case 0xa3:
            console.log('pause');
            break;
        case 0xa4:
            console.log('end of race');
            break;
        case 0xa5:
            console.log('race aborted');
            break;
        case 0xa7:
            console.log('bestzeit');
        case 0xb3:
            break;
        default:
            console.log(byte.toString(16));
        }
    }
}

port.on('data', function(data) {
    for (var i = 0; i < data.length; i++) {
        processByte(data[i]);
    }
});

port.on('error', function(err) {
    throw err;
});

port.open(deviceName, {
    baudRate: 4800,
    dataBits: 8,
    parity: 'none',
    stopBits: 1
}, function(err) {
    if (err) throw err;
    console.log('serial port open');
});

var app = express();

app.configure(function() {
    app.set('port', process.env.PORT || 3000);
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + '/uploads' }));
    app.use(express.methodOverride());
    app.use(express.cookieParser('blikdiblu'));
    app.use(express.session());
    app.use(app.router);
    app.set('statics', process.cwd() + '/public');
    app.engine('html', notemplate.__express);
    app.set('view engine', 'html');
    app.use(express.static(app.get('statics')));
});

app.configure('development', function() {
    app.use(express.errorHandler());
});

var server = http.createServer(app);
var io = require('socket.io').listen(server);

io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
})

server.listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'));
});
