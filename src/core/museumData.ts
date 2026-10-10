import type { RegionId } from './expeditionTypes';
import type { Inventory } from './petTypes';
import { landmarkId, mapRegionForExpedition, type LandmarkId, type LandmarkNode } from './landmarkProgress';

export const museumRegions = ['valley', 'hills', 'forest', 'coast', 'station'] as const;
export type MuseumRegion = typeof museumRegions[number];
export type MuseumTag = 'record' | 'life' | 'nature' | 'craft';
export const museumTagNames: Record<MuseumTag, string> = { record: '记录', life: '生活', nature: '自然', craft: '工艺' };
export interface MuseumHallDefinition { name: string; scene: string; coins: number; apples: number; goods: string[]; dishes: string[]; treasure: string; exhibits: string[] }
export const museumHalls: Record<MuseumRegion, MuseumHallDefinition> = {
  valley: { name: '溪谷展厅', scene: 'valley-gallery', coins: 30000, apples: 5, goods: ['valley_mushroom', 'creek_herb'], dishes: ['dish_mushroom_rice', 'dish_herb_porridge'], treasure: 'creek_aquamarine', exhibits: ['creek-map', 'herb-specimen', 'creek_aquamarine'] },
  hills: { name: '山丘展厅', scene: 'hills-gallery', coins: 40000, apples: 8, goods: ['hill_honey', 'mountain_chestnut'], dishes: ['dish_honey_drink', 'dish_chestnut_rice'], treasure: 'hill_sunstone', exhibits: ['wind-chart', 'honey-display', 'hill_sunstone'] },
  forest: { name: '林地展厅', scene: 'forest-gallery', coins: 50000, apples: 10, goods: ['forest_berry', 'pine_resin'], dishes: ['dish_berry_milk', 'dish_pine_honey_biscuit'], treasure: 'forest_emerald', exhibits: ['forest-notebook', 'resin-specimen', 'forest_emerald'] },
  coast: { name: '海岸展厅', scene: 'coast-gallery', coins: 60000, apples: 12, goods: ['coast_kelp', 'sea_glass'], dishes: ['dish_kelp_rice', 'dish_seafood_rice'], treasure: 'tidal_pearl', exhibits: ['tide-chart', 'sea-glass-bottle', 'tidal_pearl'] },
  station: { name: '观测站展厅', scene: 'star-gallery', coins: 80000, apples: 15, goods: ['observatory_part', 'highland_potato'], dishes: ['dish_snow_bean_rice', 'dish_mountain_herb_tea'], treasure: 'star_sapphire', exhibits: ['star-chart', 'telescope-model', 'star_sapphire'] },
};
export const museumStageNames = ['整理展厅', '布置生活展柜', '正式开馆'];
export const getMuseumStageCost = (region: MuseumRegion, stage: number): { coins: number; apples: number; items: Inventory } => {
  const hall = museumHalls[region], secondApples = Math.ceil(hall.apples * .2);
  return stage === 0 ? { coins: hall.coins * .2, apples: 0, items: { community_wood: 10, community_stone: 10 } }
    : stage === 1 ? { coins: hall.coins * .4, apples: secondApples, items: Object.fromEntries([...hall.goods.map(id => [id, 8]), ...hall.dishes.map(id => [id, 3])]) }
      : { coins: hall.coins * .4, apples: hall.apples - secondApples, items: { [hall.treasure]: 3 } };
};
export type MuseumQuestId = 'valley_record' | 'valley_kitchen' | 'hills_record' | 'hills_kitchen' | 'forest_collect' | 'forest_fish' | 'coast_record' | 'coast_kitchen' | 'station_research' | 'station_dinner';
export interface MuseumObjective { key: string; label: string; amount: number }
export interface MuseumQuestDefinition { region: MuseumRegion; title: string; exhibit: string; objectives: MuseumObjective[] }
const goal = (key: string, label: string, amount = 1): MuseumObjective => ({ key, label, amount });
export const museumQuests: Record<MuseumQuestId, MuseumQuestDefinition> = {
  valley_record: { region: 'valley', title: '旧桥旁的记忆', exhibit: 'bridge-memory', objectives: [goal('visit:valley_bridge', '记录旧木桥'), goal('visit:valley_greenhouse', '记录旧温室')] },
  valley_kitchen: { region: 'valley', title: '从菜地到餐桌', exhibit: 'valley-recipe', objectives: [goal('crop:carrot', '新收获胡萝卜', 3), goal('animal:egg', '新收获鸡蛋', 2), goal('cook:egg_rice', '制作蛋炒饭'), goal('cook:carrot_rice', '制作胡萝卜蛋饭')] },
  hills_record: { region: 'hills', title: '把风向记下来', exhibit: 'wind-wreath', objectives: [goal('visit:hills_ridge', '记录风向坡道'), goal('visit:hills_lookout', '记录金色瞭望台')] },
  hills_kitchen: { region: 'hills', title: '山丘野餐手册', exhibit: 'hills-recipe', objectives: [goal('gather:hills:hill_honey', '新采集蜂蜜'), goal('gather:hills:mountain_chestnut', '新采集山栗'), goal('cook:honey_drink', '制作蜂蜜暖饮', 2), goal('cook:chestnut_rice', '制作山栗焖饭', 2)] },
  forest_collect: { region: 'forest', title: '林间三件小事', exhibit: 'forest-specimen-case', objectives: [goal('gather:forest:forest_berry', '新采集林莓'), goal('gather:forest:wood_ear', '新采集木耳'), goal('gather:forest:pine_nut', '新采集松子')] },
  forest_fish: { region: 'forest', title: '深潭的鱼影', exhibit: 'forest-fish-print', objectives: [goal('fish:forest_pool', '在林间水池新钓起鱼', 5), goal('visit:forest_fish', '到守望小屋制作鱼拓')] },
  coast_record: { region: 'coast', title: '海风送来的信', exhibit: 'drift-letter', objectives: [goal('visit:coast_boathouse', '记录旧船屋'), goal('visit:coast_lookout', '记录听浪观景台')] },
  coast_kitchen: { region: 'coast', title: '潮池料理笔记', exhibit: 'coast-recipe', objectives: [goal('gather:coast:coast_kelp', '新采集海藻'), goal('gather:coast:clam', '新采集蛤蜊'), goal('gather:coast:sea_shrimp', '新采集海虾'), goal('cook:kelp_rice', '制作海藻饭团'), goal('cook:seafood_rice', '制作蛤蜊海虾烩饭')] },
  station_research: { region: 'station', title: '共同的坐标', exhibit: 'star-instrument', objectives: [goal('research:mountain_tea', '新研究高山茶叶', 4), goal('visit:station_lookout', '记录星空观景台')] },
  station_dinner: { region: 'station', title: '值班室的夜餐', exhibit: 'night-watch-basket', objectives: [goal('visit:station_dinner', '交付主食、汤羹、饮品各一份')] },
};
export const museumQuestIds = Object.keys(museumQuests) as MuseumQuestId[];
export type MuseumVisitId = 'valley_bridge' | 'valley_greenhouse' | 'hills_ridge' | 'hills_lookout' | 'forest_fish' | 'coast_boathouse' | 'coast_lookout' | 'station_lookout' | 'station_dinner';
export interface MuseumVisitDefinition { quest: MuseumQuestId; destination: LandmarkId; title: string; steps: string[] }
const visit = (quest: MuseumQuestId, node: LandmarkNode, title: string, steps: string[]): MuseumVisitDefinition => ({ quest, destination: landmarkId(mapRegionForExpedition[museumQuests[quest].region], node), title, steps });
export const museumVisits: Record<MuseumVisitId, MuseumVisitDefinition> = {
  valley_bridge: visit('valley_record', 'crossing', '旧桥纪念画', ['沿着旧木桥慢慢走，把桥边的水声和修补过的木板记下来。', '和伙伴选好角度，在画纸上留下旧桥的轮廓。']),
  valley_greenhouse: visit('valley_record', 'story', '温室里的旧时光', ['看看旧温室里新长出的叶子，找一处最熟悉的角落。', '把温室的轮廓补进旧桥纪念画，给这段同行的路留下记录。']),
  hills_ridge: visit('hills_record', 'ridge', '山丘的风向', ['站在风向坡道旁，观察草叶倒向哪一边。', '把迎风的草茎绕成一圈，记下今天吹来的风。']),
  hills_lookout: visit('hills_record', 'lookout', '瞭望台的花环', ['在金色瞭望台展开笔记，核对远处的道路与风车。', '给花环系上小结，这段追着风走的路就留在展柜里了。']),
  forest_fish: visit('forest_fish', 'camp', '深潭鱼拓', ['把五次钓鱼记下的鱼影摊在守望小屋的桌上。', '和伙伴一起描出鱼鳍与水纹，完成深潭鱼拓。']),
  coast_boathouse: visit('coast_record', 'camp', '船屋的来信', ['在旧船屋的桌边展开信纸，写下这次沿海走来的见闻。', '和伙伴折好信纸，把船屋门口的浪花画在信封上。']),
  coast_lookout: visit('coast_record', 'lookout', '听浪的回信', ['到听浪观景台，读一读刚才写下的海边见闻。', '把听到的浪声补进回信。这封信会留在纪念馆，等以后一起翻看。']),
  station_lookout: visit('station_research', 'lookout', '星空下的坐标', ['把高山茶叶研究笔记和星图摊开，核对观景台的方向。', '调好共同坐标仪的小指针，把今晚的位置记下来。']),
  station_dinner: visit('station_dinner', 'camp', '值班室夜餐', ['敲敲值班室的门，给还在忙碌的伙伴腾出一小块桌面。', '摆好碗筷，确认主食、汤羹和饮品都带齐了。', '把三份料理交给值班的伙伴，留下一只装着夜餐回忆的小篮子。']),
};
export const museumVisitIds = Object.keys(museumVisits) as MuseumVisitId[];
export const isMuseumVisitId = (id: unknown): id is MuseumVisitId => typeof id === 'string' && museumVisitIds.includes(id as MuseumVisitId);
export interface MuseumExhibit { id: string; name: string; region: MuseumRegion; tags: MuseumTag[]; stage?: number; quest?: MuseumQuestId }
const baseNames = [ ['溪谷手绘图', '溪谷草木标本', '溪谷海蓝石'], ['山丘风向图', '山丘丰收匣', '山丘日光石'], ['守林手账', '松脂松果标本', '林地祖母绿'], ['海岸潮汐图', '海玻璃瓶', '潮汐珍珠'], ['折叠星图', '观测仪模型', '星辉蓝宝石'] ];
const questNames: Record<MuseumQuestId, string> = { valley_record: '旧桥纪念画', valley_kitchen: '溪谷料理手绘卡', hills_record: '追风花环', hills_kitchen: '山丘野餐手册', forest_collect: '林地三物收藏匣', forest_fish: '深潭鱼拓', coast_record: '漂流来信', coast_kitchen: '潮池料理手册', station_research: '共同坐标仪', station_dinner: '夜餐纪念篮' };
const questTags: Record<MuseumQuestId, MuseumTag[]> = { valley_record: ['record', 'craft'], valley_kitchen: ['life', 'record'], hills_record: ['nature', 'craft'], hills_kitchen: ['life', 'record'], forest_collect: ['nature', 'craft'], forest_fish: ['nature', 'record'], coast_record: ['record'], coast_kitchen: ['life', 'record'], station_research: ['record', 'craft'], station_dinner: ['life', 'craft'] };
export const museumExhibits: MuseumExhibit[] = museumRegions.flatMap((region, r) => museumHalls[region].exhibits.map((id, i): MuseumExhibit => ({ id, name: baseNames[r][i], region, stage: i + 1, tags: i === 0 ? ['record'] : i === 2 ? ['nature'] : ['life', r < 3 ? 'nature' : 'craft'] })))
  .concat(museumQuestIds.map((quest): MuseumExhibit => ({ id: museumQuests[quest].exhibit, name: questNames[quest], region: museumQuests[quest].region, tags: questTags[quest], quest })));
export type MuseumTheme = 'valley' | 'farm' | 'wind' | 'forest' | 'sea' | 'stars' | 'journey' | 'five';
export const museumThemes: Record<MuseumTheme, { name: string; goals: string[] }> = {
  valley: { name: '溪谷生活', goals: ['包含溪谷展品', '包含生活展品', '主食与汤羹各一种'] },
  farm: { name: '田园一天', goals: ['包含两件生活展品', '包含自然展品', '菜肴与甜品各一种'] },
  wind: { name: '风中来信', goals: ['包含山丘展品', '包含记录展品', '主食与饮品各一种'] },
  forest: { name: '林间茶会', goals: ['包含林地展品', '包含两件自然展品', '饮品与甜品各一种'] },
  sea: { name: '海风与灯', goals: ['包含海岸展品', '包含工艺展品', '主食与汤羹各一种'] },
  stars: { name: '星下相聚', goals: ['包含观测站展品', '两件展品分别提供记录和工艺', '主食与饮品各一种'] },
  journey: { name: '从山丘到海边', goals: ['包含山丘与海岸展品', '三件展品来自三个地区', '包含委托展品'] },
  five: { name: '五地回忆', goals: ['三件展品来自三个地区', '展品与料理覆盖五地区', '包含委托展品'] },
};
export const museumThemeIds = Object.keys(museumThemes) as MuseumTheme[];
export type MuseumScale = 'small' | 'standard' | 'gala';
export const museumScales: Record<MuseumScale, { name: string; coins: number; apples: number; portions: number; coefficient: number }> = {
  small: { name: '小型展', coins: 12000, apples: 10, portions: 2, coefficient: 1 },
  standard: { name: '标准展', coins: 30000, apples: 30, portions: 4, coefficient: 3 },
  gala: { name: '盛典展', coins: 60000, apples: 60, portions: 6, coefficient: 6 },
};
export const museumDishRegion = (id: string): RegionId | undefined => museumRegions.find(region => museumHalls[region].dishes.includes(id));
