// Plays a two-tone "ding" using the Web Audio API — no audio file needed
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const play = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Two ascending tones — pleasant "you've got a code" sound
    play(660, ctx.currentTime, 0.25);
    play(880, ctx.currentTime + 0.18, 0.35);
  } catch (_) {
    // Browsers may block audio without a prior user interaction — fail silently
  }
}
