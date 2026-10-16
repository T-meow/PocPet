import { addInventoryItem } from './items';
import { inventoryItemLimit } from './saveMetadata';
import type { Inventory, PetState } from './petTypes';
import { cookingByproducts, handcraftIds, handcraftMaterialIds, handcraftMaterials, type KitchenHandcraftState } from './handcraftData';

const count = (value: unknown, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
export const defaultHandcraftState = (): KitchenHandcraftState => ({ revision: 0, made: {}, remainders: { egg_shell: 0, clean_shell: 0 }, pending: {} });
export const normalizeHandcraftState = (raw: unknown): KitchenHandcraftState => {
  const value = raw && typeof raw === 'object' ? raw as Partial<KitchenHandcraftState> : {};
  const state = defaultHandcraftState();
  state.revision = count(value.revision);
  for (const id of handcraftIds) if (count(value.made?.[id])) state.made[id] = count(value.made?.[id]);
  for (const source of cookingByproducts) {
    state.remainders[source.output] = count(value.remainders?.[source.output], source.required - 1);
    if (count(value.pending?.[source.output])) state.pending[source.output] = count(value.pending?.[source.output]);
  }
  return state;
};
export const planCookingByproducts = (state: KitchenHandcraftState, ingredients: Inventory) => {
  const remainders = { ...state.remainders }, generated: Inventory = {};
  let changed = false;
  for (const source of cookingByproducts) {
    const consumed = ingredients[source.input] ?? 0;
    if (!consumed) continue;
    changed = true;
    const total = remainders[source.output] + consumed;
    if (!Number.isSafeInteger(total) || total < 0) return undefined;
    const quantity = Math.floor(total / source.required);
    remainders[source.output] = total % source.required;
    if (quantity > Number.MAX_SAFE_INTEGER - (state.pending[source.output] ?? 0)) return undefined;
    if (quantity) generated[source.output] = quantity;
  }
  return changed && state.revision >= Number.MAX_SAFE_INTEGER ? undefined : { changed, generated, remainders };
};
const collect = (inventory: Inventory, pending: KitchenHandcraftState['pending']) => {
  const remaining = { ...pending }, received: Inventory = {};
  for (const id of handcraftMaterialIds) {
    const amount = Math.min(remaining[id] ?? 0, Math.max(0, inventoryItemLimit - (inventory[id] ?? 0)));
    if (!amount) continue;
    inventory = addInventoryItem(inventory, id, amount);
    received[id] = amount;
    const rest = (remaining[id] ?? 0) - amount;
    if (rest) remaining[id] = rest; else delete remaining[id];
  }
  return { inventory, remaining, received };
};
export const applyCookingByproducts = (pet: PetState, plan: NonNullable<ReturnType<typeof planCookingByproducts>>): PetState => {
  if (!plan.changed) return pet;
  const current = pet.kitchen.handcraft, pending = { ...current.pending };
  for (const id of handcraftMaterialIds) if (plan.generated[id]) pending[id] = (pending[id] ?? 0) + plan.generated[id];
  const result = collect(pet.inventory, pending);
  const text = handcraftMaterialIds.filter(id => plan.generated[id]).map(id => `${handcraftMaterials[id].name} ×${plan.generated[id]}`).join('、');
  return { ...pet, inventory: result.inventory, kitchen: { ...pet.kitchen, handcraft: { ...current, revision: current.revision + 1, remainders: plan.remainders, pending: result.remaining } },
    recentEvent: pet.recentEvent + (text ? ` 回收${text}。${Object.keys(result.remaining).length ? '仓库放不下的副产物已暂存在手工台。' : '已收入共用仓库。'}` : '') };
};
export const claimHandcraftMaterials = (pet: PetState): PetState => {
  const state = pet.kitchen.handcraft;
  if (pet.timePause || state.revision >= Number.MAX_SAFE_INTEGER) return pet;
  const result = collect(pet.inventory, state.pending);
  if (!Object.keys(result.received).length) return pet;
  const text = handcraftMaterialIds.filter(id => result.received[id]).map(id => `${handcraftMaterials[id].name} ×${result.received[id]}`).join('、');
  return { ...pet, inventory: result.inventory, kitchen: { ...pet.kitchen, handcraft: { ...state, revision: state.revision + 1, pending: result.remaining } }, recentEvent: `已领回${text}。${Object.keys(result.remaining).length ? '剩余副产物继续保留在手工台。' : ''}` };
};
