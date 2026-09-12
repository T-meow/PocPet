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

export type GardenClearConfirm = { slotIndex: number; kind: 'clear' | 'remove'; treeId: GardenTreeId; coins: number };

interface GardenControllerOptions {
  petRef: MutableRefObject<PetState>;
  setPet: Dispatch<SetStateAction<PetState>>;
  setPetWithFeedback: Dispatch<SetStateAction<PetState>>;
  commitPet: (next: PetState) => PetState;
  playAfterUnlock: (id: SfxId) => void;
}

export const useGardenController = ({ petRef, setPet, setPetWithFeedback, commitPet, playAfterUnlock }: GardenControllerOptions) => {
  const [clearConfirm, setClearConfirm] = useState<GardenClearConfirm | null>(null);

  const commitAction = (action: (current: PetState) => PetState, successSfx: SfxId = 'coin') => {
    playAfterUnlock('tap');
    setPetWithFeedback((current) => {
      const previousEvent = current.recentEvent;
      const next = action(current);
      playSfx(next.recentEvent === previousEvent ? 'error' : successSfx);
      return commitPet(next);
    });
  };

  const selectSlot = (slotIndex: number) => {
    playAfterUnlock('tap');
    setPet((current) => selectGardenSlot(current, slotIndex));
  };

  const clearSlot = (slotIndex: number) => commitAction((current) => clearWitheredTree(current, slotIndex), 'purchase');
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
      coins: getGardenClearCost(current.garden.tools),
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
    unlockSlot: (slotIndex: number) => commitAction((current) => unlockGardenSlot(current, slotIndex), 'purchase'),
    plantTree: (slotIndex: number, treeId: GardenTreeId) => commitAction((current) => plantTree(current, slotIndex, treeId), 'purchase'),
    recycleSapling: (treeId: GardenTreeId) => commitAction((current) => recycleGardenSapling(current, treeId), 'coin'),
    waterTree: (slotIndex: number) => commitAction((current) => waterTree(current, slotIndex), 'tap'),
    fertilizeTree: (slotIndex: number, fertilizerId: GardenFertilizerId) => commitAction((current) => fertilizeTree(current, slotIndex, fertilizerId), fertilizerId === 'heart' ? 'pet_heart' : 'purchase'),
    useNutrient: (slotIndex: number) => commitAction((current) => useGardenNutrient(current, slotIndex), 'purchase'),
    harvestTree: (slotIndex: number) => commitAction((current) => harvestTree(current, slotIndex), 'coin'),
    requestClear,
    cancelClear,
    confirmClear,
    upgradeTool: (toolId: GardenToolId) => commitAction((current) => upgradeGardenTool(current, toolId), 'purchase'),
    commitAction,
  };
};
