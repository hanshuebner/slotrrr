var path = require('path');
var fs = require('fs');
var events = require('events');
var util = require('util');
var http = require('http');
var express = require('express');
var notemplate = require('express-notemplate');
var pg = require('pg');
var SerialPort = require('serialport2').SerialPort;
var port = new SerialPort();

var deviceName = '/dev/cu.usbserial-FTCAAI6X';
var timeRemaining = 0;
var time = "";
var zeroCharCode = '0'.charCodeAt(0);
var timeMessage = { type: 'time' };
var laps = [0, 0, 0, 0];

function trackIndex(mask) {
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
            timeMessage.lap = ++laps[timeMessage.track];
            console.log('time: ', time);
            if (!time.match(/>>/)) {                        // first lap has no time
                timeMessage.time = parseFloat(time);
            }
            sendMessage(timeMessage);
            timeMessage = { type: 'lap' };
        }
    } else {
        switch(byte) {
        case 0x80: case 0x40: case 0x20: case 0x10:
            time = '';
            timeRemaining = 3;
            console.log('time for ', trackIndex(byte));
            timeMessage.track = trackIndex(byte);
            break;
        case 0xa0:
            sendMessage({ type: 'ready' });
            break;
        case 0xa1:
            sendMessage({ type: 'set' });
            break;
        case 0xa2:
            sendMessage({ type: 'go' });
            laps = [0, 0, 0, 0];
            break;
        case 0xa3:
            sendMessage({ type: 'pause' });
            break;
        case 0xa4:
            sendMessage({ type: 'raceEnded' });
            break;
        case 0xa5:
            sendMessage({ type: 'raceAborted' });
            break;
        case 0xa7:
            console.log('bestzeit');
            timeMessage.isBestLap = true;
            break;
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
    console.log('serial port error:', err);
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
var clients = [];

io.set('log level', 1);
io.sockets.on('connection', function (socket) {
    socket.on('disconnect', function () {
        console.log('client disconnected');
        clients.splice(clients.indexOf(socket), 1);
    });
    socket.emit('message', { type: 'hello' });
    clients.push(socket);
});

function sendMessage(message) {
    console.log('sending', message, 'to', clients.length, 'clients');
    clients.forEach(function (socket) {
        socket.emit('message', message);
    });
}

app.get('/', function (req, res) {
    res.redirect('/slotmania.html');
});

server.listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'));
});

function makeRaces(drivers) {
    var races = [];
    for (var raceNumber = 0; raceNumber < drivers.length; raceNumber++) {
        var race = [];
        for (var track = 0; track < 4; track++) {
            race.push({ trackNumber: track, driverName: drivers[(raceNumber + track) % drivers.length] });
        }
        races.push(race);
    }
    return races;
}

console.log('races', makeRaces(['Christoph', 'Andreas', 'Olaf', 'Hans', 'Henrik', 'Michel', 'Patrick']));
