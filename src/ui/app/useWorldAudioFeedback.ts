import { useEffect, useRef } from 'react';
import { playSfx } from '../../core/audio';
import type { PetState } from '../../core/petTypes';
import type { ActivePage } from './useAppNavigation';
import { createFishingBiteCue, getWorldActionSfx } from './worldAudio';

export const useWorldAudioFeedback = (pet: PetState, page: ActivePage, blocked: boolean, actorId: string) => {
  const previous = useRef({ pet, page, blocked, actorId });
  useEffect(() => {
    const before = previous.current;
    previous.current = { pet, page, blocked, actorId };
    if (blocked || before.blocked || before.page !== page || before.actorId !== actorId) return;
    const sound = getWorldActionSfx(before.pet, pet, page);
    if (sound) playSfx(sound);
  }, [pet, page, blocked, actorId]);

  const biteCue = useRef(createFishingBiteCue());
  const session = pet.community.fishing.active;
  useEffect(() => {
    if (blocked || page !== 'community' || !session || session.phase !== 'waiting') return;
    const timer = window.setTimeout(() => {
      if (biteCue.current(session, Date.now())) playSfx('fishing_bite');
    }, Math.max(0, session.biteAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [blocked, page, session?.id, session?.biteAt, session?.expiresAt, session?.phase]);
};
