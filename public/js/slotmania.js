'use strict';

var debugMessages = false;
var app = angular.module('slotmaniaApp', ['$strap.directives']);

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
    var socket = io.connect('http://localhost');
    socket.on('race', function (data) {
        $scope.track = data.race;
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
            if (!track.bestLap || data.isBestLap) {
                track.bestLap = data.time;
            }
        }
        $scope.$apply();
    });
}
SlotmaniaController.$inject = ['$scope'];
