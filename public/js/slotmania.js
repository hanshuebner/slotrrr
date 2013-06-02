'use strict';

var debugMessages = false;
var app = angular.module('slotmaniaApp', ['$strap.directives']);

function getTime()
{
    return new Date().getTime();
}

app.directive('trackStatus', function () {
    return {
        restrict: 'E',
        replace: true,
        templateUrl: '/partials/track-status.html',
        scope: { track: '=track' }
    }
});

app.filter('lapTime', function () {
    return function (time) {
        if (time) {
            return time + "s";
        }
    }
});

function SlotmaniaController($scope) {
    var socket = io.connect();
    $scope.race = {};

    function calculateRanks() {
        var ranking = $scope.track.slice();
        ranking.sort(function (track1, track2) {
            var lap1 = track1.lap || -1;
            var lap2 = track2.lap || -1;
            if (lap1 == lap2) {
                return track1.lapTimestamp > track2.lapTimestamp;
            } else {
                return lap1 < lap2;
            }
        });
        var rank = 0;
        ranking.forEach(function (track) {
            track.rank = rank++;
        });
    }
    
    socket.on('race', function (data) {
        $scope.track = data.race;
        $scope.race.tracks = data.race;
        $scope.nextRace = data.nextRace;
        $scope.$apply();
    });
    socket.on('message', function (data) {
        if (debugMessages) {
            console.log('message', data);
        }
        if (data.type == 'lap') {
            var track = $scope.track[data.track];
            track.lap = data.lap;
            track.lastLap = data.time;
            track.lapTimestamp = getTime();
            if (!track.bestLap || data.isBestLap) {
                track.bestLap = data.time;
            }
            calculateRanks();
        } else {
            $scope.raceStatus = data.type;
            var raceStatusText = {
                ready: 'Fertig',
                set: 'Los',
                go: 'Rennen läuft',
                pause: 'Rennen unterbrochen',
                raceEnded: 'Rennen beendet',
                raceAborted: 'Rennen abgebrochen'
            };
            $scope.raceStatusText = raceStatusText[data.type];
        }
        $scope.$apply();
    });
}
SlotmaniaController.$inject = ['$scope'];

if (window.location.hash == '#tracks') {
    $('#layout-stylesheet').attr('href', '/css/tracks.css');
}
