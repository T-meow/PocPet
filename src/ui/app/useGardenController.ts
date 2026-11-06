import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  clearWitheredTree,
  fertilizeTree,
  getGardenClearCost,
  harvestTree,
  plantTree,
  recycleGardenSapling,
  selectGardenSlot,
  unlockGardenSlot,
  upgradeGardenTool,
  useGardenNutrient,
  waterTree,
  type GardenFertilizerId,
  type GardenToolId,
  type GardenTreeId,
  type PetState,
} from '../../core/pet';
import { playSfx, type SfxId } from '../../core/audio';
import { advancePet } from '../../core/petLifecycle';
import type { NeighborIdentity } from '../../core/petTypes';

export type GardenClearConfirm = { slotIndex: number; kind: 'clear' | 'remove'; treeId: GardenTreeId; coins: number };

interface GardenControllerOptions {
  neighbors: readonly NeighborIdentity[];
  petRef: MutableRefObject<PetState>;
  setPet: Dispatch<SetStateAction<PetState>>;
  setPetWithFeedback: Dispatch<SetStateAction<PetState>>;
  commitPet: (next: PetState) => PetState;
  playAfterUnlock: (id: SfxId) => void;
}

export const useGardenController = ({ petRef, setPet, setPetWithFeedback, commitPet, playAfterUnlock, neighbors }: GardenControllerOptions) => {
  const [clearConfirm, setClearConfirm] = useState<GardenClearConfirm | null>(null);

  const commitAction = (action: (current: PetState, now: number) => PetState, successSfx: SfxId = 'coin') => {
    playAfterUnlock('tap');
    setPetWithFeedback((current) => {
      const now = Date.now(), settled = advancePet(current, now);
      const previousEvent = settled.recentEvent;
      const next = action(settled, now);
      playSfx(next.recentEvent === previousEvent ? 'error' : successSfx);
      return commitPet(next);
    });
  };

  const selectSlot = (slotIndex: number) => {
    playAfterUnlock('tap');
    setPet((current) => selectGardenSlot(current, slotIndex));
  };

  const clearSlot = (slotIndex: number) => commitAction((current, now) => clearWitheredTree(current, slotIndex, now), 'purchase');
  const requestClear = (slotIndex: number) => {
    const current = petRef.current;
    const slot = current.garden.slots[slotIndex];
    if (!slot || !slot.treeId || slot.state === 'empty') {
      clearSlot(slotIndex);
      return;
    }

    playAfterUnlock('tap');
    setClearConfirm({
      slotIndex,
      kind: slot.state === 'withered' ? 'clear' : 'remove',
      treeId: slot.treeId,
      coins: getGardenClearCost(current.garden.tools, slot.treeId),
    });
  };

  const cancelClear = () => {
    playAfterUnlock('close');
    setClearConfirm(null);
  };

  const confirmClear = () => {
    const pending = clearConfirm;
    if (!pending) return;
    setClearConfirm(null);
    clearSlot(pending.slotIndex);
  };

  return {
    clearConfirm,
    resetClearConfirm: () => setClearConfirm(null),
    selectSlot,
    unlockSlot: (slotIndex: number) => commitAction((current, now) => unlockGardenSlot(current, slotIndex, now), 'purchase'),
    plantTree: (slotIndex: number, treeId: GardenTreeId) => commitAction((current, now) => plantTree(current, slotIndex, treeId, now, neighbors), 'purchase'),
    recycleSapling: (treeId: GardenTreeId) => commitAction((current, now) => recycleGardenSapling(current, treeId, now), 'coin'),
    waterTree: (slotIndex: number) => commitAction((current, now) => waterTree(current, slotIndex, now, neighbors), 'tap'),
    fertilizeTree: (slotIndex: number, fertilizerId: GardenFertilizerId, quantity = 1) => commitAction((current, now) => fertilizeTree(current, slotIndex, fertilizerId, now, quantity, neighbors), fertilizerId === 'heart' ? 'pet_heart' : 'purchase'),
    useNutrient: (slotIndex: number) => commitAction((current, now) => useGardenNutrient(current, slotIndex, now, neighbors), 'purchase'),
    harvestTree: (slotIndex: number) => commitAction((current, now) => harvestTree(current, slotIndex, now, neighbors), 'coin'),
    requestClear,
    cancelClear,
    confirmClear,
    upgradeTool: (toolId: GardenToolId) => commitAction((current, now) => upgradeGardenTool(current, toolId, now), 'purchase'),
    commitAction,
  };
};
