import { useCallback, useRef } from "react";
import { NoteEvent } from "../api/types";

interface OpenNote {
  pitch: number;
  velocity: number;
  start: number;
  event: NoteEvent;
}

interface RecentOff {
  time: number;
  event: NoteEvent;
}

export function useMidiRecorder(debounceMs: number) {
  const eventsRef = useRef<NoteEvent[]>([]);
  const openNotes = useRef<Map<number, OpenNote>>(new Map());
  const recentOffs = useRef<Map<number, RecentOff>>(new Map());
  const startTime = useRef<number>(0);
  const debounceSec = debounceMs / 1000;

  const start = useCallback(() => {
    eventsRef.current = [];
    openNotes.current.clear();
    recentOffs.current.clear();
    startTime.current = Date.now() / 1000;
  }, []);

  const handleNoteOn = useCallback(
    (note: number, velocity: number) => {
      const t = Date.now() / 1000 - startTime.current;

      const recent = recentOffs.current.get(note);
      if (recent && t - recent.time < debounceSec) {
        recentOffs.current.delete(note);
        recent.event.duration = 0;
        openNotes.current.set(note, {
          pitch: note,
          velocity,
          start: recent.event.start,
          event: recent.event,
        });
        return;
      }

      const ev: NoteEvent = { pitch: note, velocity, start: t, duration: 0 };
      openNotes.current.set(note, { pitch: note, velocity, start: t, event: ev });
      eventsRef.current.push(ev);
    },
    [debounceSec],
  );

  const handleNoteOff = useCallback((note: number) => {
    const t = Date.now() / 1000 - startTime.current;
    const open = openNotes.current.get(note);
    if (open) {
      openNotes.current.delete(note);
      open.event.duration = Math.max(t - open.event.start, 0.05);
      recentOffs.current.set(note, { time: t, event: open.event });
    }
  }, []);

  const stop = useCallback((): NoteEvent[] => {
    const t = Date.now() / 1000 - startTime.current;
    for (const open of openNotes.current.values()) {
      open.event.duration = Math.max(t - open.event.start, 0.05);
    }
    openNotes.current.clear();
    recentOffs.current.clear();
    return [...eventsRef.current];
  }, []);

  return { start, stop, handleNoteOn, handleNoteOff, events: eventsRef };
}
