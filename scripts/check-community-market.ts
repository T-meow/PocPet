import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import postcss from 'postcss';
import { createCommunityTestPet } from './fixtures/community-pet';
import { advanceCommunityMarket, getMarketCapacity, getMarketListingOffer, getMarketQuote, listCommunityGoods, setCommunityMarketOpen, unlistCommunityGoods, upgradeCommunityMarket } from '../src/core/communityMarket';
import { getMarketVisit, marketMaxVisitMs, marketMinVisitMs } from '../src/core/communityMarketRules';
import { normalizeCommunityState } from '../src/core/communityState';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { reconcilePetClock, shiftPetRuntimeTimestamps } from '../src/core/gameClock';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { createItemRegistry } from '../src/core/items';
import type { PetState } from '../src/core/petTypes';

const T = new Date(2026, 8, 20, 10).getTime(), M = 60_000, H = 60 * M, D = 24 * H;
const ready = (seed = 1) => {
  const pet = createCommunityTestPet('commissions', T);
  pet.saveMetadata.id = 'save:market-regression';
  pet.community.market.seed = seed;
  pet.community.expedition.regions.valley.surveyed = true;
  pet.inventory = { ...pet.inventory, egg: 400, apple: 400, carrot: 400, golden_koi: 400, valley_amber: 400, valley_mushroom: 4, creek_aquamarine: 1 };
  return pet;
};
const list = (pet: PetState, id: string, quantity: number, now = T) => listCommunityGoods(pet, id, quantity, pet.community.market.nextListingId, now);
const read = (pet: PetState, now = T) => parseSaveFileText(createSaveFileText(pet, null, now), now).pet;
const stocked = (seed = 1, entries: [string, number][] = [['egg', 20]]) => {
  let pet = ready(seed);
  for (const [id, quantity] of entries) pet = list(pet, id, quantity);
  return setCommunityMarketOpen(pet, true, T);
};
const seedFor = (predicate: (visit: ReturnType<typeof getMarketVisit>) => boolean) => {
  for (let seed = 1; seed <= 100_000; seed++) if (predicate(getMarketVisit(seed, 0))) return seed;
  throw new Error('No deterministic visit fixture');
};
const ordinarySeed = seedFor(visit => visit.customer === 'ordinary' && visit.quantity === 2);
const collectorSeed = seedFor(visit => visit.customer === 'collector');
const generousSeed = seedFor(visit => visit.customer === 'generous' && !visit.buyout && visit.quantity >= 12);
const buyoutSeed = seedFor(visit => visit.buyout);

// Stacking, immutable prices, exactly one target slot, stale clicks and vacancies.
let pet = list(ready(), 'egg', 19);
const originalPrice = pet.community.market.listings[0].unitPrice, originalId = pet.community.market.listings[0].id;
assert.equal(pet.inventory.egg, 381);
assert.equal(getMarketListingOffer(pet, 'egg')!.quantityLimit, 1);
assert.equal(list(pet, 'egg', 2), pet, 'a transaction cannot silently spill into a differently priced slot');
const expected = pet.community.market.nextListingId;
pet = listCommunityGoods(pet, 'egg', 1, expected, T);
assert.equal(listCommunityGoods(pet, 'egg', 1, expected, T), pet, 'merged stacks are also guarded against duplicate actions');
assert.deepEqual(pet.community.market.listings.map(row => [row.id, row.slotIndex, row.quantity]), [[originalId, 0, 20]]);
pet = list(pet, 'egg', 3);
assert.deepEqual(pet.community.market.listings.map(row => row.slotIndex), [0, 1]);
pet = upgradeCommunityMarket(pet, 1, T);
pet.partnerSchedule.skills.study.level = 10;
assert(getMarketQuote(pet, 'egg')!.price > originalPrice);
assert.equal(getMarketListingOffer(pet, 'egg')!.unitPrice, originalPrice);
pet = list(pet, 'egg', 17);
assert.equal(pet.community.market.listings[1].quantity, 20);
assert.equal(pet.community.market.listings[1].unitPrice, originalPrice);
const secondId = pet.community.market.listings[1].id;
pet = unlistCommunityGoods(pet, originalId, T);
assert.equal(pet.community.market.listings[0].slotIndex, 1, 'selling/unlisting a slot must not compact the shelf');
assert.equal(getMarketListingOffer(pet, 'egg')!.slotIndex, 0);
assert.equal(getMarketListingOffer(pet, 'egg')!.unitPrice, getMarketQuote(pet, 'egg')!.price);
pet = list(pet, 'egg', 5);
const overflow = { ...pet, inventory: { ...pet.inventory, egg: 9999 } };
assert.equal(unlistCommunityGoods(overflow, secondId, T).community.market, overflow.community.market);
assert.deepEqual(read(pet).community.market, pet.community.market);

for (const level of [1, 2, 3]) {
  let full = ready(); full.community.market.level = level;
  for (let index = 0; index < getMarketCapacity(full); index++) full = list(full, 'egg', 20);
  const capacity = 3 + level * 3;
  assert.equal(full.community.market.listings.length, capacity);
  assert.equal(full.community.market.listings.reduce((total, row) => total + row.quantity, 0), capacity * 20);
  assert.equal(getMarketListingOffer(full, 'egg'), undefined);
  assert.equal(list(full, 'carrot', 1), full);
  assert.deepEqual(read(full).community.market, full.community.market, 'all 240 items survive a max-level save round trip');
}

// One visit's economy, rare-item eligibility, cross-slot receipts and full buyouts.
for (const [seed, kind] of [[ordinarySeed, 'ordinary'], [collectorSeed, 'collector'], [generousSeed, 'generous'], [buyoutSeed, 'generous']] as const) {
  const start = stocked(seed, [['egg', 5], ['apple', 5], ['golden_koi', 5], ['valley_amber', 5]]);
  const due = start.community.market.nextVisitAt!;
  assert.equal(advanceCommunityMarket(start, due - 1), start);
  const result = advanceCommunityMarket(start, due), state = result.community.market, receipt = state.log[0];
  assert.equal(state.visitors, 1);
  assert.equal(receipt.customer, kind);
  assert.equal(result.coins - start.coins, receipt.coins);
  assert.equal(receipt.items.reduce((total, item) => total + item.coins, 0), receipt.coins);
  assert.equal(receipt.items.reduce((total, item) => total + item.quantity, 0), state.sold);
  assert.equal(advanceCommunityMarket(result, due), result, 'a visit cannot pay twice');
  assert.equal(result.hearts, start.hearts);
  if (seed === ordinarySeed) {
    assert.equal(state.sold, 3, 'basic produce uses the 2–4 unit demand range');
    assert(receipt.items.every(item => ['egg', 'apple'].includes(item.itemId)));
  } else if (seed === collectorSeed) assert(receipt.items.every(item => ['golden_koi', 'valley_amber'].includes(item.itemId)));
  else if (seed === generousSeed) {
    assert.equal(state.sold, getMarketVisit(seed, 0).quantity);
    assert(receipt.items.length >= 3, 'a generous purchase crosses shelves and includes rare goods');
  } else {
    assert.equal(state.sold, 20); assert.equal(state.listings.length, 0); assert(receipt.buyout);
    assert.equal(state.nextVisitAt, undefined);
  }
  assert.deepEqual(read(result, due).community.market, state);
}
const onlyRare = stocked(ordinarySeed, [['golden_koi', 20]]);
const noSale = advanceCommunityMarket(onlyRare, onlyRare.community.market.nextVisitAt!);
assert.equal(noSale.community.market.sold, 0); assert.equal(noSale.community.market.visitors, 1);
const fallback = stocked(collectorSeed);
assert(advanceCommunityMarket(fallback, fallback.community.market.nextVisitAt!).community.market.sold > 0);
const partial = stocked(ordinarySeed);
const afterPartial = advanceCommunityMarket(partial, partial.community.market.nextVisitAt!);
assert.equal(getMarketListingOffer(afterPartial, 'egg')!.quantityLimit, 3);
assert.equal(listCommunityGoods(partial, 'egg', 1, partial.community.market.nextListingId, partial.community.market.nextVisitAt!).inventory.egg, partial.inventory.egg, 'a sale during a manual click invalidates its stale quote');

const nearlyFull = stocked(buyoutSeed, [['egg', 20], ['golden_koi', 20]]);
nearlyFull.coins = Number.MAX_SAFE_INTEGER - 10;
const capped = advanceCommunityMarket(nearlyFull, nearlyFull.community.market.nextVisitAt!);
assert.equal(capped.community.market.sold, 2);
assert.equal(capped.coins, nearlyFull.coins + 8);
assert(!capped.community.market.log[0].buyout, 'partial payment must not claim a successful buyout');
assert.equal(capped.community.market.listings.reduce((sum, row) => sum + row.quantity, 0), 38);
assert.equal(capped.community.market.nextVisitAt, undefined);
assert.equal(advanceCommunityMarket(capped, T + D), capped);
const spent = { ...capped, coins: capped.coins - 1000 };
assert.equal(advanceCommunityMarket(spent, T + D).community.market.nextVisitAt, T + D + capped.community.market.remainingVisitMs!);

// Reload/split/offline identity, close/reopen without rerolls, restock without backlog.
const commonEntries: [string, number][] = Array.from({ length: 6 }, () => ['egg', 20]);
const start = stocked(ordinarySeed, commonEntries), end = T + 3 * D;
let split = start;
for (let at = T + 17 * M; at < end; at += 17 * M) split = advanceCommunityMarket({ ...split, community: normalizeCommunityState(JSON.parse(JSON.stringify(split.community))) }, at);
split = advanceCommunityMarket(split, end);
const lumped = advanceCommunityMarket(start, end);
assert.deepEqual(split.community.market, lumped.community.market);
assert.equal(split.coins, lumped.coins);
assert.equal(lumped.community.market.sold, 120);
assert.equal(lumped.community.market.log.length, 8);
assert.equal(advanceCommunityMarket(lumped, T + 3650 * D), lumped, 'long offline time stops once stock is exhausted');
const due = start.community.market.nextVisitAt!;
let closed = setCommunityMarketOpen(start, false, T + 2 * M);
assert.equal(closed.community.market.remainingVisitMs, due - T - 2 * M);
closed = read(closed, T + 2 * M);
assert.equal(advanceCommunityMarket(closed, end), closed);
const reopened = setCommunityMarketOpen(closed, true, end);
assert.equal(reopened.community.market.nextVisitAt, end + due - T - 2 * M);
assert.equal(reopened.community.market.seed, start.community.market.seed);
assert.equal(reopened.community.market.visitors, start.community.market.visitors);
const toggled = setCommunityMarketOpen(setCommunityMarketOpen(reopened, false, end), true, end);
assert.deepEqual(toggled.community.market, reopened.community.market);
const stockedAgain = list(lumped, 'egg', 20, end);
assert.equal(stockedAgain.community.market.sold, 120);
assert.equal(stockedAgain.community.market.nextVisitAt, end + lumped.community.market.remainingVisitMs!);
const newEmpty = setCommunityMarketOpen(ready(), true, T);
assert.equal(advanceCommunityMarket(newEmpty, end), newEmpty);
assert.equal(list(newEmpty, 'egg', 20, end).community.market.nextVisitAt, end + newEmpty.community.market.remainingVisitMs!);

// v3 migration preserves quantities, prices, identities, receipts and stats.
const old = ready();
const legacy = { ...old.community, schemaVersion: 3, market: {
  level: 1, open: true, lastVisitAt: T, visitors: 9, nextListingId: 8, reserve: {}, revenue: 120, premium: 20, sold: 30,
  listings: [{ id: 5, itemId: 'egg', quantity: 2, basePrice: 3, unitPrice: 4, bonus: 20, collector: false }, { id: 7, itemId: 'egg', quantity: 4, basePrice: 3, unitPrice: 5, bonus: 40, collector: false }],
  log: [{ itemId: 'egg', quantity: 1, coins: 4, at: T - M }],
} };
const migrated = normalizeCommunityState(legacy);
assert.equal(migrated.schemaVersion, 8);
assert.deepEqual(migrated.market.listings.map(row => [row.id, row.slotIndex, row.quantity, row.unitPrice]), [[5, 0, 2, 4], [7, 1, 4, 5]]);
assert.deepEqual([migrated.market.revenue, migrated.market.premium, migrated.market.sold, migrated.market.visitors], [120, 20, 30, 9]);
assert.equal(migrated.market.log[0].customer, 'legacy');
assert.deepEqual(migrated.market.log[0].items, [{ itemId: 'egg', quantity: 1, coins: 4 }]);
assert.deepEqual(normalizeCommunityState(migrated), migrated);
const migratedPet = { ...old, community: migrated };
const initialized = advanceCommunityMarket(migratedPet, T);
assert(initialized.community.market.seed > 0);
assert.deepEqual(advanceCommunityMarket(read(migratedPet), T).community.market, initialized.community.market);
assert.equal(initialized.coins, old.coins, 'migration cannot pay already-settled sales again');

// Freeze/resume and wall-clock rollback shift deadlines, never random progress.
const pauseAt = T + M, resumeAt = pauseAt + 30 * D;
const frozen = prepareTimePause(start, pauseAt, { neighbors: [], giftCandidates: [], random: () => .999 });
const resumed = resumePetTime(frozen, resumeAt);
assert.equal(resumed.community.market.nextVisitAt! - resumeAt, frozen.community.market.nextVisitAt! - pauseAt);
assert.equal(resumed.community.market.seed, frozen.community.market.seed);
assert.equal(resumed.community.market.visitors, frozen.community.market.visitors);
assert.deepEqual(advanceCommunityMarket(resumed, resumeAt).community.market, resumed.community.market);
const pausedClosed = shiftPetRuntimeTimestamps(closed, 30 * D, true);
assert.equal(pausedClosed.community.market.remainingVisitMs, closed.community.market.remainingVisitMs);
const rollback = reconcilePetClock({ ...start, timeGuard: { ...start.timeGuard, lastObservedAt: T }, lastUpdatedAt: T }, T - H).pet;
assert.equal(rollback.community.market.nextVisitAt, due - H);
assert.equal(rollback.community.market.seed, start.community.market.seed);
assert.equal(advanceCommunityMarket(start, T - H), start);

// Fixed-seed distribution checks catch accidental 2%-of-all-visitors buyouts.
const counts = { ordinary: 0, foodie: 0, collector: 0, generous: 0, buyout: 0 };
const delays = new Set<number>();
for (let index = 0; index < 100_000; index++) {
  const visit = getMarketVisit(0x53a4d7c1, index);
  counts[visit.customer]++; if (visit.buyout) counts.buyout++;
  assert(visit.delayMs >= marketMinVisitMs && visit.delayMs <= marketMaxVisitMs && visit.delayMs % M === 0);
  assert(visit.quantity >= (visit.customer === 'generous' ? 8 : 1) && visit.quantity <= (visit.customer === 'generous' ? 20 : 3));
  delays.add(visit.delayMs);
}
assert.equal(delays.size, 16);
assert(Math.abs(counts.ordinary / 100_000 - .50) < .008);
assert(Math.abs(counts.foodie / 100_000 - .25) < .008);
assert(Math.abs(counts.collector / 100_000 - .15) < .008);
assert(Math.abs(counts.generous / 100_000 - .10) < .008);
assert(Math.abs(counts.buyout / counts.generous - .02) < .004);
const selloutHours: number[] = [];
for (let seed = 1; seed <= 512; seed++) {
  const result = advanceCommunityMarket(stocked(seed, commonEntries), T + 3 * D);
  assert.equal(result.community.market.sold, 120);
  selloutHours.push((result.community.market.lastVisitAt - T) / H);
}
selloutHours.sort((a, b) => a - b);
const median = selloutHours[Math.floor(selloutHours.length / 2)];
assert(median >= 6 && median <= 10, 'the initial fully stocked common-goods stall retains its intended pace');
console.log(`Market core passed: stacking, quotes, migration, customer eligibility, bulk receipts, coin safety, offline/reload/pause/rollback equivalence. Seeded sellout median ${median.toFixed(2)}h; generous buyout rate ${(100 * counts.buyout / counts.generous).toFixed(2)}%.`);

// Static React checks; visual and touch acceptance stays with the user.
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { CommunityMarket } = await server.ssrLoadModule('/src/ui/community/CommunityMarket.tsx');
  const { CommunityMarketArt } = await server.ssrLoadModule('/src/ui/community/CommunityMarketArt.tsx');
  const noop = () => {};
  const renderPet = list(list(ready(), 'egg', 20), 'carrot', 7);
  const html = renderToStaticMarkup(createElement(CommunityMarket, { pet: renderPet, registry: createItemRegistry(), itemIconMap: { egg: 'custom-egg.svg', carrot: 'custom-carrot.svg' }, update: noop, onShop: noop, onExplore: noop, onKitchen: noop }));
  assert.equal((html.match(/data-market-slot=/g) ?? []).length, 6);
  assert.equal((html.match(/<image /g) ?? []).length, 2, 'one icon per occupied slot, not per unit');
  assert(html.includes('href="custom-egg.svg"') && html.includes('href="custom-carrot.svg"'));
  assert(html.includes('data-quantity="20"') && html.includes('data-quantity="7"'));
  assert(!html.includes('data-market-visitor='), 'opening a market scene does not replay old transactions');
  for (const level of [1, 2, 3]) {
    const market = { ...renderPet.community.market, level };
    const art = renderToStaticMarkup(createElement(CommunityMarketArt, { market, iconFor: () => 'item.svg', nameFor: (id: string) => id, visitor: { customer: 'generous' } }));
    assert.equal((art.match(/data-market-slot=/g) ?? []).length, 3 + level * 3);
    assert(art.includes('data-market-visitor="generous"'));
    assert(!/NaN|undefined/.test(art));
  }
  postcss.parse(readFileSync('src/styles/community-places.css', 'utf8'));
  console.log('Market React passed: fixed slots at all levels, actual/custom icons, stack badges, visitor SVG, no initial replay; CSS parsed. Visual/touch acceptance is manual.');
} finally { await server.close(); }
