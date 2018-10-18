#!/bin/bash

function html_query () {
    psql -H  -a -d slotrrr -q -c "$@"
}
echo "<h1>Anzahl gewonnene Rennen pro Fahrer</h1><br>"
html_query "with winners as (select distinct on (race::integer) driver from laps where lap = 10 order by race::integer, clock)
select driver, count(*) from winners group by 1 order by 2 desc;"
echo "<h1>Anzahl gewonnene Rennen pro Spur</h1><br>"
html_query "with winners as (select distinct on (race::integer) track from laps where lap = 10 order by race::integer, clock)
select track, count(*) from winners group by 1 order by 1;"
echo "<h1>Anzahl gefahrene Runden</h1><br>"
html_query "select driver, count(*) from laps group by driver order by count(*) desc;"
echo "<h1>Schnellste Runden je Track</h1><br>"
html_query "select distinct on(track) track, driver, time from laps where time > 9 order by track, time asc;"
echo "<h1>Schnellste Runde je Track für alle Fahrer</h1><br>"
html_query "select distinct on(driver, track) driver, track, time from laps where time > 9 order by driver, track, time asc;"
