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

// A softer, distinct two-tone "pop" for a new support-chat message, so it's not
// confused with the (more important) SMS-code sound above. Also Web Audio only —
// no audio file, zero load cost.
export function playMessageSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, startTime, duration, vol = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    play(520, ctx.currentTime, 0.18);
    play(700, ctx.currentTime + 0.12, 0.22);
  } catch (_) {
    /* autoplay blocked before any interaction — ignore */
  }
}
