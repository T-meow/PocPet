import type { HelpContent } from './HelpButton';
import type { ItemDefinition, ItemId, PetState } from '../../core/petTypes';
import { getItemRecoveryPreview, getItemStatEffect, getPictureBookReward, foodHungerOverflowRatio, goldenAppleRecoveryPercent } from '../../core/itemEffects';
import { durableToolIds, toolDefinitions, type DurableToolId } from '../../core/fieldEquipmentData';
import { getAdventureTreasureValue, isAdventureTreasure } from '../../core/adventureItems';
import { getItemEffectBadges } from '../itemEffectBadges';
import { fishingHelp } from './fishingHelp';
import { fieldHelp, orchardHelp, animalHelp } from './productionHelp';
import { campHelp } from './explorationHelp';
import { getFoodSource } from '../../core/foodSources';
import { regionalTreasures } from '../../core/regionalTreasures';
import { getMarketQuote } from '../../core/communityMarket';

const itemRules: Partial<Record<string, string>> = {
  prospector_pick: '手镐帮助推进珍宝调查。溪谷使用时消耗 2 次采集机会，行动表现影响调查进度和发现；其他地区按对应选项结算。',
  survey_lens: '溪谷行动中可提高调查把握；调查松茸或高山茶叶时推进 2 点进度，消耗增加 20% 及 1 次采集机会。',
  trail_rope: '工具独立携带，选择绳索通路时才扣耐久；剩余工具返程归还。危险行动中可减轻擦伤。',
  animal_feed: '每个生产周期消耗 1 份。饲料容量随扩建为 3／5／8 份，产物容量为 6／10／16 份；不会自动购买。',
  creek_herb_seed: '溪谷每日首次搜寻和水渠故事首次奖励各可得 2 份；商店不出售，播种消耗 1 份。',
};
const sharedItemHelp: Partial<Record<string, HelpContent>> = {
  fishing_bait: fishingHelp, river_bait: fishingHelp, fishing_rod: fishingHelp, reinforced_rod: fishingHelp, fishing_float: fishingHelp, landing_net: fishingHelp,
  field_watering_can: fieldHelp, harvest_sickle: fieldHelp, nutrient_compost: fieldHelp, wheat_seed: fieldHelp,
  normal_fertilizer: orchardHelp, heart_fertilizer: orchardHelp, harvest_nutrient: orchardHelp,
  camp_kit: campHelp, animal_feed: animalHelp,
};
export const getItemHelp = (pet: PetState, item: ItemDefinition, quantity = 1, favoriteFoodIds?: readonly ItemId[], note?: string): HelpContent => {
  const tool = durableToolIds.includes(item.id as DurableToolId) ? toolDefinitions[item.id as DurableToolId] : undefined;
  const preview = getItemRecoveryPreview(pet, item, quantity, favoriteFoodIds);
  const labels = (effect: Parameters<typeof getItemEffectBadges>[0]) => getItemEffectBadges(effect).map(value => value.label).join(' · ') || '无属性恢复';
  const recovery = item.usable && item.kind !== 'garden' && !isAdventureTreasure(item.id);
  const book = item.id === 'picture_book' ? getPictureBookReward(pet.partnerSchedule.skills.study, quantity) : undefined;
  const shared = sharedItemHelp[item.id], source = getFoodSource(item.id), quote = getMarketQuote(pet, item.id);
  const treasure = Object.prototype.hasOwnProperty.call(regionalTreasures, item.id) ? regionalTreasures[item.id as keyof typeof regionalTreasures] : undefined;
  return {
    title: item.name,
    overview: <>{note && <p>{note}</p>}{shared?.overview}{itemRules[item.id] && <p>{itemRules[item.id]}</p>}{source && <p>获取：{source}。</p>}{treasure && <p>当地定向勘探累计 {treasure.investigations} 点调查获得 1 件，也可在当地挂机寻找。</p>}{tool && <p>每件满耐久 {tool.uses} 次，用尽后消耗一件，备用工具保持满耐久。</p>}{item.tags?.includes('kitchen_material') && <p>厨房、背包与商店显示同一份库存。可食用材料也能留着做菜。</p>}{isAdventureTreasure(item.id) ? <p>每份可兑换 {getAdventureTreasureValue(item.id)} 金币，也可留作装饰材料。兑换不会恢复状态。</p> : recovery ? <><p>操作区显示本次实际恢复量。普通食物吃饱时会自动停止，未使用的食物保留；护理用品与特殊恢复物品不受吃撑影响。</p>{book && <p>阅读可获得学习经验；学习满级后，改为每本 1 点基础心心。</p>}{item.id === 'ribbon_bell' && <p>每个铃铛带来 1 点基础心心，另享成就与增益卡效果。</p>}</> : !shared && !itemRules[item.id] && <p>可从物品操作入口前往对应设施使用。</p>}</>,
    details: recovery ? <>{item.id === 'golden_apple' ? <p>五项状态各恢复上限的 {goldenAppleRecoveryPercent}%，体力包含奖杯提升的上限。</p> : item.id === 'birthday_cake' ? <p>恢复当前缺少的状态。</p> : <><p>每份基础效果：{labels(item.effect)}</p><p>计入当前加成：{labels(getItemStatEffect(pet, item))}</p></>}<p>本次使用 {preview.quantity} 份：{labels(preview.actual)}</p>{getItemEffectBadges(preview.overflow).length > 0 && <p>未计入的恢复量：{labels(preview.overflow)}</p>}{item.kind === 'food' && <p>普通食物的饱食可以超过上限，超出部分按 {foodHungerOverflowRatio * 100}% 计入。吃撑后降至上限的 95% 才可继续喂食。</p>}{book && <p>学习经验 +{book.xp} · 满级后阅读 {book.heartServings} 本，基础心心 +{book.heartServings}；成就与增益卡效果另计。</p>}{item.id === 'ribbon_bell' && <p>基础心心 +{quantity}，成就与增益卡效果另计。</p>}</> : shared?.details || (quote ? <p>每份回收 {quote.base} 金币 · 当前新上架报价 {quote.price} 金币；补货时沿用原栏位价格。</p> : undefined),
  };
};
