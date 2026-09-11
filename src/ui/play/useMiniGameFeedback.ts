import { useEffect, useRef, useState } from 'react';
import { playSfx, type SfxId } from '../../core/audio';
import type { MiniGameState } from '../../core/companionActivityTypes';
import { getMiniGameFeedback, type MiniGameFeedback, type MiniGameFeedbackEvent } from './miniGameFeedback';

const sounds: Record<MiniGameFeedbackEvent, SfxId> = {
  start: 'open', flip: 'game_flip', match: 'game_match', throw: 'game_throw', catch: 'game_catch',
  miss: 'game_miss', blow: 'game_blow', bubble: 'game_bubble', pop: 'game_pop', finish: 'game_finish',
};

export const useMiniGameFeedback = (state: MiniGameState, actorId: string) => {
  const previous = useRef<MiniGameState>();
  const serial = useRef(0);
  const [feedback, setFeedback] = useState<MiniGameFeedback>();
  useEffect(() => {
    const event = getMiniGameFeedback(previous.current, state, actorId);
    previous.current = state;
    if (!event) return;
    playSfx(sounds[event]);
    setFeedback({ event, serial: ++serial.current });
  }, [state, actorId]);
  return feedback;
};
