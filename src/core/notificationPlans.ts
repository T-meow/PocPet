import type { PetState, PomodoroState } from './petTypes';
import { getPomodoroPhaseDurationMs, getPomodoroPhaseId } from './pomodoro';

export type NotificationCategory = 'tasks' | 'harvest' | 'pomodoro';
export type NotificationTarget = 'partnerSchedule' | 'adventure' | 'fishing' | 'field' | 'garden' | 'ranch' | 'pomodoro' | 'music';
export type NotificationSource = 'schedule' | 'expedition' | 'fishing' | 'crop' | 'tree' | 'animal' | 'pomodoro';
export interface NotificationPlan {
  key: string;
  source: NotificationSource;
  category: NotificationCategory;
  at: number;
  title: string;
  body: string;
  target: NotificationTarget;
}
const key = (source: NotificationSource, ...parts: (string | number)[]) => JSON.stringify([source, ...parts]);

// Read deadlines only. Planning must never simulate gameplay, consume RNG or grant rewards.
export const deriveNotificationPlans = (pet: PetState): NotificationPlan[] => {
  if (pet.timePause) return [];
  const plans: NotificationPlan[] = [];
  const add = (source: NotificationSource, id: string, category: NotificationCategory, at: number, title: string, target: NotificationTarget) => {
    if (Number.isFinite(at) && at > 0) plans.push({ key: id, source, category, at, title, target,
      body: `${pet.name}的小提醒：${title}，回来看看吧。` });
  };
  const schedule = pet.partnerSchedule.active;
  if (schedule) add('schedule', key('schedule', schedule.offerId, schedule.startedAt), 'tasks', schedule.endsAt, '伙伴安排的计划时间已到', 'partnerSchedule');
  const expedition = pet.community.expedition.active;
  if (expedition?.mode === 'idle' && !expedition.paused) add('expedition', key('expedition', expedition.id), 'tasks', expedition.endsAt, '探险挂机的计划时间已到', 'adventure');
  const fishing = pet.community.fishing.active;
  if (fishing?.mode === 'idle') add('fishing', key('fishing', fishing.id), 'tasks', fishing.endsAt, '挂机钓鱼的计划时间已到', 'fishing');
  for (const plot of pet.community.plots) if (plot.crop) add('crop', key('crop', plot.id, plot.crop.plantedAt), 'harvest', plot.crop.readyAt, '农场作物可以收获了', 'field');
  for (const slot of pet.garden.slots) if (slot.treeId && (slot.state === 'growing' || slot.state === 'ready'))
    add('tree', key('tree', slot.slotIndex, slot.plantedAt, slot.harvestsUsed), 'harvest', slot.nextReadyAt, '花园可以收获了', 'garden');
  for (const id of ['coop', 'barn'] as const) {
    const animal = pet.community.animals[id];
    if (animal.feed > 0 && animal.stock === 0 && animal.nextAt) add('animal', key('animal', id, animal.nextAt), 'harvest', animal.nextAt, '牧场有新的产出了', 'ranch');
  }
  let phase: PomodoroState = { ...pet.pomodoro };
  // The whole finite session must be scheduled before Android suspends the WebView.
  for (let count = 0; phase.isRunning && count < 16; count++) {
    const last = phase.phase === 'short_break' && phase.round >= phase.settings.targetRounds;
    add('pomodoro', key('pomodoro', getPomodoroPhaseId(phase)), 'pomodoro', phase.phaseEndsAt,
      last ? '本组番茄钟的计划时间已到' : phase.phase === 'focus' ? '专注时段已结束，可以休息一下' : '休息时段已结束', 'pomodoro');
    if (last) break;
    const nextPhase = phase.phase === 'focus' ? 'short_break' : 'focus';
    phase = { ...phase, phase: nextPhase, phaseStartedAt: phase.phaseEndsAt,
      phaseEndsAt: phase.phaseEndsAt + getPomodoroPhaseDurationMs(nextPhase, phase.settings),
      round: phase.round + Number(nextPhase === 'focus'), completedFocusCount: phase.completedFocusCount + Number(nextPhase === 'short_break') };
  }
  return plans.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
};

export const isReminderCompleted = (pet: PetState, plan: NotificationPlan, now: number) => {
  if (pet.timePause || now < plan.at) return false;
  if (deriveNotificationPlans(pet).some(item => item.key === plan.key && item.at <= now)) return true;
  switch (plan.source) {
    case 'schedule': { const result = pet.partnerSchedule.pendingResult; return Boolean(result && result.outcome !== 'early' && result.completedAt >= plan.at && key('schedule', result.offerId, result.startedAt ?? 0) === plan.key); }
    case 'expedition': { const result = pet.community.expedition.pending; return Boolean(result && result.reason === 'complete' && key('expedition', result.id) === plan.key); }
    case 'fishing': { const result = pet.community.fishing.pending; return Boolean(result && result.reason === 'complete' && key('fishing', result.id) === plan.key); }
    case 'animal': { const parts = JSON.parse(plan.key) as [string, 'coop' | 'barn', number]; return pet.community.animals[parts[1]].stock > 0; }
    case 'pomodoro': return pet.pomodoro.phaseStartedAt >= plan.at || Boolean(pet.pomodoro.lastSettledPhaseId && key('pomodoro', pet.pomodoro.lastSettledPhaseId) === plan.key);
    default: return false;
  }
};

export const groupDueReminders = (plans: NotificationPlan[]): NotificationPlan[] => {
  const groups = new Map<string, NotificationPlan[]>();
  for (const plan of plans) {
    const id = `${plan.category}:${plan.target}`;
    groups.set(id, [...(groups.get(id) ?? []), plan]);
  }
  return [...groups.values()].map(items => items.length === 1 ? items[0] : { ...items[items.length - 1],
    body: items[0].category === 'harvest' ? `有 ${items.length} 项收获在等你，回来看看吧。` : `有 ${items.length} 项计时已到，回来查看进度吧。` });
};
