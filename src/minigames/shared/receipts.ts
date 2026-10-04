import type { GameStates } from '../types';

export function normalizeGameReceipts(raw: unknown, games: GameStates): string[] {
  const ids = Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128))] : [];
  if (ids.length <= 64) return ids;
  // A completed board may remain in another game while many rounds are played.
  // Its receipt must survive until that board is replaced with a new round.
  const currentIds = new Set(Object.values(games).map(game => game.id));
  const pinned = ids.filter(id => currentIds.has(id));
  const recent = ids.filter(id => !currentIds.has(id)).slice(-(64 - pinned.length));
  const keep = new Set([...pinned, ...recent]);
  return ids.filter(id => keep.has(id));
}
