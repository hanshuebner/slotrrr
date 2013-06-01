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

var serialInput = process.argv[2];

function makeRaces(drivers) {
    var races = [];
    for (var raceNumber = 0; raceNumber < drivers.length; raceNumber++) {
        var race = [];
        for (var track = 0; track < 4; track++) {
            race.push({ number: track + 1, rank: track, driverName: drivers[(raceNumber + track) % drivers.length] });
        }
        races.push(race);
    }
    return races;
}

var races = makeRaces(['Christoph', 'Andreas', 'Olaf', 'Hans', 'Henrik', 'Michel', 'Patrick']);
var raceIndex = 0;
var nextRaceIndex = 1;

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
            processDS030Message(timeMessage);
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
            processDS030Message({ type: 'ready' });
            break;
        case 0xa1:
            processDS030Message({ type: 'set' });
            break;
        case 0xa2:
            processDS030Message({ type: 'go' });
            laps = [0, 0, 0, 0];
            break;
        case 0xa3:
            processDS030Message({ type: 'pause' });
            break;
        case 0xa4:
            processDS030Message({ type: 'raceEnded' });
            break;
        case 0xa5:
            processDS030Message({ type: 'raceAborted' });
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

if (!serialInput) {
    console.log('no DS-030 input provided, running without data');
} else if (serialInput.match(/^\/dev\//)) {
    port.on('data', function(data) {
        for (var i = 0; i < data.length; i++) {
            processByte(data[i]);
        }
    });

    port.on('error', function(err) {
        console.log('serial port error:', err);
    });

    port.open(serialInput, {
        baudRate: 4800,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
    }, function(err) {
        if (err) throw err;
        console.log('serial port open');
    });
} else {
    var serialInputData = JSON.parse(fs.readFileSync(serialInput));
    var serialInputPointer = 0;
    console.log('read', serialInputData.length, 'bytes of timed serial data');

    function sendNextSerialByte() {
        processByte(serialInputData[serialInputPointer][1]);
        if (++serialInputPointer == serialInputData.length) {
            serialInputPointer = 0;
        }
        setTimeout(sendNextSerialByte, serialInputData[serialInputPointer][0]);
    }

    sendNextSerialByte();
}

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
io.set('log level', 1);

var clients = [];

function sendRaceStatus(socket) {
    console.log('sendRaceStatus, race', races[raceIndex]);
    socket.emit('race', { race: races[raceIndex],
                          nextRace: races[nextRaceIndex] });
}

io.sockets.on('connection', function (socket) {
    socket.on('disconnect', function () {
        console.log('client disconnected');
        clients.splice(clients.indexOf(socket), 1);
    });
    sendRaceStatus(socket);
    clients.push(socket);
});

function nextRace()
{
    if (nextRaceIndex == 0) {
        races = makeRaces(['Christoph', 'Andreas', 'Olaf', 'Hans', 'Henrik', 'Michel', 'Patrick']);
    }
    raceIndex = nextRaceIndex;
    nextRaceIndex++;
    if (nextRaceIndex == races.length) {
        nextRaceIndex = 0;
    }
    clients.forEach(sendRaceStatus);
}

function processDS030Message(message) {
    switch (message.type) {
    case 'ready':
        nextRace();
        break;
    case 'lap':
        var track = races[raceIndex][message.track];
        track.lap = message.lap;
        track.lastLap = message.time;
        if (!track.bestLap || message.isBestLap) {
            track.bestLap = message.time;
        }
        break;
    }
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

