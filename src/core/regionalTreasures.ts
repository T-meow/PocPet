import type { RegionId } from './expeditionTypes';
import type { Inventory } from './petTypes';

export const regionalTreasures = {
  creek_aquamarine: { name: '溪光海蓝宝', glyph: '💎', region: 'valley', base: 240, investigations: 6, rarity: 'rare', color: '#64c8de', use: '镶嵌溪光水景；菜地、鸡舍、小摊升至 Lv.2 各需 1 件；也可回收或卖给收藏客人' },
  hill_sunstone: { name: '风丘日光石', glyph: '🔶', region: 'hills', base: 300, investigations: 6, rarity: 'rare', color: '#edb652', use: '建造日光风向标；菜地、鸡舍升至 Lv.3，牛棚、小屋升至 Lv.2 各需 1 件；也可回收或卖给收藏客人' },
  forest_emerald: { name: '雾松祖母绿', glyph: '💎', region: 'forest', base: 420, investigations: 8, rarity: 'epic', color: '#58bf8b', use: '制作古树绿宝挂饰；牛棚、钓鱼小屋升至 Lv.3 各需 1 件；也可回收或卖给收藏客人' },
  tidal_pearl: { name: '月潮珍珠', glyph: '🦪', region: 'coast', base: 480, investigations: 8, rarity: 'epic', color: '#d9bee9', use: '制作月潮贝灯；小摊升至 Lv.3、小屋升至 Lv.4 各需 1 件；也可回收或卖给收藏客人' },
  star_sapphire: { name: '星辉蓝宝石', glyph: '💎', region: 'station', base: 700, investigations: 10, rarity: 'legendary', color: '#8996ee', use: '镶嵌星辉穹顶模型；钓鱼小屋升至 Lv.5 需 1 件；也可回收或卖给收藏客人' },
} as const satisfies Record<string, { name: string; glyph: string; region: RegionId; base: number; investigations: number; rarity: string; color: string; use: string }>;
export type RegionalTreasureId = keyof typeof regionalTreasures;
export const regionalTreasureIds = Object.keys(regionalTreasures) as RegionalTreasureId[];

export const communityDecorations = {
  amber_lantern: { name: '琥珀叶影灯', material: 'valley_amber', items: { valley_amber: 1, community_wood: 2, community_stone: 2 }, description: '把琥珀里的小叶映在展柜旁，留下第一次溪谷探查的光。' },
  golden_sign: { name: '鎏金社区铭牌', material: 'ancient_gold_bar', items: { ancient_gold_bar: 1, community_wood: 4, community_stone: 2 }, description: '将古老金条锻成社区铭牌，让旅途中的财富成为长久的纪念。' },
  creek_fountain: { name: '溪光水景', material: 'creek_aquamarine', items: { creek_aquamarine: 1, community_stone: 3 }, description: '把海蓝宝嵌在石座中，清亮的光像溪水一样流动。' },
  sun_weather_vane: { name: '日光风向标', material: 'hill_sunstone', items: { hill_sunstone: 1, community_wood: 3 }, description: '风向标托起金色日光石，记下山丘送来的每一阵风。' },
  emerald_pendant: { name: '古树绿宝挂饰', material: 'forest_emerald', items: { forest_emerald: 1, community_wood: 2, pine_resin: 2 }, description: '绿宝石与松枝相伴，把古树下的一片绿带回社区。' },
  pearl_lamp: { name: '月潮贝灯', material: 'tidal_pearl', items: { tidal_pearl: 1, sea_glass: 3 }, description: '珍珠与海玻璃围成一盏贝灯，闪着月光落在潮池里的颜色。' },
  star_dome: { name: '星辉穹顶模型', material: 'star_sapphire', items: { star_sapphire: 1, observatory_part: 3 }, description: '用蓝宝石点亮小小穹顶，远方的星空从此也在家门口。' },
} as const satisfies Record<string, { name: string; material: string; items: Inventory; description: string }>;
export type CommunityDecorationId = keyof typeof communityDecorations;
export const communityDecorationIds = Object.keys(communityDecorations) as CommunityDecorationId[];
