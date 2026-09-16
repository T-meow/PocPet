import { createDefaultPet } from '../../src/core/petState';
import { defaultPetName } from '../../src/core/petStats';
import type { PetState } from '../../src/core/petTypes';
import { getMidautumnWindow } from '../../src/core/festivalCalendar';
import { getMidautumnRun, startMidautumnStory } from '../../src/core/festivalStories';

/** Development fixture only; production calendar and unlock rules stay intact. */
export const createMidautumnPreview = (now = Date.now(), actorId = 'official.furo', name = defaultPetName) => {
  const year = new Date(now).getFullYear();
  const window = getMidautumnWindow(year);
  if (!window) throw new Error('No Mid-Autumn calendar for the preview year.');
  const base = { ...createDefaultPet(now), name };
  let pet: PetState = {
    ...base, level: 12, coins: 3000, hearts: 80, hunger: 90, mood: 90, cleanliness: 90, energy: 90, health: 100,
    kitchen: { ...base.kitchen, starterClaimed: true, equipment: ['mix', 'pan', 'oven'] as typeof base.kitchen.equipment },
    inventory: { ...base.inventory, flour: 10, egg: 10, mixed_nuts: 10, red_bean_paste: 10, rice: 10, apple: 5, orange: 5, carrot: 5 },
    hasOpenedHelp: true,
  };
  pet = startMidautumnStory(pet, actorId, name, window.startsAt);
  const run = getMidautumnRun(pet, year);
  if (!run) throw new Error('Unable to prepare the Mid-Autumn preview.');
  run.startedAt = now;
  return pet;
};
