// Stub for native CoreMIDI module.
// In a dev client build, this would be backed by Swift via expo-modules-core.
// For Expo Go / development, we provide a mock that simulates the interface.

import { MidiDevice } from "./types";

type MidiCallback = (type: "note_on" | "note_off", note: number, velocity: number) => void;

let _callback: MidiCallback | null = null;

export const CoreMidi = {
  async listDevices(): Promise<MidiDevice[]> {
    // Native implementation would call MIDIGetNumberOfSources() etc.
    return [];
  },

  async showBluetoothPicker(): Promise<void> {
    // Native: present CABTMIDICentralViewController
    console.warn("CoreMIDI Bluetooth picker requires a dev client build");
  },

  setCallback(cb: MidiCallback | null) {
    _callback = cb;
  },

  async connectToDevice(_deviceId: string): Promise<boolean> {
    console.warn("CoreMIDI connect requires a dev client build");
    return false;
  },

  async disconnect(): Promise<void> {
    _callback = null;
  },
};
