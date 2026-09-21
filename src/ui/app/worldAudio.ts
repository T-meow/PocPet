import type { BgmMode, SfxId } from '../../core/audio';
import type { FishingSession, AnimalId, FacilityId } from '../../core/communityTypes';
import type { RegionId, ProjectId } from '../../core/expeditionTypes';
import type { PetState } from '../../core/petTypes';
import { isNightTime } from '../../core/utils';
import type { CommunityTab } from '../CommunityPage';
import type { ActivePage } from './useAppNavigation';

export const getPageBgmMode = (page: ActivePage, shopOpen: boolean, sleeping: boolean, communityTab: CommunityTab, now = Date.now()): BgmMode => {
  if (shopOpen) return 'shop';
  if (sleeping) return 'sleep';
  if (page === 'community' && communityTab === 'fishing') return 'fishing';
  if (page === 'adventure' || page === 'expedition') return 'adventure';
  if (isNightTime(now)) return 'night';
  if (page === 'garden' || page === 'community') return 'garden';
  if (page === 'partnerSchedule') return 'community';
  return 'room';
};

// Compare committed outcomes, not button clicks or changing countdown text.
export const getWorldActionSfx = (before: PetState, after: PetState, page: ActivePage): SfxId | undefined => {
  if (before.createdAt !== after.createdAt) return;
  const a = before.community, b = after.community;
  if (page === 'community') {
    const oldFish = a.fishing, fish = b.fishing;
    if (fish.active && fish.active.id !== oldFish.active?.id) return 'fishing_cast';
    if (oldFish.active && !fish.active) return fish.pending?.id === oldFish.active.id ? 'game_catch' : 'game_miss';
    if (oldFish.pending && !fish.pending) return 'purchase';
    if (oldFish.active && fish.active && fish.active.revision > oldFish.active.revision) {
      return fish.active.phase !== oldFish.active.phase || fish.active.progress > oldFish.active.progress ? 'fishing_reel' : 'tap';
    }
    if (!a.gardenBuilt && b.gardenBuilt) return 'notification';
    for (const id of Object.keys(b.facilities) as FacilityId[]) {
      if (!a.facilities[id].built && b.facilities[id].built) return 'notification';
    }
    if (Object.entries(b.upgrades).some(([id, level]) => level > a.upgrades[id as keyof typeof a.upgrades])) return 'notification';
    if (b.plots.some(plot => Boolean(plot.crop) !== Boolean(a.plots.find(previous => previous.id === plot.id)?.crop))) return 'world_harvest';
    for (const id of ['coop', 'barn'] as AnimalId[]) {
      if (b.animals[id].stock < a.animals[id].stock) return 'world_harvest';
      if (b.animals[id].feed > a.animals[id].feed) return 'tap';
      if (!a.animals[id].cared && b.animals[id].cared) return 'action_bath';
    }
    if (after.coins > before.coins) return 'coin';
    if (b.acceptedToday.length > a.acceptedToday.length || b.market.nextListingId > a.market.nextListingId) return 'open';
    if (a.market.open !== b.market.open) return b.market.open ? 'open' : 'close';
  }
  if (page === 'adventure') {
    const oldTrip = before.adventure.active, trip = after.adventure.active;
    if (after.adventure.pending && after.adventure.pending.id !== before.adventure.pending?.id) {
      return after.adventure.pending.returnReason === 'health' ? 'error' : 'notification';
    }
    if (before.adventure.pending && !after.adventure.pending) return 'purchase';
    if (trip && trip.id !== oldTrip?.id) return 'world_step';
    if (after.adventure.discoveries.length > before.adventure.discoveries.length) return 'pet_heart';
    if (oldTrip && trip && trip.revision > oldTrip.revision) {
      if (trip.choices.length > oldTrip.choices.length) return 'world_step';
      if (Object.values(trip.loot).reduce((n, count) => n + count, 0) < Object.values(oldTrip.loot).reduce((n, count) => n + count, 0)) return 'world_harvest';
      return 'tap';
    }
  }
  if (page === 'expedition') {
    const oldState = a.expedition, state = b.expedition, oldTrip = oldState.active, trip = state.active;
    if (state.pending && state.pending.id !== oldState.pending?.id) return state.pending.reason === 'health' ? 'error' : 'notification';
    if (oldState.pending && !state.pending) return 'purchase';
    for (const id of Object.keys(state.regions) as RegionId[]) {
      if (!oldState.regions[id].surveyed && state.regions[id].surveyed) return 'pet_heart';
      if (state.regions[id].base > oldState.regions[id].base) return 'notification';
    }
    for (const id of Object.keys(state.projects) as ProjectId[]) {
      if (state.projects[id].completed > oldState.projects[id].completed) return 'notification';
      if (state.projects[id].stage > oldState.projects[id].stage) return 'action_work_play_medicine';
    }
    if (trip && trip.id !== oldTrip?.id) return 'world_step';
    if (oldTrip && trip && trip.revision > oldTrip.revision) {
      if (trip.rested.length > oldTrip.rested.length) return 'action_blanket';
      if (trip.paused && !oldTrip.paused) return 'close';
      if (trip.leg > oldTrip.leg || trip.step > oldTrip.step) return 'world_step';
      return 'tap';
    }
  }
};

export const createFishingBiteCue = () => {
  let announcedId: string | undefined;
  return (session: FishingSession | undefined, now: number) => {
    if (!session || session.phase !== 'waiting' || now < session.biteAt || now >= session.expiresAt || announcedId === session.id) return false;
    announcedId = session.id;
    return true;
  };
};
