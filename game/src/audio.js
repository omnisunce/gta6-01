// All sound is synthesized with WebAudio: no audio files, no network.
// The engine hum, the police siren, gunshots and jingles are all oscillators
// and filtered noise built here at run time.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return context;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      context = new AudioContextClass();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(frequency, duration, type, volume, when = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.02);
  }

  function noiseBurst(duration, volume, lowpass) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopEngine();
      return muted;
    },
    isMuted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'square', 0.08);
    },
    pickup() {
      tone(523, 0.09, 'sine', 0.16);
      tone(659, 0.09, 'sine', 0.16, 0.08);
      tone(784, 0.16, 'sine', 0.18, 0.16);
    },
    missionDone() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((note, i) => tone(note, 0.22, 'triangle', 0.18, i * 0.11));
    },
    crash() {
      noiseBurst(0.25, 0.4, 420);
      tone(90, 0.2, 'sine', 0.3);
    },
    shoot() {
      noiseBurst(0.09, 0.32, 2400);
      tone(190, 0.07, 'square', 0.1);
    },
    denied() {
      tone(180, 0.16, 'sawtooth', 0.14);
    },
    wantedUp() {
      tone(392, 0.12, 'square', 0.12);
      tone(311, 0.2, 'square', 0.12, 0.1);
    },
    startEngine() {
      const ctx = ensure();
      if (!ctx || engineOsc || muted) return;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
    },
    setEngine(speedFraction, on) {
      if (!engineOsc || !engineGain) return;
      const ctx = ensure();
      if (!ctx) return;
      engineOsc.frequency.setTargetAtTime(52 + speedFraction * 130, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(on && !muted ? 0.045 + speedFraction * 0.035 : 0.0, ctx.currentTime, 0.1);
    },
    stopEngine() {
      if (engineOsc) {
        try {
          engineOsc.stop();
        } catch {
          // Already stopped.
        }
        engineOsc = null;
        engineGain = null;
      }
    },
    setSiren(on, now) {
      const ctx = ensure();
      if (!ctx || muted) {
        if (sirenOsc) {
          try {
            sirenOsc.stop();
          } catch {
            // Already stopped.
          }
          sirenOsc = null;
        }
        return;
      }
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.028;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(ctx.destination);
        sirenOsc.start();
        sirenTimer = now;
      } else if (!on && sirenOsc) {
        try {
          sirenOsc.stop();
        } catch {
          // Already stopped.
        }
        sirenOsc = null;
        sirenGain = null;
      }
      if (sirenOsc) {
        const phase = Math.floor((now - sirenTimer) / 0.45) % 2 === 0 ? 700 : 950;
        sirenOsc.frequency.setTargetAtTime(phase, ctx.currentTime, 0.05);
      }
    },
  };
}
