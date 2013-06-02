# slotrrr - Slotcar racing utilities for DS-030 track controller

## DS-030 protocol description

The serial setup is 4800/8N1.

All messages are one byte messages except lap time messages, which
consist of 4 bytes: 0x80/0x40/0x20/0x10 to indicate the track number,
followed by the time represented as 3 bytes of BCD-encoded decimals.
The first byte represents the seconds, the next two represent the
fractional seconds.  The first lap time is invalid (contains invalid
BCD digits) and must be ignored (supposedly because the start happens
behind the measurement bridge.

A time message may be preceded by a "best lap" message to indicate
that the following time has been the best in the race for that lap.

The DS-030 sends out lap messages after the race has ended for drivers
coming in quickly after the winning driver (in the "goal is a certain
number of tracks" mode).
