import { expeditionProducts } from './core/expeditionData';
import type { ExpeditionItemId } from './core/expeditionTypes';
const icon = (glyph: string, tone: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="16" y="16" width="96" height="96" rx="32" fill="${tone}"/><text x="64" y="85" text-anchor="middle" font-size="62">${glyph}</text></svg>`);
export const expeditionItemIcons = Object.fromEntries(Object.entries(expeditionProducts).map(([id, data]) => [id, icon(data.glyph, '#e9eddd')])) as Record<ExpeditionItemId, string>;
export const expeditionDishIcons = { dish_mushroom_rice: icon('🍄', '#f1e4cb'), dish_honey_drink: icon('🍯', '#f2e7c9'), dish_berry_milk: icon('🫐', '#e5e0f2'), dish_kelp_rice: icon('🍙', '#d9e7e1') };
