"""MIDI capture: list devices and record note events from a chosen input port."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Optional

try:
    import mido
except ImportError:
    mido = None


@dataclass
class NoteEvent:
    pitch: int
    velocity: int
    start: float  # seconds from recording start
    duration: float  # seconds; filled in on note-off


@dataclass
class Recording:
    tempo_bpm: float
    started_at: float
    debounce_sec: float = 0.030
    events: list[NoteEvent] = field(default_factory=list)
    _open_notes: dict[int, NoteEvent] = field(default_factory=dict)
    _recent_offs: dict[int, tuple[float, NoteEvent]] = field(default_factory=dict)

    def handle(self, msg: mido.Message, now: float) -> None:
        t = now - self.started_at
        if msg.type == "note_on" and msg.velocity > 0:
            recent = self._recent_offs.pop(msg.note, None)
            if recent and (t - recent[0]) < self.debounce_sec:
                ev = recent[1]
                ev.duration = 0.0  # mark as open again
                self._open_notes[msg.note] = ev
            else:
                ev = NoteEvent(pitch=msg.note, velocity=msg.velocity, start=t, duration=0.0)
                self._open_notes[msg.note] = ev
                self.events.append(ev)
        elif msg.type in ("note_off",) or (msg.type == "note_on" and msg.velocity == 0):
            ev = self._open_notes.pop(msg.note, None)
            if ev is not None:
                ev.duration = max(t - ev.start, 0.05)
                self._recent_offs[msg.note] = (t, ev)

    def finalize(self, now: float) -> None:
        # Close any still-held notes
        for ev in list(self._open_notes.values()):
            ev.duration = max(now - self.started_at - ev.start, 0.05)
        self._open_notes.clear()


class MidiRecorder:
    """Thread-based recorder that polls a mido input port."""

    def __init__(self) -> None:
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._port: Optional[mido.ports.BaseInput] = None
        self.recording: Optional[Recording] = None
        self._lock = threading.Lock()

    @staticmethod
    def list_inputs() -> list[str]:
        if mido is None:
            return []
        try:
            return mido.get_input_names()
        except Exception:
            return []

    def start(self, port_name: Optional[str], tempo_bpm: float, debounce_ms: float = 30) -> Recording:
        with self._lock:
            if self._thread and self._thread.is_alive():
                raise RuntimeError("A recording is already in progress")

            inputs = self.list_inputs()
            if not inputs:
                raise RuntimeError("No MIDI input devices detected")
            chosen = port_name or inputs[0]
            if chosen not in inputs:
                raise RuntimeError(f"MIDI port '{chosen}' not found. Available: {inputs}")

            self._port = mido.open_input(chosen)
            self.recording = Recording(tempo_bpm=tempo_bpm, started_at=time.monotonic(), debounce_sec=debounce_ms / 1000)
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()
            return self.recording

    def _run(self) -> None:
        assert self._port is not None and self.recording is not None
        try:
            while not self._stop_event.is_set():
                for msg in self._port.iter_pending():
                    if msg.type in ("note_on", "note_off"):
                        self.recording.handle(msg, time.monotonic())
                time.sleep(0.002)
        finally:
            try:
                self._port.close()
            except Exception:
                pass

    def stop(self) -> Recording:
        with self._lock:
            if not self._thread:
                raise RuntimeError("No recording to stop")
            self._stop_event.set()
            self._thread.join(timeout=2.0)
            self._thread = None
            assert self.recording is not None
            self.recording.finalize(time.monotonic())
            return self.recording
