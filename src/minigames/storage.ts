import { createBlocks, normalizeBlocks } from './blocks/rules';
import { createWater, normalizeWater } from './water/rules';
import { createFruit, normalizeFruit } from './fruit/state';
import { createNonogram, normalizeNonogram } from './nonogram/rules';
import { createMatch3, normalizeMatch3 } from './match3/rules';
import { integer, object } from './shared/state';
import { normalizeGameReceipts } from './shared/receipts';
import type { MiniGamesSave, MiniGameHost } from './types';

export const previewStorageKey = 'pocpet.preview.relax-games.v1';
export const createMiniGamesSave = (): MiniGamesSave => ({ schemaVersion: 1, activeGame: 'blocks', sound: false, games: { blocks: createBlocks(), water: createWater(), fruit: createFruit(), nonogram: createNonogram(), match3: createMatch3() }, reportedSessions: [] });
export function normalizeMiniGamesSave(raw: unknown): MiniGamesSave {
  let parsed = raw;
  if (typeof raw === 'string') { try { parsed = JSON.parse(raw); } catch { parsed = null; } }
  const v = object(parsed), games = object(v.games);
  if (v.schemaVersion !== undefined && v.schemaVersion !== 1) return createMiniGamesSave();
  const blocks = normalizeBlocks(games.blocks);
  if (!games.blocks) blocks.best = Math.max(blocks.best, integer(v.best));
  const states = { blocks, water: normalizeWater(games.water), fruit: normalizeFruit(games.fruit), nonogram: normalizeNonogram(games.nonogram), match3: normalizeMatch3(games.match3) };
  return {
    schemaVersion: 1, activeGame: v.activeGame === 'water' || v.activeGame === 'fruit' ? v.activeGame : v.activeGame === 'match3' || v.activeGame === 'nonogram' ? 'match3' : 'blocks', sound: v.sound === true,
    games: states,
    reportedSessions: normalizeGameReceipts(v.reportedSessions, states),
  };
}
// Storage is supplied by the standalone host; game rules never access browser or pet storage.
export const createPreviewHost = (storage: Pick<Storage, 'getItem' | 'setItem'>): MiniGameHost => ({
  load: () => storage.getItem(previewStorageKey),
  save: snapshot => storage.setItem(previewStorageKey, JSON.stringify(snapshot)),
});
