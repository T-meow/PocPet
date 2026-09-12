import { useState } from 'react';
import { activityText as L } from '../core/kitchenRecipes';
import { ArrowLeft, CheckCircle2, Gift, Images, Lock, Search, Sparkles, Sprout, Trophy } from 'lucide-react';
import { getAchievementSummary, getAchievementViews, type AchievementCategory, type AchievementId, type AchievementView, type ItemId, type PetState } from '../core/pet';
import { t } from '../i18n';

export type AchievementTabId = 'all' | 'companion' | 'growth' | 'life' | 'schedule' | 'hidden';

const achievementTabCategories: Record<Exclude<AchievementTabId, 'all' | 'hidden'>, readonly AchievementCategory[]> = {
  companion: ['care', 'daily', 'date'],
  growth: ['growth', 'pomodoro'],
  life: ['shop', 'inventory', 'garden', 'kitchen', 'play'],
  schedule: ['schedule'],
};

const baseTabs: readonly AchievementTabId[] = ['all', 'companion', 'growth', 'life', 'schedule'];

const labels = {
  aria: t('ui.achievements.aria'),
  back: t('ui.achievements.back'),
  title: t('ui.achievements.title'),
  unlocked: t('ui.achievements.unlocked'),
  claimable: t('ui.achievements.claimable'),
  claim: t('ui.achievements.claim'),
  tabsAria: t('ui.achievements.tabsAria'),
  locked: t('ui.achievements.locked'),
  claimed: t('ui.achievements.claimed'),
  active: t('ui.achievements.active'),
  gardenExtraDrop: t('ui.achievements.gardenExtraDrop'),
  rarity: {
    rare: t('ui.achievements.rarity.rare'),
    hidden: t('ui.achievements.rarity.hidden'),
    normal: t('ui.achievements.rarity.normal'),
  },
  tabs: {
    all: t('ui.achievements.categories.all'),
    companion: t('ui.achievements.categories.companion'),
    growth: t('ui.achievements.categories.growth'),
    life: t('ui.achievements.categories.life'),
    schedule: t('ui.achievements.categories.schedule'),
    hidden: t('ui.achievements.categories.hidden'),
  },
} as const;

const tabLabel = (tab: AchievementTabId) => labels.tabs[tab];
const achievementMatchesTab = (achievement: AchievementView, tab: AchievementTabId) => {
  if (tab === 'all') return true;
  if (tab === 'hidden') return achievement.category === 'hidden';
  return achievementTabCategories[tab].includes(achievement.category);
};
const progressLabel = (progress: number, target: number) => t('ui.achievements.progress', { progress, target });

const formatDateTime = (time?: number) => {
  if (!time) return '';
  return new Date(time).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const getPrimaryRewardIcon = (achievement: AchievementView, itemIconMap: Partial<Record<ItemId, string>>) => {
  const itemId = achievement.reward.items?.[0]?.itemId;
  return itemId ? itemIconMap[itemId] : undefined;
};

const getAchievementStatusRank = (achievement: AchievementView) => {
  if (achievement.claimable) return 0;
  return achievement.unlocked ? 2 : 1;
};

const sortAchievements = (achievements: AchievementView[]) => [...achievements].sort((left, right) => {
  const rankDifference = getAchievementStatusRank(left) - getAchievementStatusRank(right);
  if (rankDifference !== 0) return rankDifference;
  if (!left.unlocked && !right.unlocked) {
    const leftProgress = left.target > 0 ? left.progressValue / left.target : 0;
    const rightProgress = right.target > 0 ? right.progressValue / right.target : 0;
    return rightProgress - leftProgress;
  }
  if (left.unlocked && right.unlocked) return (right.unlockedAt ?? 0) - (left.unlockedAt ?? 0);
  return 0;
});

export interface AchievementsPageProps {
  pet: PetState;
  activeCategory: AchievementTabId;
  itemIconMap: Partial<Record<ItemId, string>>;
  onBack: () => void;
  onCategoryChange: (category: AchievementTabId) => void;
  onClaimReward: (id: AchievementId) => void;
  onClaimAllRewards: () => void;
  onOpenCg?: (achievement: AchievementView) => void;
}

export const AchievementsPage = ({
  pet,
  activeCategory,
  itemIconMap,
  onBack,
  onCategoryChange,
  onClaimReward,
  onClaimAllRewards,
  onOpenCg,
}: AchievementsPageProps) => {
  const [query, setQuery] = useState('');
  const summary = getAchievementSummary(pet);
  const allAchievements = getAchievementViews(pet);
  const hasUnlockedHiddenAchievement = allAchievements.some((achievement) => achievement.rarity === 'hidden' && achievement.unlocked);
  const visibleCategories = hasUnlockedHiddenAchievement ? [...baseTabs, 'hidden' as const] : baseTabs;
  const safeActiveCategory = activeCategory === 'hidden' && !hasUnlockedHiddenAchievement ? 'all' : activeCategory;
  const achievements = sortAchievements(allAchievements.filter((achievement) => achievementMatchesTab(achievement, safeActiveCategory) && (!query.trim() || `${achievement.title} ${achievement.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))));

  return (
    <section className="achievements-page" aria-label={labels.aria}>
      <header className="achievements-page__header">
        <button type="button" className="icon-button" aria-label={labels.back} title={labels.back} onClick={onBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <div className="achievements-page__title">
          <h2>{labels.title}</h2>
        </div>
        {summary.claimable > 0 ? (
          <button type="button" className="primary-button achievements-page__claim-all" onClick={onClaimAllRewards}>
            <Gift size={18} aria-hidden="true" />
            {t('ui.achievements.claimAll', { count: summary.claimable })}
          </button>
        ) : null}
      </header>

      <div className="achievements-summary" aria-label={t('ui.achievements.unlockedProgress', { unlocked: summary.unlocked, total: summary.total })}>
        <div className="achievements-summary__item">
          <Trophy size={20} aria-hidden="true" />
          <span>{labels.unlocked}</span>
          <strong>{summary.unlocked}/{summary.total}</strong>
        </div>
        <div className="achievements-summary__item">
          <Gift size={20} aria-hidden="true" />
          <span>{labels.claimable}</span>
          <strong>{summary.claimable}</strong>
        </div>
        <div className="achievements-summary__item">
          <Sprout size={20} aria-hidden="true" />
          <span>{labels.gardenExtraDrop}</span>
          <strong>{t('ui.achievements.gardenExtraDropAmount', { percent: summary.gardenExtraDropChancePercent })}</strong>
        </div>
      </div>

      <div className="achievement-tabs" role="tablist" aria-label={labels.tabsAria}>
        {visibleCategories.map((category) => (
          <button
            type="button"
            role="tab"
            aria-selected={safeActiveCategory === category}
            className="achievement-tab"
            key={category}
            onClick={() => onCategoryChange(category)}
          >
            {tabLabel(category)}
          </button>
        ))}
      </div>

      <label className="v2-search"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L('寻找一点成长', 'Find a little growth')} aria-label={L('搜索成就', 'Search achievements')} /></label>
      {!achievements.length && <p className="v2-empty">{L('还没有符合的记录，试试其他关键词。', 'No matches. Try another search.')}</p>}
      <div className="achievement-list">
        {achievements.map((achievement) => {
          const percent = achievement.target > 0 ? Math.min(100, (achievement.progressValue / achievement.target) * 100) : 0;
          const rewardIcon = getPrimaryRewardIcon(achievement, itemIconMap);
          const canOpenCg = achievement.unlocked && Boolean(achievement.reward.cgId) && Boolean(onOpenCg);
          return (
            <article
              className={`achievement-list-item${achievement.unlocked ? ' achievement-list-item--completed' : ''}${achievement.claimable ? ' achievement-list-item--claimable' : ''}`}
              key={achievement.id}
            >
              <div className="achievement-list-item__icon" aria-hidden="true">
                {achievement.unlocked ? <Trophy size={22} /> : <Lock size={20} />}
              </div>

              <div className="achievement-list-item__content">
                <div className="achievement-list-item__title">
                  <h3>{achievement.title}</h3>
                  {achievement.rarity !== 'normal' ? <span>{labels.rarity[achievement.rarity]}</span> : null}
                </div>
                <p>{achievement.description}</p>
                <div className="achievement-list-item__progress-row">
                  <div
                    className="achievement-progress"
                    role="progressbar"
                    aria-label={progressLabel(achievement.progressValue, achievement.target)}
                    aria-valuemin={0}
                    aria-valuemax={achievement.target}
                    aria-valuenow={achievement.progressValue}
                  >
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <small>{progressLabel(achievement.progressValue, achievement.target)}</small>
                </div>
                <div className="achievement-list-item__reward">
                  {rewardIcon ? <img src={rewardIcon} alt="" aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
                  <span>{achievement.rewardText}</span>
                </div>
              </div>

              <div className="achievement-list-item__actions">
                {achievement.unlockedAt ? <time dateTime={new Date(achievement.unlockedAt).toISOString()}>{formatDateTime(achievement.unlockedAt)}</time> : null}
                {achievement.claimable ? (
                  <button type="button" className="primary-button" onClick={() => onClaimReward(achievement.id)}>
                    <Gift size={16} aria-hidden="true" />
                    {labels.claim}
                  </button>
                ) : achievement.unlocked ? (
                  <span className="achievement-list-item__done"><CheckCircle2 size={16} aria-hidden="true" />{achievement.effectActive ? labels.active : labels.claimed}</span>
                ) : (
                  <span className="achievement-list-item__locked">{labels.locked}</span>
                )}
                {canOpenCg && onOpenCg ? (
                  <button type="button" className="secondary-button achievement-list-item__cg" onClick={() => onOpenCg(achievement)}>
                    <Images size={16} aria-hidden="true" />
                    {t('ui.achievements.cg.view')}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
