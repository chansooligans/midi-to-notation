export interface NoteEvent {
  pitch: number;
  velocity: number;
  start: number;
  duration: number;
}

export interface PRNote {
  pitch: number;
  velocity: number;
  start: number;
  duration: number;
}

export interface ExportRequest {
  transposition: string;
  time_sig: string;
  title: string;
  tempo_bpm: number;
  notes?: PRNote[];
}

export interface RequantizeRequest {
  grid: string;
  tempo_bpm: number;
  events?: NoteEvent[];
}

export interface QuantizeResponse {
  quantized: PRNote[];
  count: number;
}

export interface AudioConvertResponse {
  note_count: number;
  quantized_count: number;
  quantized: PRNote[];
}

export const GRID_OPTIONS = [
  { label: "Quarter", value: "1/4", snapSize: 1 },
  { label: "8th", value: "1/8", snapSize: 0.5 },
  { label: "16th", value: "1/16", snapSize: 0.25 },
  { label: "32nd", value: "1/32", snapSize: 0.125 },
] as const;
