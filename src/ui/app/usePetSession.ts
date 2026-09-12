import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { advancePet, evaluateAchievementUnlocks, type AchievementView, type NeighborEventContext, type PetState } from '../../core/pet';
import { playSfx, setAudioTemporarilyMuted } from '../../core/audio';
import { savePet, takeStorageFeedback } from '../../core/storage';
import { updatePetSession, type FeedbackMode, type PetSessionState } from './petSessionFeedback';

export type AchievementToast = { kind: 'single'; achievement: AchievementView } | { kind: 'review' };

interface CommitOptions {
  silent?: boolean;
}

interface PetSession {
  pet: PetState;
  petRef: MutableRefObject<PetState>;
  setPet: Dispatch<SetStateAction<PetState>>;
  setPetWithFeedback: Dispatch<SetStateAction<PetState>>;
  setPetWithEventFeedback: Dispatch<SetStateAction<PetState>>;
  commitPet: (next: PetState, options?: CommitOptions) => PetState;
  achievementToast: AchievementToast | null;
  setAchievementToast: Dispatch<SetStateAction<AchievementToast | null>>;
  persistenceError: string;
}

export const usePetSession = (
  initialPet: PetState,
  isHomeRef: MutableRefObject<boolean>,
  eventContext?: NeighborEventContext,
  initialPersistenceError = '',
  onFeedback?: (text: string) => void,
): PetSession => {
  const [session, setSession] = useState<PetSessionState>({ pet: initialPet, feedback: [] });
  const { pet } = session;
  const feedbackId = useRef(0);
  const applyUpdate = useCallback((action: SetStateAction<PetState>, mode: FeedbackMode) => {
    const id = ++feedbackId.current;
    setSession((current) => updatePetSession(current, action, mode, id));
  }, []);
  const setPet = useCallback<Dispatch<SetStateAction<PetState>>>((action) => applyUpdate(action, 'quiet'), [applyUpdate]);
  const setPetWithFeedback = useCallback<Dispatch<SetStateAction<PetState>>>((action) => applyUpdate(action, 'action'), [applyUpdate]);
  const setPetWithEventFeedback = useCallback<Dispatch<SetStateAction<PetState>>>((action) => applyUpdate(action, 'event'), [applyUpdate]);
  const deliveredId = useRef(0);
  const onFeedbackRef = useRef(onFeedback);
  onFeedbackRef.current = onFeedback;
  useEffect(() => {
    for (const entry of session.feedback) {
      if (entry.id <= deliveredId.current) continue;
      deliveredId.current = entry.id;
      onFeedbackRef.current?.(entry.text);
    }
  }, [session.feedback]);
  const [achievementToast, setAchievementToast] = useState<AchievementToast | null>(null);
  const petRef = useRef(pet);
  const [persistenceError, setPersistenceError] = useState(initialPersistenceError);
  const paused = useRef(Boolean(initialPersistenceError));

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === 'pocpet.pet.v1' || event.key === null) {
        paused.current = true;
        setPersistenceError('conflict');
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  const commitPet = (next: PetState, options: CommitOptions = {}) => {
    const result = evaluateAchievementUnlocks(next);
    if (!options.silent && isHomeRef.current && result.unlocked.length > 0) {
      setAchievementToast(
        result.unlocked.length === 1 && !result.pet.achievements.pendingReviewNotice
          ? { kind: 'single', achievement: result.unlocked[0] }
          : { kind: 'review' },
      );
      playSfx('notification');
    }
    return result.pet;
  };

  const commitRef = useRef(commitPet);
  commitRef.current = commitPet;
  const eventContextRef = useRef(eventContext);
  eventContextRef.current = eventContext;

  useEffect(() => {
    petRef.current = pet;
    if (paused.current) return;
    try {
      const saved = savePet(pet);
      if (saved !== pet) {
        petRef.current = saved;
        setPet((current) => current === pet ? saved : current);
      }
      for (const message of takeStorageFeedback()) onFeedbackRef.current?.(message);
    }
    catch (error) {
      paused.current = true;
      setPersistenceError(error instanceof Error && error.message === 'storage-conflict' ? 'conflict' : 'saveError');
    }
  }, [pet]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      applyUpdate((current) => commitRef.current(advancePet(current, Date.now(), eventContextRef.current)), 'event');
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setAudioTemporarilyMuted(!isVisible);
      if (isVisible) {
        applyUpdate((current) => commitRef.current(advancePet(current, Date.now(), eventContextRef.current)), 'event');
      }
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return { pet, petRef, setPet, setPetWithFeedback, setPetWithEventFeedback, commitPet, achievementToast, setAchievementToast, persistenceError };
};
