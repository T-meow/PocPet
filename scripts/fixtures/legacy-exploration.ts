import { startAdventure as startCurrentAdventure } from '../../src/core/adventure';
import { startExpedition as startCurrentExpedition } from '../../src/core/expedition';
import { explorationTravel } from '../../src/core/explorationTravelData';
import { lockRationSegments, standardRationPrice } from '../../src/core/explorationRations';

// Fixed-cost regression suites model trips that departed before skill checks.
// Current version 9/4 journeys are covered by check-exploration-checks.ts.
export const startAdventure: typeof startCurrentAdventure = (...args) => {
  const p = startCurrentAdventure(...args), t = p.adventure.active;
  if (t?.rulesVersion === 9) { const { checkState: _state, rewardsVersion: _rewards, gatherBonus: _bonus, ...legacy } = t; return { ...p, adventure: { ...p.adventure, active: { ...legacy, rulesVersion: 8 } } }; }
  return p;
};
export const startExpedition: typeof startCurrentExpedition = (...args) => {
  const p = startCurrentExpedition(...args), t = p.community.expedition.active;
  if (t) {
    const { rewardsVersion: _rewards, gatherBonus: _bonus, ...legacy } = t;
    if (legacy.rulesVersion === 4 && legacy.mode === 'manual') { const { checkState: _state, ...fixed } = legacy; return { ...p, community: { ...p.community, expedition: { ...p.community.expedition, active: { ...fixed, rulesVersion: 3 } } } }; }
    return { ...p, community: { ...p.community, expedition: { ...p.community.expedition, active: legacy } } };
  }
  return p;
};

// Historical standard, per-segment rations. Keep refund regression checks tied to
// their saved contract; the current pooled plan is tested in check-idle-rations.ts.
export const startLegacyRationExpedition: typeof startCurrentExpedition = (...args) => {
  const p = startExpedition(...args), t = p.community.expedition.active;
  if (!t || t.mode !== 'idle' || !t.rationPlan) return p;
  if (args[10]?.rations) throw new Error('The historical fixture supports standard rations only');
  const profile = explorationTravel[t.route[0]], purchased = Math.max(profile.meals, Math.ceil(profile.nutrition / 36));
  const segments = Array.from({ length: t.parts / 2 }, () => ({ food: {}, purchased, price: purchased * standardRationPrice, count: purchased, hunger: purchased * 36, score: purchased * 54, chance: 3, reason: '' }));
  const { rationPlan: _plan, ...legacy } = t;
  const rationSegments = lockRationSegments(segments, `${p.createdAt}:${args[0].community.expedition.nextId}:${t.startedAt}`);
  return { ...p, community: { ...p.community, expedition: { ...p.community.expedition, active: { ...legacy, rationSegments } } } };
};
