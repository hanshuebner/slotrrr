;; -*- Lisp -*-

;; tabelle:
;; create table laps (round varchar, race varchar, clock timestamp, driver varchar, track integer, lap integer, time float);

(defpackage :load-race-log
  (:use :cl))

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
