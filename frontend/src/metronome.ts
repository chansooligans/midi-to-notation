/** Web Audio metronome. Schedules click sounds slightly ahead of time for accuracy. */
export class Metronome {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private beatInBar = 0;
  bpm = 100;
  beatsPerBar = 4;
  volume = 0.5; // 0–1

  start() {
    this.ctx = this.ctx || new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.beatInBar = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduler();
  }

  stop() {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scheduler = () => {
    if (!this.ctx) return;
    const lookahead = 0.1;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.click(this.nextNoteTime, this.beatInBar === 0);
      this.nextNoteTime += 60.0 / this.bpm;
      this.beatInBar = (this.beatInBar + 1) % this.beatsPerBar;
    }
    this.timer = window.setTimeout(this.scheduler, 25) as unknown as number;
  };

  private click(time: number, accent: boolean) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    const peak = this.volume * (accent ? 0.8 : 0.5);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}
