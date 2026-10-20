import { Note } from "tonal";

class WebAudioSynth {
  private ctx: AudioContext | null = null;
  private activeTimerIds: number[] = [];

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public stopAll() {
    for (const id of this.activeTimerIds) {
      window.clearTimeout(id);
    }
    this.activeTimerIds = [];
  }

  /**
   * Play a single note with warm electric piano / synth pad characteristics
   */
  public playNote(noteName: string, durationSec = 1.4, delaySec = 0, volume = 0.16) {
    const freq = Note.freq(noteName);
    if (!freq) return;

    const ctx = this.getContext();
    const startTime = ctx.currentTime + delaySec;
    const stopTime = startTime + durationSec;

    // Master gain for this note
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.025);
    gainNode.gain.exponentialRampToValueAtTime(volume * 0.45, startTime + 0.35);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    // Low-pass filter for warm tone
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq * 4.5, startTime);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.8, startTime + durationSec * 0.8);

    // Oscillator 1: Triangle (warm fundamental)
    const osc1 = ctx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(freq, startTime);

    // Oscillator 2: Sine (sub/body + slight detune warmth)
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 2, startTime);
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.22, startTime);
    osc2Gain.gain.exponentialRampToValueAtTime(0.02, startTime + 0.3);

    // Oscillator 3: Soft sawtooth detuned for chorus richness
    const osc3 = ctx.createOscillator();
    osc3.type = "sawtooth";
    osc3.frequency.setValueAtTime(freq * 1.002, startTime);
    const osc3Gain = ctx.createGain();
    osc3Gain.gain.setValueAtTime(0.12, startTime);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    osc3.connect(osc3Gain);
    osc3Gain.connect(filter);

    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(startTime);
    osc2.start(startTime);
    osc3.start(startTime);

    osc1.stop(stopTime + 0.05);
    osc2.stop(stopTime + 0.05);
    osc3.stop(stopTime + 0.05);
  }

  /**
   * Play a chord voicing with subtle human strum
   */
  public playChord(notesWithOctave: string[], durationSec = 1.5, strumMs = 28) {
    if (!notesWithOctave.length) return;
    notesWithOctave.forEach((note, idx) => {
      const isBass = idx === 0;
      const vol = isBass ? 0.2 : 0.14 / Math.sqrt(notesWithOctave.length * 0.5);
      this.playNote(note, durationSec, (idx * strumMs) / 1000, vol);
    });
  }

  /**
   * Play a sequence of chord voicings with visual callback
   */
  public playProgression(
    chords: { notesWithOctave: string[]; durationBeats?: number }[],
    bpm = 96,
    onStep?: (index: number | null) => void
  ) {
    this.stopAll();
    const secPerBeat = 60 / bpm;
    let accumulatedSec = 0;

    chords.forEach((chord, idx) => {
      const beats = chord.durationBeats ?? 4;
      const durationSec = beats * secPerBeat;
      const startMs = accumulatedSec * 1000;

      const timerId = window.setTimeout(() => {
        onStep?.(idx);
        this.playChord(chord.notesWithOctave, durationSec * 0.95, 25);
      }, startMs);

      this.activeTimerIds.push(timerId);
      accumulatedSec += durationSec;
    });

    const endTimerId = window.setTimeout(() => {
      onStep?.(null);
    }, accumulatedSec * 1000);
    this.activeTimerIds.push(endTimerId);
  }
}

export const synth = new WebAudioSynth();
