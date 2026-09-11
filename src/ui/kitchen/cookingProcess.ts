import type { CookingMethod, RecipeId } from '../../core/companionActivityTypes';
import type { SfxId } from '../../core/audio';
import { activityText as L } from '../../core/kitchenRecipes';

export interface KitchenCraftRequest { id: string; recipeId: RecipeId; banana: boolean; quantity: number; }
export type CookingAction = 'add' | 'stir' | 'flip' | 'blend' | 'bake' | 'simmer' | 'serve';
export interface CookingProgress { step: number; readyAt: number; action?: CookingAction; }
export const createCookingProgress = (): CookingProgress => ({ step: 0, readyAt: 0 });
export const getCookingActions = (method: CookingMethod, technique?: 'simmer'): readonly CookingAction[] => ['add', technique ?? { mix: 'stir' as const, pan: 'flip' as const, blender: 'blend' as const, oven: 'bake' as const }[method], 'serve'];
export const getCookingActionText = (action: CookingAction) => ({
  add: L('放入食材', 'Add ingredients'), stir: L('轻轻拌匀', 'Stir gently'), flip: L('翻炒一下', 'Toss the pan'),
  blend: L('按下搅拌', 'Blend it'), bake: L('烘烤一下', 'Bake it'), simmer: L('加水焖煮', 'Simmer with water'), serve: L('装盘出炉', 'Plate it up'),
})[action];
export const cookingActionSound = (action: CookingAction): SfxId => `kitchen_${action}`;
export const beginCookingStep = (progress: CookingProgress, method: CookingMethod, now: number, technique?: 'simmer'): CookingProgress => {
  if (progress.readyAt || progress.step >= 3) return progress;
  const action = getCookingActions(method, technique)[progress.step];
  return { step: progress.step + 1, action, readyAt: now + (action === 'blend' || action === 'bake' ? 750 : 600) };
};
export const finishCookingAnimation = (progress: CookingProgress, now: number): CookingProgress => progress.readyAt && now >= progress.readyAt ? { step: progress.step, readyAt: 0 } : progress;
export const isCookingComplete = (progress: CookingProgress) => progress.step === 3 && progress.readyAt === 0;
