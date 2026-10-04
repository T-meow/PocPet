import type { MarketCustomer } from './communityTypes';

export const marketStackLimit = 20;
export const marketMinVisitMs = 2 * 60_000;
export const marketMaxVisitMs = 6 * 60_000;
export const marketSlotCount = (level: number) => level > 0 ? 3 + level * 3 : 0;

export const getMarketBuyoutBonusForLevels = (cookingLevel: number, signLevel: number) => {
  const cooking = Math.max(0, Math.min(9, Math.floor(cookingLevel) - 1)) * 5;
  const decoration = Math.max(0, Math.min(10, Math.floor(signLevel))) * 5;
  return { cooking, decoration, total: cooking + decoration };
};
export const getMarketBuyoutChance = (bonusPercent = 0) => Math.min(1, .02 * (1 + Math.max(0, bonusPercent) / 100));

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

export const getMarketVisit = (seed: number, visit: number, trafficBonusPercent = 0, buyoutBonusPercent = 0) => {
  const roll = marketRandom(seed, visit, 1);
  const customer: MarketCustomer = roll < .5 ? 'ordinary' : roll < .75 ? 'foodie' : roll < .9 ? 'collector' : 'generous';
  const baseDelayMs = marketMinVisitMs + Math.floor(marketRandom(seed, visit, 0) * ((marketMaxVisitMs - marketMinVisitMs) / 60_000 + 1)) * 60_000;
  return {
    delayMs: Math.max(1, Math.round(baseDelayMs / (1 + Math.max(0, trafficBonusPercent) / 100))),
    customer,
    buyout: customer === 'generous' && marketRandom(seed, visit, 2) < getMarketBuyoutChance(buyoutBonusPercent),
    quantity: customer === 'generous' ? 8 + Math.floor(marketRandom(seed, visit, 3) * 13) : 1 + Math.floor(marketRandom(seed, visit, 3) * 3),
  };
};
