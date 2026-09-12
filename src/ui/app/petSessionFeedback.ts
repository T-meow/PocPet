import type { SetStateAction } from 'react';
import type { PetState } from '../../core/pet';

export type FeedbackMode = 'quiet' | 'action' | 'event';
export type PetSessionState = { pet: PetState; feedback: { id: number; text: string }[] };

// Queue feedback with the committed state. React may replay this pure updater;
// delivery happens later in an effect and each operation ID is delivered once.
export const updatePetSession = (current: PetSessionState, action: SetStateAction<PetState>, mode: FeedbackMode, id: number): PetSessionState => {
  const next = typeof action === 'function' ? action(current.pet) : action;
  if (next === current.pet) return current;
  const announce = mode !== 'quiet' && (mode === 'action' || next.recentEvent !== current.pet.recentEvent);
  return {
    pet: next,
    feedback: announce
      ? [...current.feedback.filter((entry) => entry.id !== id), { id, text: next.recentEvent }].slice(-20)
      : current.feedback,
  };
};
