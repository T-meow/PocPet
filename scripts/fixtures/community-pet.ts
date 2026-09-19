import { createDefaultPet } from '../../src/core/petState';
import { getPetEnergyCap, getPetStatCap } from '../../src/core/petStats';
import { startAdventure } from '../../src/core/adventure';
import { facilityIds } from '../../src/core/communityData';
import { regionIds } from '../../src/core/expeditionData';
import { chooseExpeditionStep, pauseExpedition, startExpedition } from '../../src/core/expedition';
import type { PetState } from '../../src/core/petTypes';

type TestScenario = 'community' | 'salvage' | 'harvest' | 'construction' | 'commissions' | 'projects' | 'long-trip' | 'idle';

/** In-memory starting states for production rules tests; no prototype UI or player storage. */
export const createCommunityTestPet = (scenario: TestScenario, now: number): PetState => {
  let pet: PetState = {
    ...createDefaultPet(now), name: 'Furo', coins: 1200, hearts: 120,
    hunger: 100, mood: 100, cleanliness: 100, health: 100, energy: 100, isSleeping: false,
    inventory: { dish_carrot_rice: 12, field_dressing: 4, comfort_charm: 3, trail_rope: 1,
      berry_bait: 2, community_wood: 3, community_stone: 2, carrot_seed: 2, rice: 6 },
  };
  pet.adventure = { ...pet.adventure, completed: { tutorial: 1 }, starterClaimed: true, starterMealsClaimed: true };

  if (scenario === 'salvage') {
    pet = startAdventure(pet, 'valley', 'official.furo', 'Furo', { dish_carrot_rice: 12 }, true, now, 'irrigation');
    if (!pet.adventure.active) throw new Error('Unable to prepare the forced-return test');
    pet.adventure.active.choices = ['search_path'];
    pet.adventure.active.loot = { creek_herb_seed: 1 };
    pet.health = 19;
  }
  if (scenario === 'harvest') {
    pet.community = { ...pet.community, irrigationFound: true, herbDiscovered: true, repairStep: 2,
      gardenBuilt: true, crop: { id: 'herb', plantedAt: now - 6 * 3600000, readyAt: now } };
  }
  if (['construction', 'commissions', 'projects', 'long-trip', 'idle'].includes(scenario)) {
    pet.coins = 4500;
    pet.inventory = { ...pet.inventory, bento: 3, community_wood: 30, community_stone: 25,
      animal_feed: 12, egg: 6, farm_milk: 4, carrot: 8, creek_herb: 8, creek_herb_seed: 3,
      fishing_rod: 1, reinforced_rod: 1, fishing_bait: 20, river_bait: 10,
      pond_crucian: 3, pond_carp: 3, stream_trout: 3, golden_koi: 1, valley_amber: 1 };
    pet.community = { ...pet.community, irrigationFound: true, herbDiscovered: true, repairStep: 2,
      gardenBuilt: true, firstOrderDelivered: true };
    if (scenario !== 'construction') {
      for (const id of facilityIds) pet.community.facilities[id] = { found: true, work: 2, built: true };
      pet.community.market = { ...pet.community.market, level: 1, lastVisitAt: now, reserve: { egg: 2, creek_herb: 2 } };
    }
  }
  if (['projects', 'long-trip', 'idle'].includes(scenario)) {
    for (const id of regionIds) {
      pet.community.expedition.regions[id] = { ...pet.community.expedition.regions[id],
        surveyed: true, base: 1, storyAt: now, actorId: 'test.furo', actorName: 'Furo' };
    }
    pet.inventory = { ...pet.inventory, valley_mushroom: 12, hill_honey: 12, forest_berry: 12, forest_berry_seed: 3,
      pine_resin: 12, coast_kelp: 12, sea_glass: 12, observatory_part: 12, trail_mix: 6,
      dish_herb_porridge: 6, dish_mushroom_rice: 6, dish_carp_rice: 6, dish_kelp_rice: 6 };
    pet.community.fishing.journal = {
      pond_crucian: { count: 1, firstAt: now, largest: 18 },
      pond_carp: { count: 1, firstAt: now, largest: 28 },
    };
  }
  pet.energy = getPetEnergyCap(pet);
  pet.hunger = getPetStatCap(pet);
  pet.isOverfed = true;

  if (scenario === 'long-trip') {
    pet = startExpedition(pet, ['valley', 'hills', 'forest'], {}, true, 'test.furo', 'Furo', 'manual', 1, now);
    for (const choice of ['gather', 'safe', 'story']) {
      const trip = pet.community.expedition.active;
      if (!trip) throw new Error('Unable to prepare the checkpoint test');
      pet = chooseExpeditionStep(pet, trip.id, trip.revision, choice, now);
    }
    const trip = pet.community.expedition.active!;
    pet = pauseExpedition(pet, trip.id, trip.revision, now);
    if (!pet.community.expedition.active?.paused) throw new Error('Test expedition did not reach a checkpoint');
  } else if (scenario === 'idle') {
    pet = startExpedition(pet, ['coast'], {}, false, 'test.furo', 'Furo', 'idle', 3, now);
    if (!pet.community.expedition.active) throw new Error('Unable to prepare the timed expedition test');
  }
  return pet;
};
