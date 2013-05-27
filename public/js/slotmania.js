'use strict';

var app = angular.module('slotmaniaApp', ['$strap.directives']);

app.directive('trackStatus', function () {
    return {
        restrict: 'E',
        replace: true,
        templateUrl: '/partials/track-status.html',
        scope: { track: '=track' }
    }
});

function SlotmaniaController($scope) {
    var socket = io.connect('http://localhost');
    $scope.track = [ { number: 1,
                       driverName: "Henrik" },
                     { number: 2,
                       driverName: "Olaf" },
                     { number: 3,
                       driverName: "Patrick" },
                     { number: 4,
                       driverName: "Andreas" } ];
    socket.on('message', function (data) {
        console.log('message', data);
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
