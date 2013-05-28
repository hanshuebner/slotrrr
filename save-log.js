var SerialPort = require('serialport2').SerialPort;
var port = new SerialPort();

var deviceName = '/dev/cu.usbserial-FTCAAI6X';

function getTime()
{
    return new Date().getTime();
}

var lastTime = getTime();

port.on('data', function(data) {
    var delta = getTime() - lastTime;
    lastTime = getTime();
    for (var i = 0; i < data.length; i++) {
        console.log('[', delta, ',', data[i], '],');
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

