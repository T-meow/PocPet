import type { PetState, PartnerScheduleCategory } from '../../core/petTypes';
import { getPartnerScheduleFullRewardPreview, getPartnerScheduleOfferPreview, partnerScheduleMaxSkillLevel } from '../../core/partnerSchedule';
import { getPartnerScheduleMasteryNextThreshold, partnerScheduleCategories } from '../../core/partnerScheduleEffects';
import { getKitchenHeartReward } from '../../core/kitchen';
import { getMarketBuyoutBonus } from '../../core/communityMarket';
import { formatExpeditionInterval, getIdleExplorationTiming } from '../../core/expeditionTiming';
import { communityTaskHearts, specialtyOrderHearts } from '../../core/activityHearts';
import { communityConfig } from '../../core/community';
import { specialtyRegularMultiplier, specialtyUrgentMultiplier } from '../../core/communitySpecialtyOrders';
import { t } from '../../i18n';
import type { HelpContent } from './HelpButton';

export const workHelp: HelpContent = {
  title: '社区工作',
  overview: <><p>选择工作后，伙伴会按约定时间帮忙，离线也能完成并赚取小心心。完整完成可以领取报酬与谢礼，也可以提前回家领取已完成部分的报酬。</p><p>20／60／120 分钟工作基础给 20／65／140 心心，随角色成长增加；金币报酬和分类谢礼都附带同样的心心。快速工作基础给 5 心心。</p><p>工作期间状态只随工作消耗变化。体力不足也能接单，最低降至 0，不会因此提前结束；结束时会提示疲惫。</p><p>领取报酬后累计今日贡献，达标可获得扭蛋券。快速工作不累计时长。</p></>,
  details: <><p>工作卡片显示全程金币、心心和经验总额，包含全程谢礼；提前结束按完成比例领取基础报酬（全程的 80%），满程另得 20%。心心预览已含角色成长，领取时另结算成就与心心卡加成，不叠加工作金币倍率或额外报酬份数。</p><p>贡献时间按技能加速前的原工作档位折算。四项技能均达到 Lv.3／Lv.6 后，每批可选工作增加至 5／6 项，下次换批时生效。</p></>,
};
export const getWorkOfferHelp = (title: string, p: ReturnType<typeof getPartnerScheduleOfferPreview>): HelpContent => ({
  title,
  overview: workHelp.overview,
  details: <p>基础报酬 {p.baseCoins} 金币 · 经验 {p.baseSkillXp}；全程谢礼 {p.completionCoins} 金币 · 经验 {p.completionSkillXp}。全程另得 {p.hearts} 心心。</p>,
});
export const getWorkHelp = (pet: PetState, offers: readonly HelpContent[] = []): HelpContent => {
  const active = pet.partnerSchedule.active;
  const reward = active && getPartnerScheduleFullRewardPreview(active, pet);
  const chance = pet.partnerSchedule.pendingResult?.extraRewardChancePercent ?? active?.extraRewardChancePercent ?? 0;
  return {
    ...workHelp,
    overview: <><section className="work-help-section"><h3>接单与结算</h3>{workHelp.overview}</section><section className="work-help-section"><h3>技能成长与大师效果</h3>{partnerScheduleCategories.map(id => {
      const skill = getSkillHelp(pet, id);
      return <details key={id}><summary>{skill.title} · Lv.{pet.partnerSchedule.skills[id].level}</summary>{skill.overview}{skill.details}</details>;
    })}</section></>,
    details: <><section className="work-help-section"><h3>报酬与贡献</h3>{workHelp.details}{reward && <p>当前工作全程 {reward.coins.coins} 金币、{reward.coins.skillXp} 经验，含谢礼 {reward.completionCoins} 金币、{reward.completionSkillXp} 经验。</p>}{chance > 0 && <p>{t('ui.partnerSchedule.extraRewardChance', { percent: chance })}</p>}</section>{offers.length > 0 && <section className="work-help-section"><h3>本批工作报酬明细</h3>{offers.map((offer, index) => <details key={index}><summary>{offer.title}</summary>{offer.details}</details>)}</section>}</>,
  };
};
export const communityOrdersHelp: HelpContent = {
  title: '邻里接单',
  overview: <><p>每日 5 点换新：普通委托有 3 份候选，每天最多接 2 单，同时保留 2 单。</p><p>特产收购每天公布 2 份，另接 1 单，同时保留 1 单。特产可以手动采集或挂机取得，也可以用现有库存交货。</p><p>已接委托和收购单不过期。放弃不会返还接单次数，已经交出的物品不退还。</p></>,
  details: <><p>普通委托完成后另得 {communityTaskHearts} 心心，特产收购另得 {specialtyOrderHearts} 心心。特产按参考价 {specialtyRegularMultiplier} 倍收购，每 3 天有一份 {specialtyUrgentMultiplier} 倍急单，急单同样给 {specialtyOrderHearts} 心心。</p><p>接取时锁定金币价格和装饰加成，旧单保留原金币报价，小心心按当前奖励领取。收购价不叠加小摊加价。</p><p>首次给修渠邻居送暖粥可得 {communityConfig.orderCoins} 金币、{communityConfig.orderHearts} 心心和永久体力上限 +3，只领取一次，不占每日接单额度。</p></>,
};
const getSkillHelp = (pet: PetState, id: PartnerScheduleCategory): HelpContent => {
  const skill = pet.partnerSchedule.skills[id], next = getPartnerScheduleMasteryNextThreshold(skill.masterCompletions), master = skill.level >= partnerScheduleMaxSkillLevel;
  return {
    title: t('ui.partnerSchedule.categories.' + id) + '成长',
    overview: <><p>完成对应的工作与日常活动可以积累经验，逐步解锁技能效果。</p>{([2, 4, 5, 7, 8, 9, 10] as const).map(level => <p key={level}>{skill.level >= level ? '✓ ' : ''}{t('ui.partnerSchedule.passives.level' + level)}</p>)}{master && <p>{t('ui.partnerSchedule.masterPassives.' + id + '.' + (skill.masterCompletions >= 60 ? 'advanced' : 'base'))}</p>}</>,
    details: <>{id === 'cooking' && <><p>{t('ui.partnerSchedule.kitchenHearts', { percent: getKitchenHeartReward(pet, 'plain_rice').skillBonusPercent })}</p><p>烹饪技能从 Lv.2 起每级提高小摊包场成交机会 5%，最高 +45%；当前提供 +{getMarketBuyoutBonus(pet).cooking}%，可与鎏金社区铭牌的加成相加。</p></>}{id === 'exercise' && <p>运动从 Lv.2 起每级缩短挂机探索判定间隔 2%，最高 18%，与星辉穹顶相乘。当前新行程每 {formatExpeditionInterval(getIdleExplorationTiming(pet, 2).intervalMs)} 判定一次。</p>}{master ? <p>{next ? t('ui.partnerSchedule.mastery.next' + next, { count: skill.masterCompletions, target: next }) : t('ui.partnerSchedule.mastery.complete', { count: skill.masterCompletions })}</p> : <p>满级后完整完成对应工作，可累计大师次数。</p>}</>,
  };
};
