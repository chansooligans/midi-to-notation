export interface MidiNoteEvent {
  pitch: number;
  velocity: number;
  start: number;
  duration: number;
}

let midiAccess: MIDIAccess | null = null;

export async function initMidi(): Promise<MIDIAccess | null> {
  if (midiAccess) return midiAccess;
  if (!navigator.requestMIDIAccess) return null;
  try {
    midiAccess = await navigator.requestMIDIAccess();
    return midiAccess;
  } catch {
    return null;
  }
}

export async function listMidiInputs(): Promise<string[]> {
  const access = await initMidi();
  if (!access) return [];
  return Array.from(access.inputs.values())
    .map((i) => i.name ?? i.id)
    .filter(Boolean);
}

export class WebMidiRecorder {
  private input: MIDIInput | null = null;
  private startedAt = 0;
  private events: MidiNoteEvent[] = [];
  private openNotes = new Map<number, MidiNoteEvent>();
  private recentOffs = new Map<number, { time: number; event: MidiNoteEvent }>();
  private debounceSec = 0.03;
  onNoteCount?: (count: number) => void;

  start(inputName: string, debounceSec = 0.03) {
    if (!midiAccess) throw new Error("Web MIDI not available");
    this.debounceSec = debounceSec;
    this.events = [];
    this.openNotes.clear();
    this.recentOffs.clear();
    this.startedAt = performance.now() / 1000;

    for (const input of midiAccess.inputs.values()) {
      if (input.name === inputName || input.id === inputName) {
        this.input = input;
        break;
      }
    }
    if (!this.input) throw new Error(`MIDI input "${inputName}" not found`);
    this.input.onmidimessage = (msg) => this.handleMessage(msg);
  }

  private handleMessage(msg: MIDIMessageEvent) {
    const data = msg.data;
    if (!data || data.length < 3) return;

    const status = data[0] & 0xf0;
    const pitch = data[1];
    const velocity = data[2];
    const now = performance.now() / 1000;
    const t = now - this.startedAt;

    if (status === 0x90 && velocity > 0) {
      const recent = this.recentOffs.get(pitch);
      if (recent && now - recent.time < this.debounceSec) {
        recent.event.duration = 0;
        this.openNotes.set(pitch, recent.event);
        this.recentOffs.delete(pitch);
      } else {
        const ev: MidiNoteEvent = { pitch, velocity, start: t, duration: 0 };
        this.events.push(ev);
        this.openNotes.set(pitch, ev);
        this.onNoteCount?.(this.events.length);
      }
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      const ev = this.openNotes.get(pitch);
      if (ev) {
        ev.duration = Math.max(t - ev.start, 0.05);
        this.openNotes.delete(pitch);
        this.recentOffs.set(pitch, { time: now, event: ev });
      }
    }
  }

  stop(): MidiNoteEvent[] {
    const now = performance.now() / 1000;
    const t = now - this.startedAt;

    for (const ev of this.openNotes.values()) {
      ev.duration = Math.max(t - ev.start, 0.05);
    }
    this.openNotes.clear();

    if (this.input) {
      this.input.onmidimessage = null;
      this.input = null;
    }

    return [...this.events];
  }
}
