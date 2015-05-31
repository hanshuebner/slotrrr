;; -*- Lisp -*-

;; tabelle:
;; create sequence event_id;
;; create table laps (event_id integer default nextval('event_id'), round varchar, race integer, clock timestamp, driver varchar, track integer, lap integer, time float);

(defpackage :load-race-log
  (:use :cl :alexandria))

(in-package :load-race-log)

(defun string-to-keyword (string)
  (intern (string-upcase (ppcre:regex-replace-all "(?=[A-Z])" string "-")) :keyword))

(defun parse-race-log (pathname)
  (with-open-file (f pathname)
    (let (log
          (race 0)
          (ended t)
          winner
          (round-name (ppcre:regex-replace "-log" (pathname-name pathname) ""))
          (track-drivers (make-hash-table)))
      (loop
        (let ((input-line (or (read-line f nil)
                              (return (nreverse log)))))
          (destructuring-bind (clock message) (ppcre:split " (?={)" input-line)
            (let ((clock (local-time:parse-timestring (format nil "2013-06-30T~A+0200" (subseq clock 16 24))))
                  (message (yason:parse message :object-as :plist :object-key-fn #'string-to-keyword)))
              (cond
                ((eq (first message) :begin-race)
                 (setf ended nil
                       winner nil)
                 (incf race)
                 (dolist (track (cadadr message))
                   (setf (gethash (1- (getf track :number)) track-drivers) (getf track :driver-name))))
                (t
                 (destructuring-bind (&key type lap track time &allow-other-keys) message
                   (case (intern (string-upcase type) :keyword)
                     (:lap
                      (when (or (not ended)
                                (not winner))
                        (when (not winner)
                          (setf winner (gethash track track-drivers))
                          (format t "winner: ~A~%" winner))
                        (pomo:execute (:insert-into 'laps
                                       :set 'round round-name
                                            'race race
                                            'clock clock
                                            'driver (gethash track track-drivers)
                                            'track track
                                            'lap lap
                                            'time (or time :null)))))
                     (:race-ended
                      (setf ended t)))))))))))))

(defun make-race-points ()
  (pomo:with-connection '("slotrrr" "hans" nil "localhost")
    (let ((race-results (make-hash-table :test #'equal))
          (point-table (make-hash-table :test #'equal))
          current-race
          points
          races)
      (dolist (row (sort (pomo:query "select distinct on (round, race, driver) round || '.' || to_char(race, 'fm00'), driver, lap, event_id from laps order by round, race, driver, event_id desc")
                         (lambda (a b)
                           (if (string= (first a) (first b))
                               (< (third a) (third b))
                               (string-lessp (first a) (first b))))))
        (destructuring-bind (race driver lap event-id) row
          (unless (equal race current-race)
            (setf current-race race
                  points 0)
            (push (list race event-id) races))
          (push driver (gethash current-race race-results))
          (incf (gethash driver point-table 0) points)
          (incf points)))
      (xhtml-generator:with-xhtml ()
        (:html
         (:head
          (:title "Auswertung nach Runden und Punkten"))
         (:body
          (:h1 "Auswertung nach Runden und Punkten")
          (:h2 "Punktetabelle")
          ((:table :border 1)
           (:thead
            (:tr
             (:th "Rang")
             (:th "Fahrer")
             (:th "Punkte")))
           (:tbody
            (let ((rank 0))
              (dolist (driver (sort (hash-table-alist point-table) #'> :key #'cdr))
                (xhtml-generator:html
                 (:tr
                  (:td (:princ (incf rank)))
                  (:td (:princ (car driver)))
                  (:td (:princ (cdr driver)))))))))
          (:p "1. Platz => 3 Punkte, 4. Platz => 0 Punkte")
          (:h2 "Renn-Einzelauswertung")
          ((:table :border 1)
           (:thead
            (:tr
             (:th "Rennen")
             (:th "1.")
             (:th "2.")
             (:th "3.")
             (:th "4.")))
           (:tbody
            (let ((race-number 0))
              (dolist (race (reverse races))
                (destructuring-bind (race event-id) race
                  (let ((race-result (gethash race race-results)))
                    (xhtml-generator:html
                     (:tr
                      (:td (:princ (incf race-number)))
                      (:td (:princ (nth 0 race-result)))
                      (:td (:princ (nth 1 race-result)))
                      (:td (:princ (nth 2 race-result)))
                      (:td (:princ (nth 3 race-result)))))))))))))))))

(with-open-file (*standard-output* "/tmp/race.html" :direction :output :if-exists :supersede)
  (make-race-points))

(sb-ext:run-program "open" '("/tmp/race.html") :search t)
