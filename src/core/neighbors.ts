import type { NeighborIdentity, NeighborReference } from './petTypes';
import { hashString } from './utils';

export const neighborGiftDailyLimit = 3;
export const builtinFuroNeighborId = 'official.furo';

type NeighborModSummary = {
  manifest: {
    id: string;
    defaultPetName: string;
  };
};

const builtinNeighborIdentities: readonly NeighborIdentity[] = [
  { modId: builtinFuroNeighborId, name: 'Furo' },
  { modId: 'official.doro', name: 'Doro' },
  { modId: 'official.mint', name: 'mint' },
];

const sortedNeighbors = (neighbors: readonly NeighborIdentity[]) =>
  [...neighbors].sort((left, right) => left.modId.localeCompare(right.modId));

export const getNeighborIdentities = (
  installedMods: readonly NeighborModSummary[],
  activeModId?: string,
): NeighborIdentity[] => {
  const activeNeighborId = activeModId ?? builtinFuroNeighborId;
  const neighborsById = new Map<string, NeighborIdentity>();

  [...builtinNeighborIdentities, ...installedMods.map((mod) => ({
    modId: mod.manifest.id,
    name: mod.manifest.defaultPetName,
  }))].forEach((neighbor) => {
    if (neighbor.modId !== activeNeighborId && !neighborsById.has(neighbor.modId)) {
      neighborsById.set(neighbor.modId, neighbor);
    }
  });

  return sortedNeighbors([...neighborsById.values()]);
};

export const selectNeighborReference = (
  seed: string,
  neighbors: readonly NeighborIdentity[],
): NeighborReference => {
  const available = sortedNeighbors(neighbors);
  if (available.length === 0) return { kind: 'generic' };
  return { kind: 'mod', modId: available[hashString(`${seed}:neighbor`) % available.length].modId };
};

export const resolveNeighborName = (
  reference: NeighborReference | undefined,
  neighbors: readonly NeighborIdentity[],
) => {
  if (reference?.kind !== 'mod') return undefined;
  return neighbors.find((neighbor) => neighbor.modId === reference.modId)?.name;
};
