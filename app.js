var path = require('path');
var fs = require('fs');
var events = require('events');
var util = require('util');
var http = require('http');
var express = require('express');
var notemplate = require('express-notemplate');
var pg = require('pg');
var child_process = require('child_process');

if (process.argv.length != 4) {
    console.log('usage:', process.argv[1], ' <serial-input> <race-definition-file>');
    process.exit(1);
}

var serialInput = process.argv[2];
var raceDefinitionFile = process.argv[3];

function makeRaces(drivers) {
    var races = [];
    for (var raceNumber = 0; raceNumber < drivers.length; raceNumber++) {
        var tracks = [];
        for (var track = 0; track < 4; track++) {
                tracks.push({ number: track + 1, rank: track, driverName: drivers[(raceNumber + track) % drivers.length] });
        }
        races.push({ number: raceNumber + 1, tracks: tracks });
    }
    return races;
}

var roundName = raceDefinitionFile ? raceDefinitionFile.replace(/.*?([^\/.]+)[^\/]*$/, "$1") : 'test';
var statisticsFileName = roundName + '-results.xls';
var logFileName = roundName + '-log.json';
var races = JSON.parse(fs.readFileSync(raceDefinitionFile));
var race = null;

var logStream = fs.createWriteStream(logFileName, { flags: 'a' });
function log(message) {
    logStream.write((new Date).toString() + ' ' + JSON.stringify(message) + "\n");
}

var timeRemaining = 0;
var time = "";
var zeroCharCode = '0'.charCodeAt(0);
var timeMessage = { type: 'time' };

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
            if (race) {
                timeMessage.lap = ++race.laps[timeMessage.track];
                if (!time.match(/>>/)) {                        // first lap has no time
                    timeMessage.time = parseFloat(time);
                }
                processDS030Message(timeMessage);
            }
            timeMessage = { type: 'lap' };
        }
    } else {
        switch(byte) {
        case 0x80: case 0x40: case 0x20: case 0x10:
            time = '';
            timeRemaining = 3;
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
            timeMessage.isBestLap = true;
            break;
        case 0xb3:
            break;
        default:
            console.log('uninterpreted DS-030 byte', byte.toString(16));
        }
    }
}

if (!serialInput) {
    console.log('no DS-030 input provided, running without data');
} else if (serialInput.match(/^\/dev\//)) {
    var SerialPort = require('serialport2').SerialPort;
    var port = new SerialPort();

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
    socket.emit('race', { race: race,
                          nextRaces: races });
}

io.sockets.on('connection', function (socket) {
    socket.on('disconnect', function () {
        console.log('client disconnected');
        clients.splice(clients.indexOf(socket), 1);
    });
    sendRaceStatus(socket);
    clients.push(socket);
});

function processDS030Message(message) {
    if (!race && message.type != 'ready') {
        return;
    }
    if (race && message.type != 'lap') {
        race.lastMessage = message;
    }
    switch (message.type) {
    case 'ready':
        if (!race || !race.paused) {
            if (!races.length) {
                race = undefined;
                return;
            }
            race = races[0];
            race.laps = [0, 0, 0, 0];
            races.shift();
        }
        clients.forEach(sendRaceStatus);
        log({ beginRace: race });
        break;
    case 'lap':
        var track = race.tracks[message.track];
        track.lap = message.lap;
        track.lastLap = message.time;
        if (!track.bestLap || message.isBestLap) {
            track.bestLap = message.time;
        }
        break;
    case 'pause':
        race.paused = true;
        break;
    case 'go':
        race.running = true;
        race.paused = false;
        break
    case 'raceEnded':
    case 'raceAborted':
        race.running = false;
        break;
    }
    console.log('sending', message, 'to', clients.length, 'clients');
    clients.forEach(function (socket) {
        socket.emit('message', message);
    });
    log(message);
}

app.get('/', function (req, res) {
    res.redirect('/race-monitor.html');
});

app.post('/races', function (req, res) {
    console.log('races changed:', req.body);
    races = req.body;
    clients.forEach(sendRaceStatus);
});

app.put('/time', function (req, res) {
    console.log('set time', req.body.time);
    child_process.exec('sudo date -s "' + req.body.time + '"',
                       function (error, stdout, stderr) {
                           if (error != null) {
                               console.log('error setting time', error);
                           }
                           if (stdout) {
                               console.log('set time - stdout:', stdout);
                           }
                           if (stderr) {
                               console.log('set time - stderr:', stderr);
                           }
                       });
});

app.get('/slotmania.html', function (req, res) {
    res.redirect('/race-monitor.html');
});

server.listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'));
});

