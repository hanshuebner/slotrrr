var fs = require('fs');

if (process.argv.length < 5) {
    console.log('usage:', process.argv[1], '<output-json-filename> <driver> <driver> ...');
    process.exit(1);
}

var outputFilename = process.argv[2];
var drivers = process.argv.slice(3);

var races = [];
for (var raceNumber = 0; raceNumber < drivers.length; raceNumber++) {
    var tracks = [];
    for (var track = 0; track < 4; track++) {
        tracks.push({ number: track + 1, rank: track, driverName: drivers[(raceNumber + track) % drivers.length] });
    }
    races.push({ tracks: tracks, number: 1 + raceNumber });
}

fs.writeFileSync(outputFilename, JSON.stringify(races, null, "  "));
