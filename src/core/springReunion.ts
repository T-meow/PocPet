import type { NeighborIdentity, PetState } from './petTypes';
import { isFestivalOpen } from './festivalCalendar';
import { canSpendCompanionTime } from './kitchen';
import { advancePet } from './petLifecycle';
import { campaignChapterIds } from './explorationCampaignData';
import { campaignRunFinished, campaignRunSnapshot, defaultSpringReunion, getReunionGroup, type CampaignContact, type SpringReunionState } from './explorationCampaignState';

export const isSpringReunionVisible = (pet: PetState, now = Date.now()) => Boolean(pet.adventure.reunion.startedAt || pet.adventure.reunion.history.length || isFestivalOpen('spring-festival', now));
export const getSpringReunionStartReason = (pet: PetState, now = Date.now()) => {
  if (pet.timePause) return '恢复时间后再接下团圆邀请。';
  if (!isFestivalOpen('spring-festival', now)) return '只在春节活动期间接取，接下后可跨节继续。';
  if (!(pet.adventure.completed.tutorial ?? 0)) return '先完成并结算新手踩点。';
  const state = pet.adventure.reunion;
  if (state.startedAt && !campaignRunFinished(state)) return '先办完上一期团圆，并领完章节心意。';
  if (state.lastOpenedYear >= new Date(now).getFullYear()) return '今年的团圆邀请已经接过了。';
  if (pet.adventure.active || pet.adventure.pending || pet.community.expedition.active || pet.community.expedition.pending) return '先结束当前行程并收好返程行囊。';
  if (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning) return '等伙伴休息或忙完，再一起商量。';
  return '';
};
export const startSpringReunion = (pet: PetState, neighbors: readonly NeighborIdentity[], actorId: string, actorName: string, now = Date.now(), expectedRunId = pet.adventure.reunion.runId): PetState => {
  if (!Number.isFinite(now) || pet.adventure.reunion.runId !== expectedRunId || getSpringReunionStartReason(pet, now)) return pet;
  if (!/^[a-z0-9][a-z0-9._-]{1,127}$/.test(actorId) || !actorName.trim()) return pet;
  pet = advancePet(pet, now);
  if (getSpringReunionStartReason(pet, now)) return pet;
  const previous = pet.adventure.reunion, year = new Date(now).getFullYear();
  const byId = new Map<string, NeighborIdentity>();
  for (const p of [...neighbors, { modId: actorId, name: actorName }]) {
    if (/^[a-z0-9][a-z0-9._-]{1,127}$/.test(p.modId) && p.name.trim()) byId.set(p.modId, { modId: p.modId, name: p.name.trim().slice(0, 64) });
  }
  const participants = [...byId.values()].sort((a, b) => a.modId.localeCompare(b.modId)).map((p, index) => ({ ...p, chapter: campaignChapterIds[index % campaignChapterIds.length] }));
  const reunion: SpringReunionState = { ...defaultSpringReunion(), year, lastOpenedYear: year, startedAt: now, runId: 'reunion:' + pet.createdAt + ':' + year + ':' + now, participants, history: previous.startedAt ? [...previous.history, campaignRunSnapshot(previous)] : previous.history };
  reunion.contacts = Object.fromEntries(campaignChapterIds.map(chapter => {
    const first = getReunionGroup(reunion, chapter)[0];
    const contact: CampaignContact = first ? { reference: { kind: 'mod', modId: first.modId }, name: first.name } : { reference: { kind: 'generic' }, name: '同行的伙伴' };
    return [chapter, contact];
  }));
  return { ...pet, adventure: { ...pet.adventure, reunion }, recentEvent: '团圆邀请已记下，所有伙伴的分工都安排好了。有空先到溪谷旧木桥碰面，春节过后也能继续。' };
};
