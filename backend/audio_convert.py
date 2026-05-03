"""Convert audio to NoteEvents via pitch detection (librosa pyin)."""
from __future__ import annotations

import io

import librosa
import numpy as np
from scipy.ndimage import median_filter

from midi_capture import NoteEvent


def audio_to_events(
    audio_bytes: bytes,
    min_note_sec: float = 0.06,
) -> list[NoteEvent]:
    y, sr = librosa.load(io.BytesIO(audio_bytes), sr=22050, mono=True)

    f0, voiced, _ = librosa.pyin(
        y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"), sr=sr,
    )

    hop = 512
    frame_sec = hop / sr

    midi_raw = np.full_like(f0, np.nan)
    mask = voiced & ~np.isnan(f0)
    midi_raw[mask] = np.round(librosa.hz_to_midi(f0[mask]))

    # Median-filter voiced frames to smooth brief pitch wobbles (~115ms window)
    valid = ~np.isnan(midi_raw)
    if valid.sum() > 5:
        filled = np.copy(midi_raw)
        filled[~valid] = 0
        smoothed = median_filter(filled.astype(float), size=5)
        midi_raw[valid] = smoothed[valid]

    events: list[NoteEvent] = []
    cur_pitch: int | None = None
    cur_start = 0.0

    for i in range(len(midi_raw)):
        t = i * frame_sec
        if np.isnan(midi_raw[i]):
            if cur_pitch is not None:
                _close(events, cur_pitch, cur_start, t, min_note_sec)
                cur_pitch = None
        else:
            p = int(midi_raw[i])
            if p != cur_pitch:
                if cur_pitch is not None:
                    _close(events, cur_pitch, cur_start, t, min_note_sec)
                cur_pitch = p
                cur_start = t

    if cur_pitch is not None:
        _close(events, cur_pitch, cur_start, len(y) / sr, min_note_sec)

    return events


def _close(
    events: list[NoteEvent], pitch: int, start: float, end: float, min_dur: float,
) -> None:
    dur = end - start
    if dur >= min_dur:
        events.append(NoteEvent(pitch=pitch, velocity=80, start=start, duration=dur))
