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
    socket.on('news', function (data) {
      console.log(data);
      socket.emit('my other event', { my: 'data' });
    });
    $scope.track = [ { number: 1,
                       driverName: "Henrik" },
                     { number: 2,
                       driverName: "Olaf" },
                     { number: 3,
                       driverName: "Patrick" },
                     { number: 4,
                       driverName: "Andreas" } ];
}
SlotmaniaController.$inject = ['$scope'];
