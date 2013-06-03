'use strict';

var debugMessages = false;
var app = angular.module('raceManagerApp', ['$strap.directives', 'ngResource']);

function RaceManagerController($scope) {
    var socket = io.connect();
    socket.on('race', function (data) {
        if (debugMessages) {
            console.log('message', data);
        }
        $scope.nextRaces = data.nextRaces;
        $scope.$apply();
    });
}
RaceManagerController.$inject = ['$scope'];

app.directive('sortableRaces', [ '$resource', function ($resource) {
    return {
        restrict: 'A',
        link: function ($scope, element, attributes) {
            $scope.dragStart = function(e, ui) {
                ui.item.data('start', ui.item.index());
            }

            $scope.dragEnd = function(e, ui) {
                var start = ui.item.data('start');
                var end = ui.item.index();
                
                $scope.nextRaces.splice(end, 0, $scope.nextRaces.splice(start, 1)[0]);
                $scope.$apply();

                $resource('/races').save(JSON.stringify($scope.nextRaces));
            }

            $(element).sortable({
                start: $scope.dragStart,
                update: $scope.dragEnd
            });
        }
    };
}]);
