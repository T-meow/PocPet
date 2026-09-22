import { useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, ChefHat, Clock3, Dumbbell, Gift, Heart, Home, RefreshCw, Sparkles, Sprout, Ticket, Zap, type LucideIcon } from 'lucide-react';
import { currencyIcon } from '../assets';
import { activityText as L } from '../core/kitchenRecipes';
import { getInventoryItem } from '../core/items';
import {
  getPartnerScheduleClaimPreview, getPartnerScheduleDefinition, getPartnerScheduleEndPreview,
  getPartnerScheduleFullRewardPreview, getPartnerScheduleGlobalCoinBonusPercent, getPartnerScheduleMasteryNextThreshold,
  getPartnerScheduleOfferPreview, getPartnerScheduleRefreshPreview, getPartnerScheduleSkillXpNeeded,
  getPartnerScheduleStartCheck, getPartnerScheduleUnlockedOfferCount, getQuickWorkPreview,
  partnerScheduleDailyContributionTargetMs, partnerScheduleMaxSkillLevel, selectNeighborReference,
  type ItemId, type NeighborIdentity, type PartnerScheduleCategory, type PartnerScheduleRewardChoice, type PetState,
} from '../core/pet';
import { partnerScheduleExhaustedMessage, type PartnerScheduleClaimPreview } from '../core/partnerSchedule';
import { t } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';
import { getPartnerScheduleDisplaySummary, getPartnerScheduleDisplayTitle } from './partnerScheduleText';
import { HelpButton } from './help/HelpButton';
import { getWorkHelp, getWorkOfferHelp, getSkillHelp } from './help/workHelp';

const categories: readonly PartnerScheduleCategory[] = ['study', 'cooking', 'garden', 'exercise'];
const categoryIcons: Record<PartnerScheduleCategory, LucideIcon> = { study: BookOpen, cooking: ChefHat, garden: Sprout, exercise: Dumbbell };
const placeName = (category: PartnerScheduleCategory) => ({ study: L('共享图书角', 'Community library'), cooking: L('社区厨房', 'Community kitchen'), garden: L('公共花圃', 'Neighborhood garden'), exercise: L('社区活动站', 'Community activity center') })[category];
const duration = (ms: number) => {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  return minutes < 60 ? t('ui.time.minutes', { minutes }) : t('ui.time.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
};
const amount = (value: number) => Math.round(value * 10) / 10;
const getItemName = (id: ItemId) => getInventoryItem(id)?.name ?? id;

interface PartnerSchedulePageProps {
  pet: PetState;
  itemIconMap: Partial<Record<ItemId, string>>;
  neighbors: readonly NeighborIdentity[];
  onBack: () => void;
  onStart: (offerId: string) => void;
  onCancel: () => void;
  onClaim: (choice: PartnerScheduleRewardChoice) => void;
  onRefresh: (boardKey: string) => void;
  onQuickWork: () => void;
}

const RewardList = ({ reward, icons }: { reward: PartnerScheduleClaimPreview; icons: Partial<Record<ItemId, string>> }) => <div className="community-rewards">
  <span><img src={currencyIcon} alt="" />{reward.coins} {L('金币', 'coins')}</span>
  {reward.skillXp > 0 && <span><Sparkles size={16} />{L('技能经验', 'Skill XP')} +{reward.skillXp}</span>}
  {reward.itemId && <span>{icons[reward.itemId] && <img src={icons[reward.itemId]} alt="" />}{getItemName(reward.itemId)} ×{reward.itemAmount}</span>}
  {reward.energy ? <span><Zap size={16} />{L('体力', 'Energy')} +{reward.energy}</span> : null}
  {reward.health ? <span>{L('健康', 'Health')} +{amount(reward.health)}</span> : null}
  {reward.mood ? <span>{L('心情', 'Mood')} +{amount(reward.mood)}</span> : null}
</div>;

export const PartnerSchedulePage = ({ pet, itemIconMap, neighbors, onBack, onStart, onCancel, onClaim, onRefresh, onQuickWork }: PartnerSchedulePageProps) => {
  const [category, setCategory] = useState<PartnerScheduleCategory | 'all'>('all');
  const [refreshConfirm, setRefreshConfirm] = useState<ReturnType<typeof getPartnerScheduleRefreshPreview> | null>(null);
  const [endConfirmId, setEndConfirmId] = useState<string | null>(null);
  const schedule = pet.partnerSchedule;
  const active = schedule.active;
  const result = schedule.pendingResult;
  const now = Date.now();
  const endPreview = active ? getPartnerScheduleEndPreview(pet, now) : undefined;
  const fullPreview = active ? getPartnerScheduleFullRewardPreview(active, pet) : undefined;
  const refresh = getPartnerScheduleRefreshPreview(pet, now);
  const work = getQuickWorkPreview(pet, now);
  const complete = result?.outcome !== 'early';
  const coinClaim = result ? getPartnerScheduleClaimPreview(result, 'coins', 0, pet) : undefined;
  const categoryClaim = result && complete && result.size !== 'short' ? getPartnerScheduleClaimPreview(result, 'category', 0, pet) : undefined;
  const processedCount = schedule.completedOfferIds.length + schedule.earlyEndedOfferIds.length;
  const exhausted = processedCount === schedule.offers.length;
  const visibleOffers = schedule.offers.filter((offer) => category === 'all' || getPartnerScheduleDefinition(offer.templateId)?.category === category);
  const ticketClaimed = pet.goldenAppleGacha.dailyGrantedSources.includes('partner_schedule');
  const contributionMinutes = amount(schedule.dailyContributionMs / 60000);
  const endMessage = endPreview ? endPreview.result.outcome === 'completed' ? L('工作已经全程完成，回家后可领取完整报酬与谢礼。', 'The job is complete. Head home to collect your full reward and gift.') : L(
    `已经帮忙 ${duration(endPreview.progress.progressMs)}，消耗体力 ${endPreview.consumed.energy}、饱腹 ${amount(endPreview.consumed.hunger)}、心情 ${amount(endPreview.consumed.mood)}。现在回家可领取 ${endPreview.reward.coins} 金币和 ${endPreview.reward.skillXp} 技能经验。本项将标记为已结束，不获得全程谢礼。`,
    `You've helped for ${duration(endPreview.progress.progressMs)}, spending ${endPreview.consumed.energy} energy, ${amount(endPreview.consumed.hunger)} fullness and ${amount(endPreview.consumed.mood)} mood. Returning now earns ${endPreview.reward.coins} coins and ${endPreview.reward.skillXp} skill XP. This request will close without a completion gift.`,
  ) : '';

  return <section className="partner-schedule-page community-service-page" aria-label={L('社区工作', 'Community work')}>
    <header className="community-header">
      <button type="button" className="icon-button" onClick={onBack} aria-label={L('返回小窝', 'Back home')}><ArrowLeft size={22} /></button>
      <div><span className="community-eyebrow">OUR NEIGHBORHOOD</span><h2>{L('社区工作', 'Community work')}</h2><p>{L('帮一点小忙，收获邻里的谢意。', 'Lend a hand. Bring a little kindness home.')}</p></div>
      <HelpButton {...getWorkHelp(pet)} />
      <span className="community-wallet" aria-label={L(`${pet.hearts} 颗小心心`, `${pet.hearts} hearts`)}><Heart size={19} fill="currentColor" />{pet.hearts}</span>
    </header>

    {pet.adventure.active && <p className="community-refresh-hint">{L('伙伴正在溪谷探查，返回前哨基地后就能继续社区工作。', 'Your companion is scouting the valley. Return to the outpost before starting community work.')}</p>}

    {result && coinClaim && <section className={`community-settlement partner-schedule-result${complete ? '' : ' community-settlement--early'}`} aria-label={L('工作结算', 'Work rewards')}>
      <div className="community-settlement-heading"><span className="community-large-icon">{complete ? <Gift /> : <Home />}</span><div><span className="community-eyebrow">{complete ? L('谢谢你来帮忙', 'THANK YOU FOR HELPING') : L('今天先回家啦', 'A LITTLE HELP COUNTS')}</span><h3>{getPartnerScheduleDisplayTitle(result.templateId, result.neighbor, neighbors)}</h3><p>{complete ? L('这份工作已经完成，收下报酬与全程谢礼吧。', 'All done! Collect your pay and completion gift.') : L('已经做过的部分也有收获，领取后可以继续选择其他工作。', 'Collect the pay for your contribution, then choose another job.')}</p></div></div>
      <div className="community-claim-options"><div><strong>{complete ? L('领取金币报酬', 'Take the coin reward') : L('领取本次报酬', 'Collect your pay')}</strong><RewardList reward={coinClaim} icons={itemIconMap} /><button type="button" className="primary-button" onClick={() => onClaim('coins')}>{L('收下报酬', 'Collect reward')}</button></div>
        {categoryClaim && <div><strong>{L('选择社区谢礼', 'Choose a community gift')}</strong><RewardList reward={categoryClaim} icons={itemIconMap} /><button type="button" className="secondary-button" onClick={() => onClaim('category')}>{L('收下这份谢礼', 'Collect this gift')}</button></div>}
      </div>
      {complete && result.grantsMasterCompletion && <p className="community-result-note">{L('完整完成 · 大师次数 +1', 'Completed in full · Mastery +1')}</p>}
      {result.exhausted && <p className="community-result-note">{partnerScheduleExhaustedMessage}</p>}
    </section>}

    {active && endPreview && fullPreview && <section className="community-active partner-schedule-active" data-category={active.category} aria-label={L('正在工作', 'Work in progress')}>
      <div className="community-active-heading"><span className="community-large-icon"><Clock3 /></span><div><span className="community-eyebrow">{L('伙伴正在帮忙', 'LENDING A HAND')}</span><h3>{getPartnerScheduleDisplayTitle(active.templateId, active.neighbor, neighbors)}</h3><p>{L('还需', 'Remaining')} <strong>{duration(endPreview.progress.remainingMs)}</strong> · {Math.floor(endPreview.progress.percent)}%</p></div><button type="button" className="secondary-button" onClick={() => setEndConfirmId(active.offerId)}><Home size={17} />{L('提前回家', 'Head home early')}</button></div>
      <progress className="community-progress" max={100} value={endPreview.progress.percent} aria-label={L('工作进度', 'Work progress')} />
      <div className="community-active-facts"><div><small>{L('已经投入', 'Spent so far')}</small><strong>{L('体力', 'Energy')} −{endPreview.consumed.energy}</strong><span>{L('饱腹', 'Fullness')} −{amount(endPreview.consumed.hunger)} · {L('心情', 'Mood')} −{amount(endPreview.consumed.mood)}</span></div><div><small>{L('现在回家的报酬', 'Pay if you leave now')}</small><strong>{endPreview.reward.coins} {L('金币', 'coins')}</strong><span>{L('技能经验', 'Skill XP')} +{endPreview.reward.skillXp}</span></div><div><small>{L('做完全程可得', 'Full completion')}</small><strong>{fullPreview.coins.coins} {L('金币', 'coins')} · {fullPreview.coins.skillXp} XP</strong>{active.size !== 'short' && <span>{L('或整份改选分类报酬', 'Or choose the category reward instead')}</span>}</div></div>
    </section>}

    <div className="community-layout"><div className="community-main">
      <section className="community-quick-work" aria-label={L('快速工作', 'Quick work')}><span className="community-large-icon"><Zap /></span><div><span className="community-eyebrow">{L('随时来帮忙', 'A QUICK HELPING HAND')}</span><h3>{L('快速工作', 'Quick work')}</h3><p>{L('帮忙整理物资，即刻消耗体力，赚一点零花钱。', 'Help sort supplies. Spend energy and earn coins right away.')}</p><div className="community-quick-quote"><span><Zap size={15} />−{work.energyCost}</span><span><img src={currencyIcon} alt="" />{work.minimumCoins}–{work.maximumCoins}</span><small>{L('含可能获得的小费', 'Includes possible tips')}</small></div></div><button type="button" className="primary-button" disabled={!work.canWork} onClick={onQuickWork}>{work.canWork ? L('帮一把', 'Lend a hand') : t(`ui.partnerSchedule.blocked.${work.reason}`)}</button></section>

      <section className="community-board" aria-label={L('社区公告板', 'Community noticeboard')}>
        <header className="community-board-heading"><div><span className="community-eyebrow">COMMUNITY NOTICEBOARD</span><h3>{L('邻里需要一点帮助', 'A little help is wanted')}</h3><p>{L(`本批已处理 ${processedCount} / ${schedule.offers.length} 项`, `${processedCount} / ${schedule.offers.length} requests handled`)}</p></div><button type="button" className="secondary-button community-refresh" disabled={!refresh.canRefresh} onClick={() => setRefreshConfirm(refresh)}><RefreshCw size={16} /><span>{L('换一批', 'New requests')}</span><span className="community-heart-cost"><Heart size={14} fill="currentColor" />{refresh.cost}</span></button></header>
        <div className="community-board-meta"><span>{L('全程完成有谢礼，提前回家也有报酬。', 'A gift for finishing, fair pay for every contribution.')}</span><small>{L('免费换批还有', 'Free refresh in')} {duration(refresh.nextResetAt - now)}</small></div>
        {!refresh.canRefresh && <p className="community-refresh-hint">{refresh.reason === 'hearts' ? L('小心心不足；每天 05:00 会免费换一批。', 'Not enough hearts. New requests arrive free at 05:00.') : refresh.reason === 'pending' ? L('收下本次报酬后，就可以换一批。', 'Collect your rewards before refreshing.') : L('伙伴回家并领取报酬后，就可以换一批。', 'Refresh after your companion returns and collects their pay.')}</p>}
        <nav className="schedule-category-tabs community-tabs" aria-label={L('工作分类', 'Work categories')}>{(['all', ...categories] as const).map((id) => <button type="button" key={id} aria-pressed={category === id} data-category={id} onClick={() => setCategory(id)}>{id === 'all' ? L('全部', 'All') : t(`ui.partnerSchedule.categories.${id}`)}</button>)}</nav>
        {exhausted && <p className="community-board-empty"><CheckCircle2 size={19} />{L('这批事务已经处理完啦。换一批，继续帮忙吧。', 'This batch is finished. Refresh for more ways to help.')}</p>}
        <div className="community-offers">{visibleOffers.map((offer) => {
          const definition = getPartnerScheduleDefinition(offer.templateId);
          if (!definition) return null;
          const Icon = categoryIcons[definition.category];
          const preview = getPartnerScheduleOfferPreview(pet, definition, now);
          const check = getPartnerScheduleStartCheck(pet, offer.id, now);
          const completed = schedule.completedOfferIds.includes(offer.id);
          const ended = schedule.earlyEndedOfferIds.includes(offer.id);
          const running = active?.offerId === offer.id;
          const pending = result?.offerId === offer.id;
          const resolved = completed || ended;
          const state = completed ? 'completed' : ended ? 'ended' : running ? 'active' : pending ? 'pending' : 'available';
          const neighbor = schedule.neighborOfferId === offer.id ? selectNeighborReference(offer.id, neighbors) : undefined;
          return <article key={offer.id} className="community-offer" data-category={definition.category} data-state={state}>
            <div className="community-offer-top"><span><Icon size={17} />{placeName(definition.category)}</span><span className="community-duration"><Clock3 size={14} />{duration(preview.durationMs)}</span></div>
            <h4>{getPartnerScheduleDisplayTitle(definition.id, neighbor, neighbors)}</h4><p className="community-offer-description">{getPartnerScheduleDisplaySummary(definition.id, neighbor, neighbors)}</p>
            <div className="community-offer-cost"><span><Zap size={14} />{L('体力', 'Energy')} {preview.energyCost}</span><span>{L('饱腹', 'Fullness')} {amount(preview.hungerCost)}</span><span>{L('心情', 'Mood')} {amount(preview.moodCost)}</span></div>
            <div className="community-pay"><div className="help-heading"><small>全程报酬</small><HelpButton {...getWorkOfferHelp(getPartnerScheduleDisplayTitle(definition.id, neighbor, neighbors), preview)} /></div><strong><img src={currencyIcon} alt="" />{preview.baseCoins + preview.completionCoins}<span>{preview.grantsMasterCompletion ? '大师次数 +1' : `经验 +${preview.baseSkillXp + preview.completionSkillXp}`}</span></strong></div>
            {preview.categoryReward && <div className="community-category-alternative"><small>或改选以下报酬</small><RewardList reward={preview.categoryReward} icons={itemIconMap} /></div>}
            <footer><span className="community-category-label">{t(`ui.partnerSchedule.categories.${definition.category}`)}</span>{resolved ? <span className="community-stamp">{completed ? <CheckCircle2 size={16} /> : <Home size={16} />}{completed ? L('已完成', 'Completed') : L('提前回家', 'Ended early')}</span> : <button type="button" className="primary-button" disabled={!check.canStart} onClick={() => onStart(offer.id)}>{running ? L('正在帮忙', 'In progress') : pending ? L('报酬待领取', 'Collect rewards') : check.canStart ? L('出发帮忙', 'Start helping') : t(`ui.partnerSchedule.blocked.${check.reason}`)}</button>}</footer>
          </article>;
        })}</div>
        {visibleOffers.length === 0 && <p className="community-board-empty">{L('本批暂无这类事务，看看其他分类，或换一批吧。', 'No requests in this category. Try another category or refresh.')}</p>}
      </section>
    </div><aside className="community-sidebar">
      <section className="community-contribution"><span className="community-large-icon"><Ticket /></span><h3>{L('今天的小小贡献', "Today's contribution")}</h3><div className="community-contribution-value"><strong>{Math.min(60, contributionMinutes)}</strong><span>/ 60 {L('分钟', 'min')}</span></div><progress className="community-progress" max={partnerScheduleDailyContributionTargetMs} value={Math.min(partnerScheduleDailyContributionTargetMs, schedule.dailyContributionMs)} aria-label={L('今日工作贡献', "Today's work contribution")} /><strong className="community-ticket-state">{ticketClaimed ? <><CheckCircle2 size={17} />{L('今日扭蛋券已获得', "Today's ticket received")}</> : <><Gift size={17} />{L('累计达标 · 扭蛋券 ×1', 'Reach the goal · 1 gacha ticket')}</>}</strong></section>
      <section className="community-skills" aria-label={L('技能成长', 'Skill growth')}><div className="community-sidebar-heading"><Sparkles size={19} /><h3>{L('在帮忙中成长', 'Grow as you help')}</h3></div>{categories.map((id) => {
        const Icon = categoryIcons[id];
        const skill = schedule.skills[id];
        const master = skill.level >= partnerScheduleMaxSkillLevel;
        const needed = getPartnerScheduleSkillXpNeeded(skill.level);
        const next = getPartnerScheduleMasteryNextThreshold(skill.masterCompletions);
        return <section key={id} className="community-skill" data-category={id}><div className="community-skill-summary"><Icon size={18} /><span><strong>{t(`ui.partnerSchedule.categories.${id}`)} · Lv.{skill.level}</strong><small>{master ? t('ui.partnerSchedule.mastery.count', { count: skill.masterCompletions }) : `${skill.xp} / ${needed} XP`}</small></span><HelpButton {...getSkillHelp(pet, id)} /></div><progress max={master ? next ?? Math.max(1, skill.masterCompletions) : needed} value={master ? skill.masterCompletions : skill.xp} aria-label={t(`ui.partnerSchedule.categories.${id}`)} /></section>;
      })}<div className="community-milestones"><strong>{L(`全局金币加成 +${getPartnerScheduleGlobalCoinBonusPercent(schedule.skills)}%`, `Global coin bonus +${getPartnerScheduleGlobalCoinBonusPercent(schedule.skills)}%`)}</strong>{getPartnerScheduleUnlockedOfferCount(schedule.skills) > schedule.boardOfferCount && <p>{L('新增名额将在下次换批时生效。', 'New slots become available with the next batch.')}</p>}</div></section>
    </aside></div>
    {refreshConfirm && <ConfirmDialog title={L('换一批社区事务？', 'Refresh community requests?')} message={L(`消耗 ${refreshConfirm.cost} 颗小心心，换取 ${refreshConfirm.offerCount} 项事务。本批未开始的事务也会被替换，今日贡献会保留。`, `Spend ${refreshConfirm.cost} hearts for ${refreshConfirm.offerCount} requests. Unstarted requests will also be replaced. Your daily contribution is kept.`)} cancelLabel={L('再看看', 'Keep browsing')} confirmLabel={L(`换一批 · ♥ ${refreshConfirm.cost}`, `Refresh · ♥ ${refreshConfirm.cost}`)} confirmTone="primary" onCancel={() => setRefreshConfirm(null)} onConfirm={() => { const key = refreshConfirm.boardKey; setRefreshConfirm(null); onRefresh(key); }} />}
    {active && endPreview && endConfirmId === active.offerId && <ConfirmDialog title={L('现在回家休息？', 'Head home now?')} message={endMessage} cancelLabel={L('继续帮忙', 'Keep helping')} confirmLabel={L('提前回家', 'Head home early')} confirmTone="primary" onCancel={() => setEndConfirmId(null)} onConfirm={() => { setEndConfirmId(null); onCancel(); }} />}
  </section>;
};
