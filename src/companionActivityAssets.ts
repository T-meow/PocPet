import { allDishes, kitchenMaterials } from './core/kitchenRecipes';
import type { DishId, KitchenMaterialId } from './core/companionActivityTypes';

// Replace these keyed placeholders with final illustrations without changing save IDs.
const placeholder = (glyph: string, color: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="4" y="4" width="120" height="120" rx="30" fill="${color}"/><ellipse cx="64" cy="97" rx="35" ry="8" fill="#38414b" opacity=".08"/><text x="64" y="80" font-size="61" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${glyph}</text></svg>`)}`;
export const kitchenItemIcons = Object.fromEntries([
  ...kitchenMaterials.map((material) => [material.id, placeholder(material.glyph, '#f2eadb')]),
  ...allDishes.map(({ recipe, id }) => [id, placeholder(recipe.glyph, '#ffecd9')]),
]) as Record<DishId | KitchenMaterialId, string>;
