export interface MidiMessage {
  type: "note_on" | "note_off";
  note: number;
  velocity: number;
  timestamp: number;
}

export interface MidiDevice {
  id: string;
  name: string;
  isConnected: boolean;
}
