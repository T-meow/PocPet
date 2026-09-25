import type { MarketCustomer } from './communityTypes';

export const marketStackLimit = 20;
export const marketMinVisitMs = 5 * 60_000;
export const marketMaxVisitMs = 20 * 60_000;
export const marketSlotCount = (level: number) => level > 0 ? 3 + level * 3 : 0;

// Limit expected base-value turnover, while keeping successful large orders intact.
export const marketDemandBudget = { regular: 20, generous: 200, buyout: 6000 } as const;
export const getMarketBuyoutBonusForLevels = (cookingLevel: number, signLevel: number) => {
  const cooking = Math.max(0, Math.min(9, Math.floor(cookingLevel) - 1)) * 5;
  const decoration = Math.max(0, Math.min(10, Math.floor(signLevel))) * 5;
  return { cooking, decoration, total: cooking + decoration };
};
export const getMarketPurchaseChance = (baseValue: number, customer: MarketCustomer, buyout = false, buyoutBonusPercent = 0) => {
  const budget = customer === 'generous'
    ? buyout ? marketDemandBudget.buyout * (1 + Math.max(0, buyoutBonusPercent) / 100) : marketDemandBudget.generous
    : marketDemandBudget.regular;
  return baseValue > 0 ? Math.min(1, budget / baseValue) : 0;
};

const mix = (value: number) => {
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
};
export const createMarketSeed = (identity: string) => {
  let seed = 0x811c9dc5;
  for (let index = 0; index < identity.length; index++) seed = Math.imul(seed ^ identity.charCodeAt(index), 0x01000193);
  return mix(seed) || 1;
};

// Independent draws per visit keep catch-up, rendering and reloads on the same
// sequence. No draw depends on how many game ticks or save operations occurred.
export const marketRandom = (seed: number, visit: number, draw: number) =>
  mix(seed ^ mix(visit + 1) ^ Math.imul(Math.floor(visit / 0x100000000), 0x9e3779b9) ^ Math.imul(draw + 1, 0x85ebca6b)) / 0x100000000;

export const getMarketVisit = (seed: number, visit: number) => {
  const roll = marketRandom(seed, visit, 1);
  const customer: MarketCustomer = roll < .5 ? 'ordinary' : roll < .75 ? 'foodie' : roll < .9 ? 'collector' : 'generous';
  return {
    delayMs: (5 + Math.floor(marketRandom(seed, visit, 0) * 16)) * 60_000,
    customer,
    // The 2% roll requests a buyout; its total value still controls conversion.
    buyout: customer === 'generous' && marketRandom(seed, visit, 2) < .02,
    quantity: customer === 'generous' ? 8 + Math.floor(marketRandom(seed, visit, 3) * 13) : 1 + Math.floor(marketRandom(seed, visit, 3) * 3),
  };
};
