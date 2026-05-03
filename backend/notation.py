"""Convert recorded NoteEvents into a music21 Score.

Two-stage pipeline:
  1. quantize_events() — snap raw timing to a grid, resolve overlaps
  2. quantized_to_score() — build a clean music21 Score from quantized data
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Iterable

from music21 import stream, note, meter, tempo, key, metadata, duration, clef, instrument

from midi_capture import NoteEvent

QUANTIZE_GRID = Fraction(1, 4)  # sixteenth-note grid

TRANSPOSITIONS = {
    "concert": 0,
    "bb_soprano": 2,
    "eb_alto": 9,
    "bb_tenor": 14,
    "eb_baritone": 21,
}


@dataclass
class QuantizedNote:
    pitch: int          # MIDI pitch (concert)
    velocity: int
    start: Fraction     # quarter-note offset from beginning
    duration: Fraction  # quarter-note length


def _snap(value: float, grid: Fraction) -> Fraction:
    steps = round(value / float(grid))
    return Fraction(steps) * grid


def quantize_events(
    events: Iterable[NoteEvent],
    tempo_bpm: float,
    grid: Fraction = QUANTIZE_GRID,
) -> list[QuantizedNote]:
    sec_per_quarter = 60.0 / tempo_bpm

    quantized = []
    for ev in events:
        start = _snap(ev.start / sec_per_quarter, grid)
        dur = _snap(ev.duration / sec_per_quarter, grid)
        if dur < grid:
            dur = grid
        quantized.append(QuantizedNote(
            pitch=ev.pitch, velocity=ev.velocity, start=start, duration=dur,
        ))

    quantized.sort(key=lambda n: (n.start, n.pitch))

    # Merge same-pitch notes that truly overlap (not merely adjacent)
    merged: list[QuantizedNote] = []
    for qn in quantized:
        if merged and merged[-1].pitch == qn.pitch:
            prev = merged[-1]
            prev_end = prev.start + prev.duration
            if qn.start < prev_end:
                prev.duration = max(prev_end, qn.start + qn.duration) - prev.start
                continue
        merged.append(qn)
    quantized = merged

    # Clip overlaps: each note's end must not exceed the next note's start
    for i in range(len(quantized) - 1):
        cur = quantized[i]
        nxt = quantized[i + 1]
        max_dur = nxt.start - cur.start
        if max_dur > 0 and cur.duration > max_dur:
            cur.duration = max_dur

    quantized = [n for n in quantized if n.duration > 0]
    return quantized


def quantized_to_score(
    notes: list[QuantizedNote],
    tempo_bpm: float,
    transposition: str = "bb_tenor",
    time_sig: str = "4/4",
    title: str = "MIDI Capture",
) -> stream.Score:
    notes = sorted(notes, key=lambda n: (n.start, n.pitch))
    semitone_shift = TRANSPOSITIONS.get(transposition, 0)

    score = stream.Score()
    score.metadata = metadata.Metadata()
    score.metadata.title = title

    part = stream.Part()
    part.insert(0, instrument.Saxophone())
    part.insert(0, clef.TrebleClef())
    part.insert(0, tempo.MetronomeMark(number=tempo_bpm))
    part.insert(0, meter.TimeSignature(time_sig))
    part.insert(0, key.KeySignature(0))

    cursor = Fraction(0)
    for qn in notes:
        if qn.start > cursor:
            rest_len = qn.start - cursor
            r = note.Rest()
            r.duration = duration.Duration(quarterLength=float(rest_len))
            part.append(r)
            cursor = qn.start

        n = note.Note()
        n.pitch.midi = qn.pitch + semitone_shift
        n.duration = duration.Duration(quarterLength=float(qn.duration))
        n.volume.velocity = qn.velocity
        part.append(n)
        cursor = qn.start + qn.duration

    score.append(part)
    score.makeMeasures(inPlace=True)
    return score


def events_to_score(
    events: Iterable[NoteEvent],
    tempo_bpm: float,
    transposition: str = "bb_tenor",
    time_sig: str = "4/4",
    title: str = "MIDI Capture",
) -> stream.Score:
    quantized = quantize_events(events, tempo_bpm)
    return quantized_to_score(
        quantized,
        tempo_bpm=tempo_bpm,
        transposition=transposition,
        time_sig=time_sig,
        title=title,
    )
