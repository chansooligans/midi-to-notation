import { create } from "zustand";
import { NoteEvent, PRNote } from "../api/types";

export type Phase = "idle" | "recording-midi" | "recording-audio" | "stopped";

export interface Settings {
  tempo: number;
  timeSig: string;
  transposition: string;
  gridKey: string;
  gridSnap: number;
  title: string;
  debounceMs: number;
  metronomeOn: boolean;
  metronomeVol: number;
  countIn: number;
  backendUrl: string;
}

interface AppState {
  phase: Phase;
  settings: Settings;
  rawEvents: NoteEvent[];
  quantizedNotes: PRNote[];
  selectedIndices: Set<number>;
  musicXml: string | null;
  error: string | null;
  busy: boolean;

  setPhase: (p: Phase) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  setRawEvents: (events: NoteEvent[]) => void;
  setQuantizedNotes: (notes: PRNote[]) => void;
  setSelectedIndices: (sel: Set<number>) => void;
  setMusicXml: (xml: string | null) => void;
  setError: (err: string | null) => void;
  setBusy: (b: boolean) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  tempo: 100,
  timeSig: "4/4",
  transposition: "bb_tenor",
  gridKey: "1/4",
  gridSnap: 1,
  title: "MIDI Capture",
  debounceMs: 30,
  metronomeOn: false,
  metronomeVol: 0.5,
  countIn: 0,
  backendUrl: "http://192.168.1.167:8000",
};

export const useAppState = create<AppState>((set) => ({
  phase: "idle",
  settings: { ...DEFAULT_SETTINGS },
  rawEvents: [],
  quantizedNotes: [],
  selectedIndices: new Set(),
  musicXml: null,
  error: null,
  busy: false,

  setPhase: (phase) => set({ phase }),
  updateSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),
  setRawEvents: (rawEvents) => set({ rawEvents }),
  setQuantizedNotes: (quantizedNotes) => set({ quantizedNotes, musicXml: null }),
  setSelectedIndices: (selectedIndices) => set({ selectedIndices }),
  setMusicXml: (musicXml) => set({ musicXml }),
  setError: (error) => set({ error }),
  setBusy: (busy) => set({ busy }),
  reset: () =>
    set({
      phase: "idle",
      rawEvents: [],
      quantizedNotes: [],
      selectedIndices: new Set(),
      musicXml: null,
      error: null,
      busy: false,
    }),
}));
