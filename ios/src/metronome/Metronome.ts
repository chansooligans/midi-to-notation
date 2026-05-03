import { Audio } from "expo-av";

export class Metronome {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private sound: Audio.Sound | null = null;
  tempo: number;
  volume: number;
  beatsPerMeasure: number;
  private beatCount = 0;

  constructor(tempo = 100, volume = 0.5, beatsPerMeasure = 4) {
    this.tempo = tempo;
    this.volume = volume;
    this.beatsPerMeasure = beatsPerMeasure;
  }

  async start(onBeat?: (beat: number) => void) {
    this.beatCount = 0;
    const ms = (60 / this.tempo) * 1000;
    this.intervalId = setInterval(async () => {
      this.beatCount++;
      const beat = ((this.beatCount - 1) % this.beatsPerMeasure) + 1;
      onBeat?.(beat);
      await this.playClick(beat === 1);
    }, ms);
    await this.playClick(true);
    onBeat?.(1);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async playClick(accent: boolean) {
    try {
      const { sound } = await Audio.Sound.createAsync(
        accent
          ? require("../../assets/click-hi.wav")
          : require("../../assets/click-lo.wav"),
        { volume: this.volume },
      );
      await sound.playAsync();
      setTimeout(() => sound.unloadAsync(), 500);
    } catch {
      // Fallback: no sound files available yet
    }
  }
}
