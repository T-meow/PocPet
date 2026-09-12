import type { PetState } from './petTypes';

const keyFor = (pet: PetState) => `pocpet.pet-preferences.v1.${pet.saveMetadata.id}`;
export const getPetPreferences = (pet: PetState) => ({
  activeSlotIndex: pet.garden.activeSlotIndex, plating: pet.kitchen.plating, playStyle: pet.miniGames.style,
  hasOpenedHelp: pet.hasOpenedHelp, hasSeenCommonDreamsUnlock: pet.hasSeenCommonDreamsUnlock,
  suppressGoldenAppleUseConfirm: pet.suppressGoldenAppleUseConfirm, pendingReviewNotice: pet.achievements.pendingReviewNotice,
});
export const persistPetPreferences = (pet: PetState) => {
  try { window.localStorage.setItem(keyFor(pet), JSON.stringify(getPetPreferences(pet))); }
  catch { /* Preference failure must not prevent saving game progress. */ }
};
export const applyLocalPetPreferences = (pet: PetState): PetState => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(keyFor(pet)) ?? 'null');
    if (!raw || typeof raw !== 'object') return pet;
    return {
      ...pet,
      garden: { ...pet.garden, activeSlotIndex: Number.isInteger(raw.activeSlotIndex) ? Math.max(0, Math.min(4, raw.activeSlotIndex)) : pet.garden.activeSlotIndex },
      kitchen: { ...pet.kitchen, plating: ['plain', 'flower', 'stars'].includes(raw.plating) ? raw.plating : pet.kitchen.plating },
      miniGames: { ...pet.miniGames, style: ['garden', 'fruit', 'night'].includes(raw.playStyle) ? raw.playStyle : pet.miniGames.style },
      hasOpenedHelp: typeof raw.hasOpenedHelp === 'boolean' ? raw.hasOpenedHelp : pet.hasOpenedHelp,
      hasSeenCommonDreamsUnlock: typeof raw.hasSeenCommonDreamsUnlock === 'boolean' ? raw.hasSeenCommonDreamsUnlock : pet.hasSeenCommonDreamsUnlock,
      suppressGoldenAppleUseConfirm: typeof raw.suppressGoldenAppleUseConfirm === 'boolean' ? raw.suppressGoldenAppleUseConfirm : pet.suppressGoldenAppleUseConfirm,
      achievements: { ...pet.achievements, pendingReviewNotice: pet.achievements.pendingReviewNotice || raw.pendingReviewNotice === true },
    };
  } catch { return pet; }
};
