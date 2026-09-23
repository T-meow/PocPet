import type { PetState, PartnerScheduleCategory } from '../../core/petTypes';
import { getPartnerScheduleFullRewardPreview, getPartnerScheduleOfferPreview, partnerScheduleMaxSkillLevel } from '../../core/partnerSchedule';
import { getPartnerScheduleMasteryNextThreshold, partnerScheduleCategories } from '../../core/partnerScheduleEffects';
import { getKitchenHeartReward } from '../../core/kitchen';
import { t } from '../../i18n';
import type { HelpContent } from './HelpButton';

export const workHelp: HelpContent = {
  title: '社区工作',
  overview: <><p>选择工作后，伙伴会按约定时间帮忙。完整完成可以领取报酬与谢礼，也可以提前回家领取已完成部分的报酬。</p><p>工作期间状态只随工作消耗变化。体力不足也能接单，最低降至 0，不会因此提前结束；结束时会提示疲惫。</p><p>领取报酬后累计今日贡献，达标可获得扭蛋券。快速工作不累计时长。</p></>,
  details: <><p>工作卡片显示全程金币和经验总额，包含全程谢礼；分类报酬是整份替代奖励。</p><p>贡献时间按技能加速前的原工作档位折算。四项技能均达到 Lv.3／Lv.6 后，每批可选工作增加至 5／6 项，下次换批时生效。</p></>,
};
export const getWorkOfferHelp = (title: string, p: ReturnType<typeof getPartnerScheduleOfferPreview>): HelpContent => ({
  title,
  overview: workHelp.overview,
  details: <p>基础报酬 {p.baseCoins} 金币 · 经验 {p.baseSkillXp}；全程谢礼 {p.completionCoins} 金币 · 经验 {p.completionSkillXp}。</p>,
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
  details: <p>特产收购每 3 天有一份 5 倍急单；接取时确定价格，不叠加小摊加价。</p>,
};
const getSkillHelp = (pet: PetState, id: PartnerScheduleCategory): HelpContent => {
  const skill = pet.partnerSchedule.skills[id], next = getPartnerScheduleMasteryNextThreshold(skill.masterCompletions), master = skill.level >= partnerScheduleMaxSkillLevel;
  return {
    title: t('ui.partnerSchedule.categories.' + id) + '成长',
    overview: <><p>完成对应的工作与日常活动可以积累经验，逐步解锁技能效果。</p>{([2, 4, 5, 7, 8, 9, 10] as const).map(level => <p key={level}>{skill.level >= level ? '✓ ' : ''}{t('ui.partnerSchedule.passives.level' + level)}</p>)}{master && <p>{t('ui.partnerSchedule.masterPassives.' + id + '.' + (skill.masterCompletions >= 60 ? 'advanced' : 'base'))}</p>}</>,
    details: <>{id === 'cooking' && <p>{t('ui.partnerSchedule.kitchenHearts', { percent: getKitchenHeartReward(pet, 'plain_rice').skillBonusPercent })}</p>}{master ? <p>{next ? t('ui.partnerSchedule.mastery.next' + next, { count: skill.masterCompletions, target: next }) : t('ui.partnerSchedule.mastery.complete', { count: skill.masterCompletions })}</p> : <p>满级后完整完成对应工作，可累计大师次数。</p>}</>,
  };
};
