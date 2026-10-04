import { useEffect, useRef } from 'react';
import type { FeedbackSound } from '../types';

export function useGameAudio(enabled: boolean) {
  const context = useRef<AudioContext | null>(null), enabledRef = useRef(enabled); enabledRef.current = enabled;
  useEffect(() => () => { const ctx = context.current; context.current = null; if (ctx) void ctx.close().catch(() => {}); }, []);
  return (kind: FeedbackSound) => {
    if (!enabledRef.current) return;
    const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    try {
      const ctx = context.current || (context.current = new AudioCtor());
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const notes = kind === 'win' ? [523, 659, 784, 1046] : kind === 'clear' ? [523, 659, 784] : kind === 'pour' ? [420, 510] : [430];
      notes.forEach((frequency, i) => { const oscillator = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * .08; oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.04, at + .01); gain.gain.exponentialRampToValueAtTime(.001, at + .18); oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(at); oscillator.stop(at + .19); });
    } catch { /* Audio is optional; the board remains playable when audio is blocked. */ }
  };
}
