import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { advancePet, evaluateAchievementUnlocks, type AchievementView, type NeighborEventContext, type PetState } from '../../core/pet';
import { playSfx, setAudioTemporarilyMuted } from '../../core/audio';
import { savePet, takeStorageFeedback } from '../../core/storage';
import { updatePetSession, type FeedbackMode, type PetSessionState } from './petSessionFeedback';
import { cancelPendingNativeSave, flushNativeSave, subscribeNativeSave } from '../../platform/nativeSave';

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
  retryPersistence: () => void;
  adoptCommittedPet: (pet: PetState) => void;
  saveAction: (pet: PetState, mode?: FeedbackMode) => PetState | undefined;
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
  const sessionRef = useRef(session);
  const petRef = useRef(pet);
  const [persistenceError, setPersistenceError] = useState(initialPersistenceError);
  const [nativeSaveError, setNativeSaveError] = useState('');
  const paused = useRef(Boolean(initialPersistenceError));
  const feedbackId = useRef(0);
  const persist = (next: PetState, immediateNative = true) => {
    try {
      const saved = savePet(next, immediateNative);
      for (const message of takeStorageFeedback()) onFeedbackRef.current?.(message);
      return saved;
    } catch (error) {
      paused.current = true;
      const conflict = error instanceof Error && error.message === 'storage-conflict';
      if (conflict) cancelPendingNativeSave();
      setPersistenceError(conflict ? 'conflict' : 'saveError');
      return undefined;
    }
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const publish = useCallback((next: PetSessionState) => {
    sessionRef.current = next;
    petRef.current = next.pet;
    setSession(next);
  }, []);
  const applyUpdate = useCallback((action: SetStateAction<PetState>, mode: FeedbackMode, immediateNative = true) => {
    if (paused.current) return;
    const id = ++feedbackId.current;
    const current = sessionRef.current;
    const next = updatePetSession(current, action, mode, id);
    if (next === current) return current.pet;
    // Persist before publishing success. Side effects stay outside React updaters,
    // which React may replay; subsequent actions see the already committed state.
    // Repeated game ticks without a new event use the periodic native checkpoint.
    const checkpoint = immediateNative && (mode !== 'event' || next.pet.recentEvent !== current.pet.recentEvent);
    const saved = persistRef.current(next.pet, checkpoint);
    if (saved) publish({ ...next, pet: saved });
    return saved;
  }, [publish]);
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
  const adoptCommittedPet = (saved: PetState) => {
    paused.current = false;
    setPersistenceError('');
    publish({ pet: saved, feedback: [] });
  };
  const retryPersistence = () => {
    if (persistenceError === 'saveError') {
      const saved = persist(petRef.current);
      if (saved) adoptCommittedPet(saved);
    }
    void flushNativeSave();
  };

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === 'pocpet.pet.v1' || event.key === null) {
        paused.current = true;
        cancelPendingNativeSave();
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

  useLayoutEffect(() => {
    if (paused.current) return;
    const saved = persistRef.current(petRef.current);
    if (saved && saved !== petRef.current) publish({ ...sessionRef.current, pet: saved });
  }, []);

  useEffect(() => subscribeNativeSave(setNativeSaveError), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      applyUpdate((current) => commitRef.current(advancePet(current, Date.now(), eventContextRef.current)), 'event', false);
    }, 1000);
    const checkpoint = window.setInterval(() => { if (!paused.current) void flushNativeSave(); }, 5000);

    return () => { window.clearInterval(timer); window.clearInterval(checkpoint); };
  }, []);

  useEffect(() => {
    const flush = () => { if (!paused.current) void flushNativeSave(); };
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setAudioTemporarilyMuted(!isVisible);
      if (isVisible) {
        applyUpdate((current) => commitRef.current(advancePet(current, Date.now(), eventContextRef.current)), 'event');
      } else flush();
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', handleVisibilityChange); window.removeEventListener('pagehide', flush); };
  }, []);

  return { pet, petRef, setPet, setPetWithFeedback, setPetWithEventFeedback, commitPet, achievementToast, setAchievementToast, persistenceError: persistenceError || (nativeSaveError ? 'nativeSave' : ''), retryPersistence, adoptCommittedPet, saveAction: (next, mode = 'quiet') => applyUpdate(next, mode) };
};
