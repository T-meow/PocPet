import type { MiniGameState } from '../../core/companionActivityTypes';

export type MiniGameFeedbackEvent = 'start' | 'flip' | 'match' | 'throw' | 'catch' | 'miss' | 'blow' | 'bubble' | 'pop' | 'finish';
export interface MiniGameFeedback { event: MiniGameFeedbackEvent; serial: number; }

// Compare committed progress so rejected clicks, normalization and repeated renders stay silent.
export const getMiniGameFeedback = (previous: MiniGameState | undefined, next: MiniGameState, actorId: string): MiniGameFeedbackEvent | undefined => {
  if (next.lastResult?.pending && next.lastResult.actorId === actorId && next.lastResult.id !== previous?.lastResult?.id) return 'finish';
  const active = next.active;
  const before = previous?.active;
  if (!active || active.paused || active.actorId !== actorId) return;
  if (!before || before.id !== active.id || before.paused) return 'start';
  if (active.game === 'matching') {
    if (active.matched.length > before.matched.length) return 'match';
    if (active.flipped.some((index) => !before.flipped.includes(index))) return 'flip';
  } else if (active.game === 'catch') {
    if (active.throwAt && active.throwAt !== before.throwAt) return 'throw';
    if (active.rounds > before.rounds) return active.throwResult === 'caught' ? 'catch' : 'miss';
  } else {
    if (active.blowingAt && !before.blowingAt) return 'blow';
    if (active.bubbles.length > before.bubbles.length) return 'bubble';
    if (active.bubbles.filter((bubble) => bubble.popped).length > before.bubbles.filter((bubble) => bubble.popped).length) return 'pop';
  }
};
