import type { AchievementView, PetState, YearReview } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { t } from '../i18n';

export interface AlbumPosterData {
  name: string; title: string; subtitle: string;
  metrics: { label: string; value: string; tone: string }[];
  notes: string[];
}
export const isAlbumArtworkUnlocked = (pet: PetState, achievement: AchievementView) =>
  Boolean(achievement.unlocked && achievement.reward.cgId && pet.achievements.unlockedCgIds.includes(achievement.reward.cgId));
const metric = (label: string, value: number, tone: string) => ({ label, value: Math.max(0, Math.round(value)).toLocaleString(), tone });
export const createAlbumData = (pet: PetState): AlbumPosterData => {
  const counters = pet.achievements.counters;
  return {
    name: pet.name, title: L('把小日子，收进回忆里。', 'Keep our little days together.'),
    subtitle: L(`一起走过 ${Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} 天 · Lv.${pet.level}`, `${Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} days together · Lv.${pet.level}`),
    metrics: [metric(L('照顾时刻', 'Care moments'), Object.values(counters.careActionCounts).reduce((sum, count) => sum + count, 0), 'rose'), metric(L('物品使用', 'Items used'), counters.totalItemUseCount, 'gold'), metric(L('花园收获', 'Garden harvests'), pet.garden.lifetimeHarvestCount, 'mint'), metric(L('完成日程', 'Activities completed'), counters.partnerScheduleClaimCount, 'sky'), metric(L('专注时光', 'Focus sessions'), pet.pomodoro.completedFocusCount, 'lilac'), metric(L('成长成就', 'Achievements'), Object.keys(pet.achievements.unlockedAtById).length, 'peach')],
    notes: [L('当前存档累计 · 从已有记录中收集我们的日常', 'Current save · All recorded moments together'), ...(['study', 'cooking', 'garden', 'exercise'] as const).map((category) => `${t(`ui.partnerSchedule.categories.${category}`)} Lv.${pet.partnerSchedule.skills[category].level}`)],
  };
};
export const createReviewAlbumData = (name: string, review: YearReview, current = false): AlbumPosterData => ({
  name, title: L(`${review.year} 年的陪伴`, `Our ${review.year} together`), subtitle: current ? L('本年记录 · 截至今天', 'This year · So far') : L('年度回顾 · 已结算记录', 'Year in review · Completed year'),
  metrics: [metric(L('相伴天数', 'Days together'), review.companionDays, 'sky'), metric(L('常来陪伴', 'Active days'), review.activeDays, 'gold'), metric(L('照顾时刻', 'Care moments'), review.careActions, 'rose'), metric(L('物品使用', 'Items used'), review.itemUseCount, 'mint'), metric(L('专注时光', 'Focus sessions'), review.pomodoroFocusCount, 'lilac'), { label: L('常做的照顾', 'Favorite care'), value: review.topCareAction ? t(`ui.yearReview.actions.${review.topCareAction}`) : L('慢慢积攒', 'Growing together'), tone: 'peach' }],
  notes: [L('普通的每一天，也值得被记住。', 'Every ordinary day is worth remembering.')],
});
export const createCurrentReview = (pet: PetState): YearReview => {
  const stats = pet.yearlyStats;
  const top = Object.entries(stats.careActionCounts).sort((a, b) => b[1] - a[1])[0];
  const yearStart = new Date(stats.year, 0, 1).getTime();
  const end = Math.min(pet.lastUpdatedAt, new Date(stats.year + 1, 0, 1).getTime() - 1);
  return { year: stats.year, companionDays: Math.max(0, Math.floor((end - Math.max(yearStart, pet.createdAt)) / 86400000) + 1), activeDays: stats.activeDateKeys.length, careActions: Object.values(stats.careActionCounts).reduce((sum, count) => sum + count, 0), itemUseCount: stats.itemUseCount, pomodoroFocusCount: stats.pomodoroFocusCount, topCareAction: top?.[1] > 0 ? top[0] as YearReview['topCareAction'] : undefined };
};
