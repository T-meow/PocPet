import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { facilityIds } from '../src/core/communityData';
import { regionIds, getRegionUnlocked } from '../src/core/expeditionData';
import { communityCrops, cropIds, getCropUnlockReason } from '../src/core/foodCatalog';
import { durableToolIds } from '../src/core/fieldEquipmentData';
import { cookingMethods, kitchenMaterials } from '../src/core/kitchenRecipes';
import { gardenTreeSaplingItemIds } from '../src/core/garden';
import { valleyQuestIds } from '../src/core/valleyQuests';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';

const now = Date.now();
let pet = createDefaultPet(now);
pet.name = '全设施测试';
pet.coins = 100_000;
pet.hearts = 1_000;
pet.adventure = { ...pet.adventure, completed: { tutorial: 1, valley: 1 },
  valleyCompleted: [...valleyQuestIds], starterClaimed: true, starterMealsClaimed: true, backpackLevel: 3 };
pet.community = { ...pet.community, gardenBuilt: true, irrigationFound: true,
  herbDiscovered: true, repairStep: 2, firstOrderDelivered: true,
  upgrades: { garden: 3, coop: 3, barn: 3, fishing_hut: 5 },
  plots: [{ id: 1 }, { id: 2 }, { id: 3 }], discoveredCrops: [...cropIds],
  waterAccess: { forest_pool: { found: true, built: true }, coast_pier: { found: true, built: true } },
};
for (const id of facilityIds) pet.community.facilities[id] = { found: true, work: 2, built: true };
pet.community.market = { ...pet.community.market, level: 3, lastVisitAt: now };
for (const id of regionIds) pet.community.expedition.regions[id] = {
  ...pet.community.expedition.regions[id], surveyed: true, base: 2, storyAt: now,
};
pet.garden = { ...pet.garden, slots: pet.garden.slots.map(slot => ({ ...slot, unlocked: true })),
  tools: { wateringCanLevel: 3, shovelLevel: 3, fertilizerBoxLevel: 3 } };
pet.kitchen = { ...pet.kitchen, starterClaimed: true, equipment: cookingMethods.map(method => method.id) };
pet.inventory = { ...pet.inventory, community_wood: 200, community_stone: 200,
  animal_feed: 50, nutrient_compost: 30, fishing_bait: 50, river_bait: 50,
  field_dressing: 20, comfort_charm: 20, berry_bait: 20, trail_mix: 20,
  dish_carrot_rice: 20, dish_mushroom_rice: 20, dish_herb_porridge: 20,
  dish_honey_drink: 20, apple: 20, farm_milk: 30, creek_herb: 30,
  valley_mushroom: 30, hill_honey: 30, forest_berry: 30, pine_resin: 30,
  coast_kelp: 30, sea_glass: 30, observatory_part: 30,
};
for (const id of durableToolIds) pet.inventory[id] = 2;
for (const crop of Object.values(communityCrops)) {
  pet.inventory[crop.seed] = 20;
  pet.inventory[crop.product] = 30;
}
for (const material of kitchenMaterials) pet.inventory[material.id] = 30;
for (const id of Object.values(gardenTreeSaplingItemIds)) pet.inventory[id] = 3;
pet.energy = getPetEnergyCap(pet);
pet.health = getPetStatCap(pet);
pet.cleanliness = getPetStatCap(pet);
pet.hunger = getPetStatCap(pet) * 0.8;
pet.mood = getPetStatCap(pet) * 0.8;
pet.isOverfed = false;
pet.recentEvent = '全设施测试存档：设施已开放，技能 1 级，可从同一基准反复试玩。';
pet = normalizePet(pet, now);

const text = createSaveFileText(pet, undefined, now);
// Exercise the real importer, including a much later import of the reusable file.
for (const importedAt of [now, now + 180 * 86_400_000]) {
  const loaded = parseSaveFileText(text, importedAt);
  assert.equal(loaded.formatVersion, 2);
  assert.equal(loaded.pet.lastUpdatedAt, importedAt);
  assert.equal(loaded.pet.health, pet.health);
  assert.equal(loaded.pet.energy, pet.energy);
  assert.equal(loaded.pet.community.gardenBuilt, true);
  assert.equal(loaded.pet.community.plots.length, 3);
  for (const id of facilityIds) assert.equal(loaded.pet.community.facilities[id].built, true, id);
  for (const id of regionIds) {
    assert.equal(getRegionUnlocked(loaded.pet, id), true, id);
    assert.equal(loaded.pet.community.expedition.regions[id].base, 2, id);
  }
  for (const id of cropIds) assert.equal(getCropUnlockReason(loaded.pet, id), '', id);
  assert.ok(loaded.pet.garden.slots.every(slot => slot.unlocked));
  assert.deepEqual(loaded.pet.kitchen.equipment, cookingMethods.map(method => method.id));
  assert.ok(Object.values(loaded.pet.partnerSchedule.skills).every(skill => skill.level === 1 && skill.xp === 0));
  for (const id of durableToolIds) assert.equal(loaded.pet.inventory[id], 2, id);
  assert.equal(loaded.pet.adventure.active, undefined);
  assert.equal(loaded.pet.community.expedition.active, undefined);
}
const destination = new URL('../output/test-saves/full-facilities.pocpet.json', import.meta.url);
await mkdir(new URL('.', destination), { recursive: true });
await writeFile(destination, text + '\n', 'utf8');
console.log(`已生成并验证：${fileURLToPath(destination)}`);
