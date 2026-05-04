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

STANDARD_DURATIONS = [
    Fraction(4),      # whole
    Fraction(3),      # dotted half
    Fraction(2),      # half
    Fraction(3, 2),   # dotted quarter
    Fraction(1),      # quarter
    Fraction(3, 4),   # dotted eighth
    Fraction(1, 2),   # eighth
    Fraction(1, 4),   # sixteenth
    Fraction(1, 8),   # thirty-second
]


@dataclass
class QuantizedNote:
    pitch: int          # MIDI pitch (concert)
    velocity: int
    start: Fraction     # quarter-note offset from beginning
    duration: Fraction  # quarter-note length


def _snap(value: float, grid: Fraction) -> Fraction:
    steps = round(value / float(grid))
    return Fraction(steps) * grid


def _snap_to_beat(value: float, grid: Fraction) -> Fraction:
    """Snap to grid, but prefer beat boundaries when close."""
    grid_snapped = _snap(value, grid)
    nearest_beat = Fraction(round(value))
    if abs(float(grid_snapped) - float(nearest_beat)) <= float(grid):
        return nearest_beat
    return grid_snapped


def _round_duration(dur: Fraction, grid: Fraction) -> Fraction:
    """Round a duration to the nearest standard note value."""
    best = grid
    best_dist = abs(dur - grid)
    for std in STANDARD_DURATIONS:
        if std < grid:
            continue
        dist = abs(dur - std)
        if dist < best_dist:
            best = std
            best_dist = dist
    return best


def quantize_events(
    events: Iterable[NoteEvent],
    tempo_bpm: float,
    grid: Fraction = QUANTIZE_GRID,
) -> list[QuantizedNote]:
    sec_per_quarter = 60.0 / tempo_bpm

    quantized = []
    for ev in events:
        start_q = ev.start / sec_per_quarter
        dur_q = ev.duration / sec_per_quarter

        start = _snap_to_beat(start_q, grid)
        dur = _round_duration(_snap(dur_q, grid), grid)
        if dur < grid:
            dur = grid
        quantized.append(QuantizedNote(
            pitch=ev.pitch, velocity=ev.velocity, start=start, duration=dur,
        ))

    quantized.sort(key=lambda n: (n.start, n.pitch))

    # Filter micro-notes: absorb very short notes into neighbors
    filtered = []
    for qn in quantized:
        if qn.duration <= grid and filtered:
            prev = filtered[-1]
            if prev.pitch == qn.pitch and qn.start <= prev.start + prev.duration:
                prev.duration = max(prev.start + prev.duration, qn.start + qn.duration) - prev.start
                continue
        filtered.append(qn)
    quantized = filtered

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

    # Re-round clipped durations to standard values
    for qn in quantized:
        qn.duration = _round_duration(qn.duration, grid)

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

    ts = meter.TimeSignature(time_sig)
    bar_len = Fraction(ts.barDuration.quarterLength).limit_denominator(16)

    score = stream.Score()
    score.metadata = metadata.Metadata()
    score.metadata.title = title

    part = stream.Part()
    part.insert(0, instrument.Saxophone())
    part.insert(0, clef.TrebleClef())
    part.insert(0, tempo.MetronomeMark(number=tempo_bpm))
    part.insert(0, ts)
    part.insert(0, key.KeySignature(0))

    cursor = Fraction(0)
    for qn in notes:
        if qn.start > cursor:
            rest_len = qn.start - cursor
            _append_split_rests(part, cursor, rest_len, bar_len)
            cursor = qn.start

        n = note.Note()
        n.pitch.midi = qn.pitch + semitone_shift
        n.duration = duration.Duration(quarterLength=float(qn.duration))
        n.volume.velocity = qn.velocity
        part.append(n)
        cursor = qn.start + qn.duration

    score.append(part)
    score.makeMeasures(inPlace=True)
    part.makeBeams(inPlace=True)

    return score


def _append_split_rests(
    part: stream.Part, offset: Fraction, total: Fraction, bar_len: Fraction
) -> None:
    """Split a rest into idiomatic pieces at beat and bar boundaries."""
    remaining = total
    pos = offset
    while remaining > 0:
        bar_pos = pos % bar_len
        to_bar_end = bar_len - bar_pos
        chunk = min(remaining, to_bar_end)
        chunk = _round_duration(chunk, Fraction(1, 4))
        if chunk <= 0:
            chunk = remaining
        r = note.Rest()
        r.duration = duration.Duration(quarterLength=float(chunk))
        part.append(r)
        pos += chunk
        remaining -= chunk


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
