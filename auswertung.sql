\set echo all
-- <h1>Anzahl gewonnene Rennen</h1><br>
select driver, count(*) from laps where lap = 10 group by driver order by count(*) desc;
-- <h1>Anzahl gefahrene Runden</h1><br>
select driver, count(*) from laps group by driver order by count(*) desc;
-- <h1>Schnellste Runden je Track</h1><br>
select distinct on(track) driver, time from laps where time > 9 order by track, time asc;
-- <h1>Schnellste Runde je Track für alle Fahrer</h1><br>
select distinct on(driver, track) driver, track, time from laps where time > 9 order by driver, track, time asc;
