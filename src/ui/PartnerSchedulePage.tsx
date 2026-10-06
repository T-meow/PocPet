import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChefHat, Clock3, Dumbbell, Gift, Heart, Home, MapPin, RefreshCw, Sparkles, Sprout, Ticket, X, Zap, type LucideIcon } from 'lucide-react';
import { currencyIcon } from '../assets';
import { activityText as L } from '../core/kitchenRecipes';
import { getInventoryItem } from '../core/items';
import {
  getPartnerScheduleClaimPreview, getPartnerScheduleDefinition, getPartnerScheduleEndPreview,
  getPartnerScheduleFullRewardPreview, getPartnerScheduleGlobalCoinBonusPercent, getPartnerScheduleMasteryNextThreshold,
  getPartnerScheduleOfferPreview, getPartnerScheduleRefreshPreview, getPartnerScheduleSkillXpNeeded,
  getPartnerScheduleStartCheck, getPartnerScheduleUnlockedOfferCount, getPetEnergyCap, getQuickWorkPreview,
  partnerScheduleDailyContributionTargetMs, partnerScheduleMaxSkillLevel, selectNeighborReference,
  type ItemId, type NeighborIdentity, type PartnerScheduleCategory, type PartnerScheduleRewardChoice, type PetState, type RecentActivity,
} from '../core/pet';
import { partnerScheduleExhaustedMessage, type PartnerScheduleClaimPreview } from '../core/partnerSchedule';
import { t } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';
import { DialogShell } from './DialogShell';
import { getPartnerScheduleDisplaySummary, getPartnerScheduleDisplayTitle } from './partnerScheduleText';
import { HelpButton } from './help/HelpButton';
import { getWorkHelp, getWorkOfferHelp } from './help/workHelp';

const categories: readonly PartnerScheduleCategory[] = ['study', 'cooking', 'garden', 'exercise'];
const categoryIcons: Record<PartnerScheduleCategory, LucideIcon> = { study: BookOpen, cooking: ChefHat, garden: Sprout, exercise: Dumbbell };
const placeName = (category: PartnerScheduleCategory) => ({ study: L('共享图书角', 'Community library'), cooking: L('社区厨房', 'Community kitchen'), garden: L('公共花圃', 'Neighborhood garden'), exercise: L('社区活动站', 'Community activity center') })[category];
const duration = (ms: number) => {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  return minutes < 60 ? t('ui.time.minutes', { minutes }) : t('ui.time.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
};
const amount = (value: number) => Math.round(value);
const getItemName = (id: ItemId) => getInventoryItem(id)?.name ?? id;

interface PartnerSchedulePageProps {
  pet: PetState;
  portrait: string;
  activityImages: Partial<Record<RecentActivity, string>>;
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
  <span><Heart size={16} />心心 +{reward.hearts}</span>
  {reward.skillXp > 0 && <span><Sparkles size={16} />{L('技能经验', 'Skill XP')} +{reward.skillXp}</span>}
  {reward.itemId && <span>{icons[reward.itemId] && <img src={icons[reward.itemId]} alt="" />}{getItemName(reward.itemId)} ×{reward.itemAmount}</span>}
  {reward.energy ? <span><Zap size={16} />{L('体力', 'Energy')} +{reward.energy}</span> : null}
  {reward.health ? <span>{L('健康', 'Health')} +{amount(reward.health)}</span> : null}
  {reward.mood ? <span>{L('心情', 'Mood')} +{amount(reward.mood)}</span> : null}
</div>;

const WorkOfferDialog = ({ pet, offerId, portrait, activityImages, itemIconMap, neighbors, onClose, onStart }: Pick<PartnerSchedulePageProps, 'pet' | 'portrait' | 'activityImages' | 'itemIconMap' | 'neighbors' | 'onStart'> & { offerId: string; onClose: () => void }) => {
  const titleId = useId();
  const offer = pet.partnerSchedule.offers.find(entry => entry.id === offerId);
  const definition = offer && getPartnerScheduleDefinition(offer.templateId);
  if (!offer || !definition) return null;
  const now = Date.now();
  const preview = getPartnerScheduleOfferPreview(pet, definition, now);
  const check = getPartnerScheduleStartCheck(pet, offer.id, now);
  const neighbor = pet.partnerSchedule.neighborOfferId === offer.id ? selectNeighborReference(offer.id, neighbors) : undefined;
  const Icon = categoryIcons[definition.category];
  return <DialogShell className="community-work-dialog" backdropClassName="community-work-backdrop" labelId={titleId} onClose={onClose} historyNavigation>
    <header className="community-work-dialog-heading">
      <div><span className="community-eyebrow">邻里来信 · {t(`ui.partnerSchedule.categories.${definition.category}`)}</span><h2 id={titleId}>{getPartnerScheduleDisplayTitle(definition.id, neighbor, neighbors)}</h2></div>
      <button type="button" className="icon-button" onClick={onClose} aria-label={L('关闭详情', 'Close details')}><X size={20} /></button>
    </header>
    <div className="community-work-dialog-body">
      <div className="community-work-letter"><img src={activityImages[definition.activity] ?? portrait} alt="" /><div><small>有空的话，来搭把手吧。</small><p>{getPartnerScheduleDisplaySummary(definition.id, neighbor, neighbors)}</p><div className="community-work-signature">—— {placeName(definition.category)}</div></div></div>
      <div className="community-work-location"><span><MapPin size={14} />{placeName(definition.category)}</span><span><Clock3 size={14} />{duration(preview.durationMs)}</span><span><Icon size={14} />{t(`ui.partnerSchedule.categories.${definition.category}`)}</span></div>
      <h3 className="community-work-detail-title">做完这份工作，可以收下</h3>
      <div className="community-work-pay"><RewardList reward={{ coins: preview.coinReward, hearts: preview.hearts, skillXp: preview.skillXp }} icons={itemIconMap} />{preview.grantsMasterCompletion && <span className="community-work-mastery"><Sparkles size={15} />大师次数 +1</span>}</div>
      {preview.categoryReward && <div className="community-category-alternative"><small>完成后，也可以把整份报酬换成这份谢礼</small><RewardList reward={preview.categoryReward} icons={itemIconMap} /></div>}
      <h3 className="community-work-detail-title">出发前，留一点力气</h3>
      <div className="community-work-costs"><span><Zap size={16} />{L('体力', 'Energy')} <strong>−{preview.energyCost}</strong></span><span>{L('饱腹', 'Fullness')} <strong>−{amount(preview.hungerCost)}</strong></span><span>{L('心情', 'Mood')} <strong>−{amount(preview.moodCost)}</strong></span></div>
      <p className="community-work-reminder">消耗随工作进度扣除。累了可以提前回家，按完成比例领取基础报酬；完成全程另有谢礼。</p>
      {!check.canStart && <p className="community-work-blocked" role="status">{t(`ui.partnerSchedule.blocked.${check.reason}`)}</p>}
    </div>
    <footer className="community-work-dialog-footer"><button type="button" className="secondary-button" onClick={onClose}>{L('再看看', 'Keep browsing')}</button><button type="button" className="primary-button" disabled={!check.canStart} onClick={() => { onStart(offer.id); onClose(); }}>{check.canStart ? L('出发帮忙', 'Start helping') : t(`ui.partnerSchedule.blocked.${check.reason}`)}<ArrowRight size={17} /></button></footer>
  </DialogShell>;
};

export const PartnerSchedulePage = ({ pet, portrait, activityImages, itemIconMap, neighbors, onBack, onStart, onCancel, onClaim, onRefresh, onQuickWork }: PartnerSchedulePageProps) => {
  const [category, setCategory] = useState<PartnerScheduleCategory | 'all'>('all');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const workStatusRef = useRef<HTMLElement>(null);
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
  const exhausted = schedule.offers.length > 0 && processedCount === schedule.offers.length;
  const visibleOffers = schedule.offers.filter((offer) => category === 'all' || getPartnerScheduleDefinition(offer.templateId)?.category === category);
  const offerHelp = schedule.offers.flatMap(offer => {
    const definition = getPartnerScheduleDefinition(offer.templateId);
    if (!definition) return [];
    const neighbor = schedule.neighborOfferId === offer.id ? selectNeighborReference(offer.id, neighbors) : undefined;
    return [getWorkOfferHelp(getPartnerScheduleDisplayTitle(definition.id, neighbor, neighbors), getPartnerScheduleOfferPreview(pet, definition, now))];
  });
  const ticketClaimed = pet.goldenAppleGacha.dailyGrantedSources.includes('partner_schedule');
  const contributionMinutes = Math.floor(schedule.dailyContributionMs / 60000);
  const contributionTargetMinutes = partnerScheduleDailyContributionTargetMs / 60000;
  const contributionRemainingMinutes = Math.max(0, Math.ceil((partnerScheduleDailyContributionTargetMs - schedule.dailyContributionMs) / 60000));
  const endMessage = endPreview ? endPreview.result.outcome === 'completed' ? L('工作已经全程完成，回家后可领取完整报酬与谢礼。', 'The job is complete. Head home to collect your full reward and gift.') : L(
    `已经帮忙 ${duration(endPreview.progress.progressMs)}，消耗体力 ${endPreview.consumed.energy}、饱腹 ${amount(endPreview.consumed.hunger)}、心情 ${amount(endPreview.consumed.mood)}。现在回家可领取 ${endPreview.reward.coins} 金币、${endPreview.reward.hearts} 心心和 ${endPreview.reward.skillXp} 技能经验。本项将标记为已结束，不获得全程谢礼。`,
    `You've helped for ${duration(endPreview.progress.progressMs)}, spending ${endPreview.consumed.energy} energy, ${amount(endPreview.consumed.hunger)} fullness and ${amount(endPreview.consumed.mood)} mood. Returning now earns ${endPreview.reward.coins} coins and ${endPreview.reward.skillXp} skill XP. This request will close without a completion gift.`,
  ) : '';

  return <section className="partner-schedule-page community-service-page" aria-label={L('社区工作', 'Community work')}>
    <header className="community-header">
      <button type="button" className="icon-button" onClick={onBack} aria-label={L('返回小窝', 'Back home')}><ArrowLeft size={22} /></button>
      <div><span className="community-eyebrow">邻里之间 · 一起生活</span><h2>{L('社区工作', 'Community work')}</h2><p>{L('帮一点小忙，收获邻里的谢意。', 'Lend a hand. Bring a little kindness home.')}</p></div>
      <span className="community-wallet"><span aria-label={`${amount(pet.coins)} 金币`}><img src={currencyIcon} alt="" />{amount(pet.coins)}</span><span aria-label={L(`${amount(pet.hearts)} 颗小心心`, `${amount(pet.hearts)} hearts`)}><Heart size={16} />{amount(pet.hearts)}</span></span>
      <HelpButton {...getWorkHelp(pet, offerHelp)} label="工作说明" />
    </header>

    {pet.adventure.active && <p className="community-refresh-hint">{L('伙伴正在溪谷探查，返回前哨基地后就能继续社区工作。', 'Your companion is scouting the valley. Return to the outpost before starting community work.')}</p>}

    {result && coinClaim && <section ref={workStatusRef} tabIndex={-1} className={`community-settlement partner-schedule-result${complete ? '' : ' community-settlement--early'}`} aria-label={L('工作结算', 'Work rewards')}>
      <div className="community-settlement-heading"><span className="community-large-icon">{complete ? <Gift /> : <Home />}</span><div><span className="community-eyebrow">{complete ? L('谢谢你来帮忙', 'THANK YOU FOR HELPING') : L('今天先回家啦', 'A LITTLE HELP COUNTS')}</span><h3>{getPartnerScheduleDisplayTitle(result.templateId, result.neighbor, neighbors)}</h3><p>{complete ? L('这份工作已经完成，收下报酬与全程谢礼吧。', 'All done! Collect your pay and completion gift.') : L('已经做过的部分也有收获，领取后可以继续选择其他工作。', 'Collect the pay for your contribution, then choose another job.')}</p></div></div>
      <div className="community-claim-options"><div><strong>{complete ? L('领取金币报酬', 'Take the coin reward') : L('领取本次报酬', 'Collect your pay')}</strong><RewardList reward={coinClaim} icons={itemIconMap} /><button type="button" className="primary-button" onClick={() => onClaim('coins')}>{L('收下报酬', 'Collect reward')}</button></div>
        {categoryClaim && <div><strong>{L('选择社区谢礼', 'Choose a community gift')}</strong><RewardList reward={categoryClaim} icons={itemIconMap} /><button type="button" className="secondary-button" onClick={() => onClaim('category')}>{L('收下这份谢礼', 'Collect this gift')}</button></div>}
      </div>
      {complete && result.grantsMasterCompletion && <p className="community-result-note">{L('完整完成 · 大师次数 +1', 'Completed in full · Mastery +1')}</p>}
      {result.exhausted && <p className="community-result-note">{partnerScheduleExhaustedMessage}</p>}
    </section>}

    {active && endPreview && fullPreview && <section ref={workStatusRef} tabIndex={-1} className="community-active partner-schedule-active" data-category={active.category} aria-label={L('正在工作', 'Work in progress')}>
      <div className="community-active-heading"><span className="community-large-icon"><Clock3 /></span><div><span className="community-eyebrow">{L('伙伴正在帮忙', 'LENDING A HAND')}</span><h3>{getPartnerScheduleDisplayTitle(active.templateId, active.neighbor, neighbors)}</h3><p>{L('还需', 'Remaining')} <strong>{duration(endPreview.progress.remainingMs)}</strong> · {Math.floor(endPreview.progress.percent)}%</p></div><button type="button" className="secondary-button" onClick={() => setEndConfirmId(active.offerId)}><Home size={17} />{L('提前回家', 'Head home early')}</button></div>
      <progress className="community-progress" max={100} value={endPreview.progress.percent} aria-label={L('工作进度', 'Work progress')} />
      <div className="community-active-facts"><div><small>{L('已经投入', 'Spent so far')}</small><strong>{L('体力', 'Energy')} −{endPreview.consumed.energy}</strong><span>{L('饱腹', 'Fullness')} −{amount(endPreview.consumed.hunger)} · {L('心情', 'Mood')} −{amount(endPreview.consumed.mood)}</span></div><div><small>{L('现在回家的报酬', 'Pay if you leave now')}</small><strong>{endPreview.reward.coins} {L('金币', 'coins')}</strong><span>心心 +{endPreview.reward.hearts}</span><span>{L('技能经验', 'Skill XP')} +{endPreview.reward.skillXp}</span></div><div><small>{L('做完全程可得', 'Full completion')}</small><strong>{fullPreview.coins.coins} {L('金币', 'coins')} · {fullPreview.coins.skillXp} XP</strong><span>心心 +{fullPreview.coins.hearts}</span>{active.size !== 'short' && <span>{L('或整份改选分类报酬', 'Or choose the category reward instead')}</span>}</div></div>
    </section>}

    <div className="community-layout"><div className="community-main">
      <section className="community-quick-work" aria-label={L('快速工作', 'Quick work')}><span className="community-large-icon"><Zap /></span><div><h3>{L('快速工作', 'Quick work')}<small>一点时间，也能帮上忙</small></h3><div className="community-quick-quote"><span><Zap size={15} />−{work.energyCost}</span><span><img src={currencyIcon} alt="" />{work.minimumCoins}–{work.maximumCoins}</span><span><Heart size={15} />+{work.hearts}</span><small>{L('含可能获得的小费', 'Includes possible tips')}</small></div></div><button type="button" className="primary-button" disabled={!work.canWork} onClick={onQuickWork}>{work.canWork ? L('帮一把', 'Lend a hand') : t(`ui.partnerSchedule.blocked.${work.reason}`)}</button></section>

      <section className="community-board" aria-label={L('社区公告板', 'Community noticeboard')}>
        <header className="community-board-heading"><div><span className="community-eyebrow">邻里来信 · 留一点时间给邻居</span><h3>今天，帮一点小忙</h3></div><button type="button" className="secondary-button community-refresh" disabled={!refresh.canRefresh} onClick={() => setRefreshConfirm(refresh)}><RefreshCw size={15} /><span>{L('换一批', 'New requests')}</span><span className="community-heart-cost"><Heart size={13} />{refresh.cost}</span></button></header>
        {!refresh.canRefresh && <p className="community-refresh-hint">{refresh.reason === 'hearts' ? L('小心心不足；每天 05:00 会免费换一批。', 'Not enough hearts. New requests arrive free at 05:00.') : refresh.reason === 'pending' ? L('收下本次报酬后，就可以换一批。', 'Collect your rewards before refreshing.') : L('伙伴回家并领取报酬后，就可以换一批。', 'Refresh after your companion returns and collects their pay.')}</p>}
        <div className="community-board-tools"><nav className="community-tabs" aria-label={L('工作分类', 'Work categories')}>{(['all', ...categories] as const).map((id) => {
          const Icon = id === 'all' ? undefined : categoryIcons[id];
          return <button type="button" key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{Icon && <Icon size={13} />}{id === 'all' ? L('全部', 'All') : t(`ui.partnerSchedule.categories.${id}`)}</button>;
        })}</nav><small className="community-board-count">{L(`已处理 ${processedCount} / ${schedule.offers.length}`, `${processedCount} / ${schedule.offers.length} handled`)}</small></div>
        {exhausted && <p className="community-board-empty"><CheckCircle2 size={19} />{L('这批事务已经处理完啦。换一批，继续帮忙吧。', 'This batch is finished. Refresh for more ways to help.')}</p>}
        <div className="community-offers">{visibleOffers.map((offer) => {
          const definition = getPartnerScheduleDefinition(offer.templateId);
          if (!definition) return null;
          const Icon = categoryIcons[definition.category];
          const preview = getPartnerScheduleOfferPreview(pet, definition, now);
          const completed = schedule.completedOfferIds.includes(offer.id);
          const ended = schedule.earlyEndedOfferIds.includes(offer.id);
          const running = active?.offerId === offer.id;
          const pending = result?.offerId === offer.id;
          const resolved = (completed || ended) && !running && !pending;
          const state = pending ? 'pending' : running ? 'active' : completed ? 'completed' : ended ? 'ended' : 'available';
          const neighbor = schedule.neighborOfferId === offer.id ? selectNeighborReference(offer.id, neighbors) : undefined;
          const title = getPartnerScheduleDisplayTitle(definition.id, neighbor, neighbors);
          return <div key={offer.id} className="community-work-slot"><button type="button" className="community-work-note" data-category={definition.category} data-state={state} disabled={resolved} aria-label={`${title} · ${pending ? '领取报酬' : running ? '查看工作进度' : completed ? '已完成' : ended ? '提前回家' : '查看详情'}`} aria-haspopup={running || pending || resolved ? undefined : 'dialog'} onClick={() => {
            if (running || pending) workStatusRef.current?.focus();
            else setSelectedOfferId(offer.id);
          }}>
            <span className="community-work-pin" aria-hidden="true" />
            <span className="community-work-note-meta"><span><Icon size={12} />{t(`ui.partnerSchedule.categories.${definition.category}`)}</span><span><Clock3 size={12} />{duration(running ? active.endsAt - active.startedAt : preview.durationMs)}</span></span>
            <img className="community-work-note-art" src={activityImages[definition.activity] ?? portrait} alt="" loading="lazy" />
            <strong className="community-work-note-title">{title}</strong><span className="community-work-note-place">{placeName(definition.category)}</span>
            <span className="community-work-note-pay"><span><img src={currencyIcon} alt="金币" />{pending ? coinClaim?.coins : running ? fullPreview?.coins.coins : preview.coinReward}</span><span><Heart size={13} aria-label="心心" />+{pending ? coinClaim?.hearts : running ? fullPreview?.coins.hearts : preview.hearts}</span></span>
            {state !== 'available' && <span className="community-work-stamp">{pending ? L('报酬待领取', 'Collect rewards') : running ? L('正在帮忙', 'In progress') : completed ? L('已完成', 'Completed') : L('提前回家', 'Ended early')}</span>}
          </button></div>;
        })}</div>
        {visibleOffers.length === 0 && <p className="community-board-empty">{L('本批暂无这类事务，看看其他分类，或换一批吧。', 'No requests in this category. Try another category or refresh.')}</p>}
        <footer className="community-board-footer"><span><Gift size={14} />{L('全程完成有谢礼，提前回家也有报酬。', 'A gift for finishing, fair pay for every contribution.')}</span><span title={`${L('免费换批还有', 'Free refresh in')} ${duration(refresh.nextResetAt - now)}`}>每天 05:00 免费换一批</span></footer>
      </section>
    </div><aside className="community-sidebar">
      <section className="community-contribution"><div className="community-sidebar-heading"><Sprout size={18} /><h3>{L('今天的小小贡献', "Today's contribution")}</h3></div><div className="community-contribution-value"><strong>{Math.min(contributionTargetMinutes, contributionMinutes)}</strong><span>/ {contributionTargetMinutes} {L('分钟', 'min')}</span></div><progress className="community-progress" max={partnerScheduleDailyContributionTargetMs} value={Math.min(partnerScheduleDailyContributionTargetMs, schedule.dailyContributionMs)} aria-label={L('今日工作贡献', "Today's work contribution")} /><strong className="community-ticket-state">{ticketClaimed ? <><CheckCircle2 size={17} />{L('今日扭蛋券已获得', "Today's ticket received")}</> : <><Ticket size={18} />{L('累计达标 · 扭蛋券 ×1', 'Reach the goal · 1 gacha ticket')}</>}</strong><p>{ticketClaimed ? '谢谢你，把温暖留在了社区。' : contributionRemainingMinutes > 0 ? `再积累 ${contributionRemainingMinutes} 分钟贡献，就能收下一份小惊喜。` : '今天的贡献已达标。'}</p></section>
      <section className="community-skills" aria-label={L('技能成长', 'Skill growth')}><div className="community-sidebar-heading"><Sparkles size={19} /><h3>{L('在帮忙中成长', 'Grow as you help')}</h3></div>{categories.map((id) => {
        const Icon = categoryIcons[id];
        const skill = schedule.skills[id];
        const master = skill.level >= partnerScheduleMaxSkillLevel;
        const needed = getPartnerScheduleSkillXpNeeded(skill.level);
        const next = getPartnerScheduleMasteryNextThreshold(skill.masterCompletions);
        return <section key={id} className="community-skill" data-category={id}><div className="community-skill-summary"><Icon size={15} /><strong>{t(`ui.partnerSchedule.categories.${id}`)} · Lv.{skill.level}</strong><small>{master ? t('ui.partnerSchedule.mastery.count', { count: skill.masterCompletions }) : `${amount(skill.xp)} / ${needed} XP`}</small></div><progress max={master ? next ?? Math.max(1, skill.masterCompletions) : needed} value={master ? skill.masterCompletions : skill.xp} aria-label={t(`ui.partnerSchedule.categories.${id}`)} /></section>;
      })}<div className="community-milestones"><strong>{L(`全局金币加成 +${getPartnerScheduleGlobalCoinBonusPercent(schedule.skills)}%`, `Global coin bonus +${getPartnerScheduleGlobalCoinBonusPercent(schedule.skills)}%`)}</strong>{getPartnerScheduleUnlockedOfferCount(schedule.skills) > schedule.boardOfferCount && <p>{L('新增名额将在下次换批时生效。', 'New slots become available with the next batch.')}</p>}</div></section>
      <div className="community-work-companion"><img src={portrait} alt="" /><div><strong>{pet.name}，今天也一起加油。</strong><small>{L('体力', 'Energy')} {amount(pet.energy)} / {amount(getPetEnergyCap(pet))}</small></div></div>
    </aside></div>
    <p className="community-work-page-footer">忙里偷一点闲，也把一点温暖留在社区。</p>
    {selectedOfferId && <WorkOfferDialog pet={pet} offerId={selectedOfferId} portrait={portrait} activityImages={activityImages} itemIconMap={itemIconMap} neighbors={neighbors} onClose={() => setSelectedOfferId(null)} onStart={onStart} />}
    {refreshConfirm && <ConfirmDialog title={L('换一批社区事务？', 'Refresh community requests?')} message={L(`消耗 ${refreshConfirm.cost} 颗小心心，换取 ${refreshConfirm.offerCount} 项事务。本批未开始的事务也会被替换，今日贡献会保留。`, `Spend ${refreshConfirm.cost} hearts for ${refreshConfirm.offerCount} requests. Unstarted requests will also be replaced. Your daily contribution is kept.`)} cancelLabel={L('再看看', 'Keep browsing')} confirmLabel={L(`换一批 · ♥ ${refreshConfirm.cost}`, `Refresh · ♥ ${refreshConfirm.cost}`)} confirmTone="primary" onCancel={() => setRefreshConfirm(null)} onConfirm={() => { const key = refreshConfirm.boardKey; setRefreshConfirm(null); onRefresh(key); }} />}
    {active && endPreview && endConfirmId === active.offerId && <ConfirmDialog title={L('现在回家休息？', 'Head home now?')} message={endMessage} cancelLabel={L('继续帮忙', 'Keep helping')} confirmLabel={L('提前回家', 'Head home early')} confirmTone="primary" onCancel={() => setEndConfirmId(null)} onConfirm={() => { setEndConfirmId(null); onCancel(); }} />}
  </section>;
};
