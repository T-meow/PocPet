import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { advancePet, type PetState } from '../../core/pet';
import { actMiniGame, miniGameUnlockLevel, pauseMiniGame, type MiniGameAction } from '../../core/miniGames';
import type { RecipeId } from '../../core/companionActivityTypes';

export const useCompanionActivities = (pet: PetState, actorId: string, playOpen: boolean, blocked: boolean, setPet: Dispatch<SetStateAction<PetState>>, commitPet: (pet: PetState, options?: { silent?: boolean }) => PetState) => {
  const [recipeId, setRecipeId] = useState<RecipeId>('egg_rice');
  const [banana, setBanana] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const commitRef = useRef(commitPet);
  const blockedRef = useRef(blocked);
  commitRef.current = commitPet;
  blockedRef.current = blocked;
  const update = useCallback((action: (pet: PetState) => PetState) => {
    if (blockedRef.current) return;
    setPet((current) => commitRef.current(action(advancePet(current, Date.now())), { silent: true }));
  }, [setPet]);
  const session = pet.miniGames.active;
  useEffect(() => {
    if (!playOpen || blocked || pet.level < miniGameUnlockLevel || pet.isSleeping || pet.partnerSchedule.active || (session && session.actorId !== actorId)) {
      setPet((current) => pauseMiniGame(current));
      return;
    }
    const pause = () => setPet((current) => pauseMiniGame(current));
    const visibility = () => { if (document.visibilityState !== 'visible') pause(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', pause);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || blockedRef.current) return;
      setPet((current) => {
        const active = current.miniGames.active;
        if (!active || active.paused || active.actorId !== actorId) return current;
        const now = Date.now();
        if (!(active.game === 'catch' && active.throwAt) && now - active.lastTickAt < 500) return current;
        return commitRef.current(actMiniGame(current, active.id, { type: 'tick' }, now), { silent: true });
      });
    }, 100);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', pause); };
  }, [playOpen, blocked, actorId, pet.level, pet.isSleeping, Boolean(pet.partnerSchedule.active), session?.actorId, setPet]);
  const act = (id: string, action: MiniGameAction) => update((current) => actMiniGame(current, id, action, Date.now()));
  return { recipeId, setRecipeId, banana, setBanana, quantity, setQuantity, update, act };
};
