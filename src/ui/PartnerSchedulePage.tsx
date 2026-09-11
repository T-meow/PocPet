import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChefHat,
  Clock3,
  Coins,
  Dumbbell,
  Sparkles,
  Sprout,
  Ticket,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  getAchievementEffects,
  getPartnerScheduleClaimPreview,
  getPartnerScheduleDefinition,
  getPartnerScheduleGlobalCoinBonusPercent,
  getPartnerScheduleMasteryNextThreshold,
  getPartnerScheduleOfferPreview,
  getPartnerScheduleProgress,
  getPartnerScheduleSkillXpNeeded,
  getPartnerScheduleStartCheck,
  selectNeighborReference,
  partnerScheduleDailyCompletionLimit,
  partnerScheduleMaxSkillLevel,
  type ItemId,
  type NeighborIdentity,
  type PartnerScheduleCategory,
  type PartnerScheduleRewardChoice,
  type PetState,
} from '../core/pet';
import { t } from '../i18n';
import { getKitchenHeartReward } from '../core/kitchen';
import { getPartnerScheduleDisplaySummary, getPartnerScheduleDisplayTitle } from './partnerScheduleText';

const categoryIcons: Record<PartnerScheduleCategory, LucideIcon> = {
  study: BookOpen,
  cooking: ChefHat,
  garden: Sprout,
  exercise: Dumbbell,
};

const categories: readonly PartnerScheduleCategory[] = ['study', 'cooking', 'garden', 'exercise'];
const passiveLevels = [2, 4, 5, 7, 8, 9, 10] as const;

const getNextPassiveLevel = (level: number) => passiveLevels.find((passiveLevel) => level < passiveLevel);

const getMasteryProgress = (count: number) => {
  if (count >= 60) return 100;
  const start = count >= 30 ? 30 : count >= 10 ? 10 : 0;
  const end = count >= 30 ? 60 : count >= 10 ? 30 : 10;
  return ((count - start) / (end - start)) * 100;
};

const formatDuration = (milliseconds: number) => {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  if (totalMinutes < 60) return t('ui.time.minutes', { minutes: totalMinutes });
  return t('ui.time.hoursMinutes', { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 });
};

interface PartnerSchedulePageProps {
  pet: PetState;
  itemIconMap: Partial<Record<ItemId, string>>;
  neighbors: readonly NeighborIdentity[];
  onBack: () => void;
  onStart: (offerId: string) => void;
  onCancel: () => void;
  onClaim: (choice: PartnerScheduleRewardChoice) => void;
}

export const PartnerSchedulePage = ({
  pet,
  itemIconMap,
  neighbors,
  onBack,
  onStart,
  onCancel,
  onClaim,
}: PartnerSchedulePageProps) => {
  const schedule = pet.partnerSchedule;
  const active = schedule.active;
  const pendingResult = schedule.pendingResult;
  const activeDefinition = active ? getPartnerScheduleDefinition(active.templateId) : undefined;
  const activeProgress = active ? getPartnerScheduleProgress(active) : undefined;
  const resultDefinition = pendingResult ? getPartnerScheduleDefinition(pendingResult.templateId) : undefined;
  const coinClaim = pendingResult ? getPartnerScheduleClaimPreview(pendingResult, 'coins', 0, pet) : undefined;
  const categoryClaim = pendingResult ? getPartnerScheduleClaimPreview(pendingResult, 'category', 0, pet) : undefined;
  const skills = categories.map((category) => schedule.skills[category]);
  const level3Count = skills.filter((skill) => skill.level >= 3).length;
  const level6Count = skills.filter((skill) => skill.level >= 6).length;
  const globalCoinBonusPercent = getPartnerScheduleGlobalCoinBonusPercent(schedule.skills);
  const extraRewardChancePercent = getAchievementEffects(pet).partnerScheduleExtraRewardChancePercent;
  const scheduleTicketClaimed = pet.goldenAppleGacha.dailyGrantedSources.includes('partner_schedule');

  return (
    <section className="partner-schedule-page" aria-label={t('ui.partnerSchedule.aria')}>
      <header className="partner-schedule-page__header">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t('ui.partnerSchedule.back')} title={t('ui.partnerSchedule.back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <div>
          <h2>{t('ui.partnerSchedule.title')}</h2>
          <p>{t('ui.partnerSchedule.summary')}</p>
        </div>
      </header>

      <div className="partner-schedule-skills" aria-label={t('ui.partnerSchedule.skillsAria')}>
        {categories.map((category) => {
          const Icon = categoryIcons[category];
          const skill = schedule.skills[category];
          const needed = getPartnerScheduleSkillXpNeeded(skill.level);
          const isMaster = skill.level >= partnerScheduleMaxSkillLevel;
          const nextPassiveLevel = getNextPassiveLevel(skill.level);
          const nextMasteryThreshold = getPartnerScheduleMasteryNextThreshold(skill.masterCompletions);
          const percent = isMaster
            ? getMasteryProgress(skill.masterCompletions)
            : needed > 0
              ? Math.min(100, (skill.xp / needed) * 100)
              : 100;
          return (
            <div className={`partner-schedule-skill partner-schedule-skill--${category}`} key={category}>
              <Icon size={19} aria-hidden="true" />
              <span>
                <strong>{t(`ui.partnerSchedule.categories.${category}`)}</strong>
                <small>{isMaster
                  ? t('ui.partnerSchedule.mastery.count', { count: skill.masterCompletions })
                  : t('ui.partnerSchedule.skillProgress', { level: skill.level, xp: skill.xp, needed })}</small>
              </span>
              <small className="partner-schedule-skill__next">
                {isMaster
                  ? t(`ui.partnerSchedule.masterPassives.${category}.${skill.masterCompletions >= 60 ? 'advanced' : 'base'}`)
                  : nextPassiveLevel
                    ? t(`ui.partnerSchedule.passives.level${nextPassiveLevel}`)
                    : t('ui.partnerSchedule.mastery.unlocked')}
              </small>
              {category === 'cooking' && <small className="partner-schedule-skill__milestone">{t('ui.partnerSchedule.kitchenHearts', { percent: getKitchenHeartReward(pet).skillBonusPercent })}</small>}
              <i aria-hidden="true"><b style={{ width: `${percent}%` }} /></i>
              {isMaster ? (
                <small className="partner-schedule-skill__milestone">
                  {nextMasteryThreshold
                    ? t(`ui.partnerSchedule.mastery.next${nextMasteryThreshold}`, { count: skill.masterCompletions, target: nextMasteryThreshold })
                    : t('ui.partnerSchedule.mastery.complete', { count: skill.masterCompletions })}
                </small>
              ) : null}
            </div>
          );
        })}
      </div>

      {pendingResult && resultDefinition ? (
        <section className="partner-schedule-result" aria-label={t('ui.partnerSchedule.resultAria')}>
          <span className={`partner-schedule-category-icon partner-schedule-category-icon--${pendingResult.category}`}>
            {(() => { const Icon = categoryIcons[pendingResult.category]; return <Icon size={25} aria-hidden="true" />; })()}
          </span>
          <div className="partner-schedule-result__copy">
            <span>{t('ui.partnerSchedule.resultKicker')}</span>
            <h3>{getPartnerScheduleDisplayTitle(resultDefinition.id, pendingResult.neighbor, neighbors)}</h3>
            <p>{t('ui.partnerSchedule.resultSummary')}</p>
            {extraRewardChancePercent > 0 ? (
              <small className="partner-schedule-result__bonus">
                <Sparkles size={14} aria-hidden="true" />
                {t('ui.partnerSchedule.extraRewardChance', { percent: extraRewardChancePercent })}
              </small>
            ) : null}
          </div>
          <div className="partner-schedule-result__actions">
            <button type="button" className="primary-button" onClick={() => onClaim('coins')}>
              <Coins size={18} aria-hidden="true" />
              <span>{t('ui.partnerSchedule.claimCoins', { coins: coinClaim?.coins ?? 0 })}<small>{pendingResult.grantsMasterCompletion ? t('ui.partnerSchedule.mastery.reward') : t('ui.partnerSchedule.claimXp', { xp: coinClaim?.skillXp ?? 0 })}</small></span>
            </button>
            {pendingResult.size !== 'short' ? (
              <button type="button" className="secondary-button" onClick={() => onClaim('category')}>
                {categoryClaim?.itemId && itemIconMap[categoryClaim.itemId] ? <img src={itemIconMap[categoryClaim.itemId]} alt="" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
                <span>{t(`ui.partnerSchedule.categoryRewards.${pendingResult.category}`, { coins: categoryClaim?.coins ?? 0 })}<small>{pendingResult.grantsMasterCompletion ? t('ui.partnerSchedule.mastery.reward') : t('ui.partnerSchedule.claimXp', { xp: categoryClaim?.skillXp ?? 0 })}</small></span>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {active && activeDefinition && activeProgress ? (
        <section className={`partner-schedule-active partner-schedule-active--${active.category}`} aria-label={t('ui.partnerSchedule.activeAria')}>
          <span className={`partner-schedule-category-icon partner-schedule-category-icon--${active.category}`}>
            {(() => { const Icon = categoryIcons[active.category]; return <Icon size={25} aria-hidden="true" />; })()}
          </span>
          <div className="partner-schedule-active__main">
            <span>{t('ui.partnerSchedule.activeKicker')}</span>
            <h3>{getPartnerScheduleDisplayTitle(activeDefinition.id, active.neighbor, neighbors)}</h3>
            <p>{t('ui.partnerSchedule.remaining', { time: formatDuration(activeProgress.remainingMs) })}</p>
            <div className="partner-schedule-progress" aria-label={t('ui.partnerSchedule.progress', { percent: Math.round(activeProgress.percent) })}>
              <i style={{ width: `${activeProgress.percent}%` }} />
            </div>
          </div>
          <div className="partner-schedule-active__reward">
            <Coins size={18} aria-hidden="true" />
            <strong>+{Math.max(1, Math.round(active.coinReward * active.trophyRewardMultiplier))}</strong>
          </div>
          <button type="button" className="icon-button partner-schedule-cancel" onClick={onCancel} aria-label={t('ui.partnerSchedule.cancel')} title={t('ui.partnerSchedule.cancel')}>
            <X size={20} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <div className="partner-schedule-section-heading">
        <div><h3>{t('ui.partnerSchedule.todayTitle')}</h3></div>
        <div className="partner-schedule-section-heading__meta">
          <small>{t('ui.partnerSchedule.dailyCount', { count: schedule.completedOfferIds.length, limit: partnerScheduleDailyCompletionLimit })}</small>
          <strong className={`partner-schedule-daily-ticket${scheduleTicketClaimed ? ' partner-schedule-daily-ticket--claimed' : ''}`}>
            <Ticket size={15} aria-hidden="true" />
            {scheduleTicketClaimed
              ? t('ui.partnerSchedule.dailyTicketClaimed')
              : t('ui.partnerSchedule.dailyTicketHint', { limit: partnerScheduleDailyCompletionLimit })}
          </strong>
        </div>
      </div>

      <div className="partner-schedule-list">
        {schedule.offers.map((offer) => {
          const definition = getPartnerScheduleDefinition(offer.templateId);
          if (!definition) return null;
          const Icon = categoryIcons[definition.category];
          const completed = schedule.completedOfferIds.includes(offer.id);
          const startCheck = getPartnerScheduleStartCheck(pet, offer.id);
          const disabled = completed || !startCheck.canStart;
          const preview = getPartnerScheduleOfferPreview(pet, definition);
          const neighbor = schedule.neighborOfferId === offer.id
            ? selectNeighborReference(offer.id, neighbors)
            : undefined;
          return (
            <article className={`partner-schedule-item partner-schedule-item--${definition.category}${completed ? ' partner-schedule-item--completed' : ''}`} key={offer.id}>
              <div className="partner-schedule-item__heading">
                <span className={`partner-schedule-category-icon partner-schedule-category-icon--${definition.category}`}><Icon size={23} aria-hidden="true" /></span>
                <div>
                  <span>{t(`ui.partnerSchedule.sizes.${definition.size}`)} · {t(`ui.partnerSchedule.categories.${definition.category}`)}</span>
                  <h3>{getPartnerScheduleDisplayTitle(definition.id, neighbor, neighbors)}</h3>
                  <p>{getPartnerScheduleDisplaySummary(definition.id, neighbor, neighbors)}</p>
                </div>
                {completed ? <CheckCircle2 className="partner-schedule-item__complete" size={24} aria-label={t('ui.partnerSchedule.completed')} /> : null}
              </div>

              <div className="partner-schedule-costs">
                <span>{t('ui.partnerSchedule.cost.energy', { amount: preview.energyCost })}</span>
                <span>{t('ui.partnerSchedule.cost.hunger', { amount: Math.round(preview.hungerCost) })}</span>
                <span>{t('ui.partnerSchedule.cost.mood', { amount: Math.round(preview.moodCost) })}</span>
              </div>

              <footer className="partner-schedule-item__footer">
                <span><Clock3 size={16} aria-hidden="true" />{formatDuration(preview.durationMs)}</span>
                <strong>
                  <Coins size={17} aria-hidden="true" />
                  {preview.grantsMasterCompletion
                    ? t('ui.partnerSchedule.rewardPreviewMaster', { coins: preview.coinReward })
                    : t('ui.partnerSchedule.rewardPreview', { coins: preview.coinReward, xp: preview.skillXp })}
                </strong>
                <button type="button" className="primary-button" disabled={disabled} onClick={() => onStart(offer.id)}>
                  {completed ? t('ui.partnerSchedule.completed') : startCheck.canStart ? t('ui.partnerSchedule.start') : t(`ui.partnerSchedule.blocked.${startCheck.reason ?? 'missing'}`)}
                </button>
              </footer>
            </article>
          );
        })}
      </div>

      <section className="partner-schedule-milestones" aria-label={t('ui.partnerSchedule.milestones.aria')}>
        <div>
          <span>{t('ui.partnerSchedule.milestones.level3Title')}</span>
          <strong>{t('ui.partnerSchedule.milestones.progress', { count: level3Count, level: 3 })}</strong>
          <small>{level3Count < categories.length
            ? t('ui.partnerSchedule.milestones.level3Locked')
            : schedule.boardOfferCount >= 4
              ? t('ui.partnerSchedule.milestones.level3Active')
              : t('ui.partnerSchedule.milestones.nextReset', { count: 4 })}</small>
        </div>
        <div>
          <span>{t('ui.partnerSchedule.milestones.level6Title')}</span>
          <strong>{t('ui.partnerSchedule.milestones.progress', { count: level6Count, level: 6 })}</strong>
          <small>{level6Count < categories.length
            ? t('ui.partnerSchedule.milestones.level6Locked')
            : schedule.boardOfferCount >= 5
              ? t('ui.partnerSchedule.milestones.level6Active')
              : t('ui.partnerSchedule.milestones.nextReset', { count: 5 })}</small>
        </div>
        <strong className="partner-schedule-milestones__income">
          {t('ui.partnerSchedule.milestones.income', { percent: globalCoinBonusPercent })}
        </strong>
      </section>
    </section>
  );
};
