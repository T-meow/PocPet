import type { PetState } from './petTypes';

export const migrationCompensationRewardId = 'save_v2_migration_gift_v1';
export const inventoryItemLimit = 9999;
export const migrationCompensationItems = { emergency_biscuit: 120, strawberry_milk: 10 } as const;
export type MigrationItemId = keyof typeof migrationCompensationItems;
export interface SaveMetadata {
  id: string;
  origin: 'new' | 'legacy';
  compensation: 'ineligible' | 'pending' | 'claimed';
  pendingItems: Partial<Record<MigrationItemId, number>>;
}

let saveSequence = 0;
export const createNewSaveMetadata = (now: number): SaveMetadata => ({
  id: `save:${globalThis.crypto?.randomUUID?.() ?? `${now.toString(36)}-${(++saveSequence).toString(36)}`}`,
  origin: 'new', compensation: 'ineligible', pendingItems: {},
});

// Legacy identity survives renamed pets, changed appearances and repeated previews.
const legacyDigest = (text: string) => {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const byte of new TextEncoder().encode(text)) {
    first = Math.imul(first ^ byte, 0x01000193) >>> 0;
    second = Math.imul(second ^ byte, 0x85ebca6b) >>> 0;
  }
  return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
};
export const isSaveMetadata = (value: unknown): value is SaveMetadata => {
  if (!value || typeof value !== 'object') return false;
  const raw = value as SaveMetadata;
  return typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 128
    && (raw.origin === 'new' || raw.origin === 'legacy')
    && ['ineligible', 'pending', 'claimed'].includes(raw.compensation)
    && Boolean(raw.pendingItems) && typeof raw.pendingItems === 'object' && !Array.isArray(raw.pendingItems);
};
export const normalizeSaveMetadata = (value: unknown, rawPet: Record<string, unknown>): SaveMetadata => {
  if (isSaveMetadata(value)) {
    const pendingItems: SaveMetadata['pendingItems'] = {};
    if (value.origin === 'legacy' && value.compensation === 'claimed') {
      for (const id of Object.keys(migrationCompensationItems) as MigrationItemId[]) {
        const amount = value.pendingItems[id];
        if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) pendingItems[id] = Math.min(migrationCompensationItems[id], Math.floor(amount));
      }
    }
    return { id: value.id, origin: value.origin, compensation: value.origin === 'new' ? 'ineligible' : value.compensation, pendingItems };
  }
  const gacha = rawPet.goldenAppleGacha as { rngSeed?: unknown } | undefined;
  const legacyStartedAt = typeof rawPet.ageSeconds === 'number' && Number.isFinite(rawPet.ageSeconds) && rawPet.ageSeconds >= 0
    && typeof rawPet.lastUpdatedAt === 'number' && Number.isFinite(rawPet.lastUpdatedAt)
    ? Math.max(0, Math.round((rawPet.lastUpdatedAt - rawPet.ageSeconds * 1000) / 1000)) : undefined;
  const { name: _name, recentEvent: _event, recentActivity: _activity, recentActivityUntil: _until, ...legacyProgress } = rawPet;
  const identity = typeof rawPet.createdAt === 'number' && Number.isFinite(rawPet.createdAt) && rawPet.createdAt >= 0
    ? `created:${rawPet.createdAt}`
    : typeof gacha?.rngSeed === 'string' && gacha.rngSeed ? `rng:${gacha.rngSeed}`
      : legacyStartedAt !== undefined ? `legacy-start:${legacyStartedAt}` : JSON.stringify(legacyProgress);
  return { id: `legacy:${legacyDigest(identity)}`, origin: 'legacy', compensation: 'pending', pendingItems: {} };
};

export const settlePendingMigrationItems = (pet: PetState): { pet: PetState; granted: SaveMetadata['pendingItems'] } => {
  const granted: SaveMetadata['pendingItems'] = {};
  const pending = pet.saveMetadata?.pendingItems;
  if (!pending || pet.saveMetadata.compensation !== 'claimed') return { pet, granted };
  const inventory = { ...pet.inventory };
  const remaining = { ...pending };
  for (const id of Object.keys(migrationCompensationItems) as MigrationItemId[]) {
    const amount = Math.min(pending[id] ?? 0, Math.max(0, inventoryItemLimit - (inventory[id] ?? 0)));
    if (amount <= 0) continue;
    granted[id] = amount;
    inventory[id] = (inventory[id] ?? 0) + amount;
    remaining[id] = (pending[id] ?? 0) - amount;
    if (!remaining[id]) delete remaining[id];
  }
  return Object.keys(granted).length
    ? { pet: { ...pet, inventory, saveMetadata: { ...pet.saveMetadata, pendingItems: remaining } }, granted }
    : { pet, granted };
};

export const prepareMigrationCompensation = (pet: PetState, previouslyDelivered: SaveMetadata['pendingItems'] = {}): { pet: PetState; granted: SaveMetadata['pendingItems']; delivered: SaveMetadata['pendingItems'] | undefined } => {
  if (pet.saveMetadata.origin !== 'legacy' || pet.saveMetadata.compensation === 'ineligible') return { pet, granted: {}, delivered: undefined };
  const hasMarker = pet.claimedRewardIds.includes(migrationCompensationRewardId);
  const incomingPending = pet.saveMetadata.compensation === 'pending'
    ? hasMarker ? {} : migrationCompensationItems
    : pet.saveMetadata.pendingItems;
  const pendingItems: SaveMetadata['pendingItems'] = {};
  const delivered: SaveMetadata['pendingItems'] = {};
  for (const id of Object.keys(migrationCompensationItems) as MigrationItemId[]) {
    const entitlement = migrationCompensationItems[id];
    delivered[id] = Math.max(previouslyDelivered[id] ?? 0, entitlement - (incomingPending[id] ?? 0));
    const remaining = Math.max(0, entitlement - delivered[id]!);
    if (remaining) pendingItems[id] = remaining;
  }
  const pendingChanged = (Object.keys(migrationCompensationItems) as MigrationItemId[]).some((id) => (pendingItems[id] ?? 0) !== (pet.saveMetadata.pendingItems[id] ?? 0));
  const prepared = pet.saveMetadata.compensation === 'claimed' && hasMarker && !pendingChanged ? pet : {
    ...pet,
    claimedRewardIds: Array.from(new Set([...pet.claimedRewardIds, migrationCompensationRewardId])),
    saveMetadata: { ...pet.saveMetadata, compensation: 'claimed' as const, pendingItems },
  };
  const result = settlePendingMigrationItems(prepared);
  for (const id of Object.keys(migrationCompensationItems) as MigrationItemId[]) delivered[id] = delivered[id]! + (result.granted[id] ?? 0);
  return { ...result, delivered };
};
