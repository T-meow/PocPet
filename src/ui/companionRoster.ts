import { resolvePetStatusImages } from '../assets';
import type { InstalledPetModSummary } from '../core/mod';
import type { NeighborReference } from '../core/petTypes';

export interface CompanionPortrait { id: string; name: string; portrait: string }
const fallbackPortrait = resolvePetStatusImages(null).content;
export const genericNeighbor: CompanionPortrait = { id: 'generic-neighbor', name: '热心邻居', portrait: '' };

export const getCompanionRoster = (mods: readonly InstalledPetModSummary[]): CompanionPortrait[] =>
  [...new Map([
    { id: 'official.furo', name: 'Furo', portrait: fallbackPortrait },
    ...mods.map(mod => ({ id: mod.manifest.id, name: mod.manifest.defaultPetName, portrait: mod.contentImageUrl ?? fallbackPortrait })),
  ].map(actor => [actor.id, actor])).values()];

export const resolveCompanionPortrait = (roster: readonly CompanionPortrait[], id: string, name?: string): CompanionPortrait => {
  const actor = roster.find(value => value.id === id);
  return { id, name: name ?? actor?.name ?? '旅途伙伴', portrait: actor?.portrait ?? fallbackPortrait };
};
export const resolveNeighborPortrait = (roster: readonly CompanionPortrait[], reference?: NeighborReference) =>
  reference?.kind === 'mod' ? roster.find(actor => actor.id === reference.modId) ?? genericNeighbor : genericNeighbor;
