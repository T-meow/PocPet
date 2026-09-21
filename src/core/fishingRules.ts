import { fish, fishIds } from './communityData';
import type { FishId, WaterId } from './communityTypes';
import { hashString } from './utils';

export const fishingIntervalMs = 15 * 60 * 1000;
export const getFishingClicks = (strong: boolean, net = false) => Math.max(2, (strong ? 3 : 4) - Number(net));
export const getFishCrownThreshold = (id: FishId) => fish[id].length + 14;
export const isGoldCrownFish = (id: FishId, size: number) => size > getFishCrownThreshold(id);

// Separate streams keep the size independent of rarity and the bait's recipe-fish guarantee.
export const sampleFishingCatch = (createdAt: number, cast: number, water: WaterId, bait: 'fishing_bait' | 'river_bait') => {
  const seed = `fishing:${createdAt}:${cast}:${water}:${bait}`;
  const pool = fishIds.filter(id => fish[id].water === water);
  const weight = (id: FishId) => fish[id].weight * (bait === 'river_bait' && ['rare', 'epic', 'legendary'].includes(fish[id].rarity) ? 2.5 : 1);
  let point = (hashString(seed) >>> 0) / 0x100000000 * pool.reduce((sum, id) => sum + weight(id), 0);
  const sampled = pool.find(id => (point -= weight(id)) < 0) ?? pool[pool.length - 1];
  const id = bait === 'fishing_bait' && cast % 3 === 1 ? pool[0] : sampled;
  const crown = hashString(`${seed}:crown`) % 10000 < 1000;
  const threshold = getFishCrownThreshold(id), roll = hashString(`${seed}:length`);
  const size = crown ? threshold + 1 + roll % (Math.ceil(threshold * 1.25) - threshold) : fish[id].length + roll % 15;
  return { fish: id, size };
};
