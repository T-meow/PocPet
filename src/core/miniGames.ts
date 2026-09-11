import { applyHeartGain, incrementAchievementCareAction, recordEarnedHearts } from './achievements';
import { recordWishProgress } from './dailyWishes';
import { rememberTogether } from './companionMemories';
import { activityText } from './kitchenRecipes';
import { clampLevel, clampPetStat, scalePetStatDelta } from './petStats';
import { recordYearlyCareAction } from './yearlyStats';
import { hashString } from './utils';
import { removeInventoryItem } from './items';
import type { PetState, Inventory } from './petTypes';
import type { MiniGameId, MiniGameSession, MiniGameState, PlayMode } from './companionActivityTypes';

export const miniGameDefinitions = [
  { id: 'matching' as const, name: '记忆翻牌', en: 'Matching pairs', glyph: '🎴' },
  { id: 'catch' as const, name: '一起接球', en: 'Play catch', glyph: '⚽' },
  { id: 'bubbles' as const, name: '吹泡泡', en: 'Blow bubbles', glyph: '🫧' },
];
export const gameName = (id: MiniGameId) => { const game = miniGameDefinitions.find((entry) => entry.id === id)!; return activityText(game.name, game.en); };
export const miniGameUnlockLevel = 3;
export const getMiniGameBaseHearts = (level: number, game: MiniGameId = 'matching') => {
  const rewardLevel = clampLevel(level);
  if (rewardLevel < miniGameUnlockLevel) return 0;
  // A small starting reward grows faster as later levels demand more hearts.
  const hearts = Math.round(5 + 145 * ((rewardLevel - miniGameUnlockLevel) / 96) ** 1.65);
  return hearts * (game === 'catch' ? 3 : 1);
};
export const catchFlightMs = 450;
export const bubbleHoldMs = 1500;
export const bubbleSessionMs = 6000;
export const getCatchPetX = (session: MiniGameSession, now: number) => 0.5 + 0.31 * Math.sin((session.elapsedMs + Math.max(0, now - session.lastTickAt)) / 2600 * Math.PI * 2);
const gameIds: MiniGameId[] = ['matching', 'catch', 'bubbles'];
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
export const defaultMiniGameState = (): MiniGameState => ({ schemaVersion: 1, unlocked: ['matching'], records: {}, style: 'garden' });
export const normalizeMiniGameState = (raw: unknown, inventory: Inventory = {}, used: Partial<Record<string, number>> = {}, options: { preserveSession?: boolean; level?: number } = {}): MiniGameState => {
  const value = raw && typeof raw === 'object' ? raw as Partial<MiniGameState> : {};
  const next = defaultMiniGameState();
  const unlocked = Array.isArray(value.unlocked) ? value.unlocked : [];
  next.unlocked = gameIds.filter((id) => id === 'matching' || unlocked.includes(id) || (id === 'catch' && ((inventory.toy_ball ?? 0) > 0 || (used.toy_ball ?? 0) > 0)));
  for (const game of gameIds) for (const mode of ['normal', 'gentle']) {
    const key = `${game}:${mode}`;
    const record = value.records?.[key];
    if (record && typeof record === 'object') next.records[key] = { completed: count(record.completed), best: count(record.best), bestMs: count(record.bestMs) };
  }
  next.style = value.style === 'fruit' || value.style === 'night' ? value.style : 'garden';
  const active = value.active;
  if (active && typeof active.id === 'string' && typeof active.actorId === 'string' && gameIds.includes(active.game) && (active.mode === 'normal' || active.mode === 'gentle') && next.unlocked.includes(active.game)) {
    const deck = Array.isArray(active.deck) ? active.deck : [];
    if (deck.length === 12 && [0, 1, 2, 3, 4, 5].every((face) => deck.filter((entry) => entry === face).length === 2)) {
      const indices = (values: unknown) => Array.isArray(values) ? [...new Set(values.filter((index): index is number => Number.isInteger(index) && index >= 0 && index < 12))] : [];
      const matched = indices(active.matched);
      const validMatched = matched.filter((index) => matched.filter((other) => deck[index] === deck[other]).length === 2);
      // Live updates keep the current session; saves and imports default to paused.
      const paused = !options.preserveSession || active.paused !== false || (options.level !== undefined && options.level < miniGameUnlockLevel);
      // Preserve old low-level games for resuming at Lv.3, with the entry reward.
      const rewardLevel = Math.max(miniGameUnlockLevel, clampLevel(count(active.rewardLevel) || options.level || miniGameUnlockLevel));
      next.active = {
        id: active.id, game: active.game, actorId: active.actorId, mode: active.mode, paused,
        startedAt: count(active.startedAt), lastTickAt: paused ? 0 : count(active.lastTickAt), elapsedMs: count(active.elapsedMs), rewardLevel, baseHearts: getMiniGameBaseHearts(rewardLevel, active.game),
        deck, matched: validMatched, flipped: indices(active.flipped).filter((index) => !validMatched.includes(index)).slice(0, 2), moves: count(active.moves),
        rounds: Math.min(10, count(active.rounds)), streak: Math.min(10, count(active.streak)), bestStreak: Math.min(10, count(active.bestStreak)), throwAt: paused || !Number.isFinite(active.throwTargetX) ? 0 : count(active.throwAt),
        throwTargetX: Number.isFinite(active.throwTargetX) ? Math.max(-0.2, Math.min(1.2, active.throwTargetX)) : 0.5,
        throwPetX: Number.isFinite(active.throwPetX) ? Math.max(0, Math.min(1, active.throwPetX)) : 0.5,
        throwResult: active.throwResult === 'caught' || active.throwResult === 'missed' ? active.throwResult : undefined,
        bubbles: Array.isArray(active.bubbles) ? active.bubbles.filter((bubble) => bubble && Number.isInteger(bubble.id) && typeof bubble.popped === 'boolean').slice(-60).map((bubble) => ({ id: count(bubble.id), size: Math.min(5, Math.max(0.2, count(bubble.size * 1000) / 1000)), popped: bubble.popped, shape: bubble.shape === 'heart' || bubble.shape === 'star' ? bubble.shape : 'round' })) : [],
        blowingAt: paused ? 0 : count(active.blowingAt), participationMs: count(active.participationMs),
      };
    }
  }
  const result = value.lastResult;
  if (result && typeof result.id === 'string' && typeof result.actorId === 'string' && gameIds.includes(result.game)) next.lastResult = {
    id: result.id, actorId: result.actorId, game: result.game, mode: result.mode === 'normal' ? 'normal' : 'gentle',
    hearts: count(result.hearts), baseHearts: typeof result.baseHearts === 'number' ? count(result.baseHearts) : undefined,
    rewardLevel: typeof result.rewardLevel === 'number' ? clampLevel(result.rewardLevel) : undefined,
    mood: typeof result.mood === 'number' && Number.isFinite(result.mood) ? Math.max(0, result.mood) : undefined,
    score: count(result.score), elapsedMs: count(result.elapsedMs), at: count(result.at), pending: result.pending === true,
  };
  return next;
};
export const unlockBallGame = (pet: PetState): PetState => pet.miniGames.unlocked.includes('catch') ? pet : { ...pet, miniGames: { ...pet.miniGames, unlocked: [...pet.miniGames.unlocked, 'catch'] } };
export const buyBubbleWand = (pet: PetState): PetState => pet.level < miniGameUnlockLevel || pet.coins < 30 || pet.miniGames.unlocked.includes('bubbles') ? pet : { ...pet, coins: pet.coins - 30, miniGames: { ...pet.miniGames, unlocked: [...pet.miniGames.unlocked, 'bubbles'] } };
export const getPlayTotal = (pet: PetState) => Object.values(pet.miniGames.records).reduce((sum, record) => sum + record.completed, 0);
export const startMiniGame = (pet: PetState, game: MiniGameId, mode: PlayMode, actorId: string, id: string, now: number): PetState => {
  if (pet.level < miniGameUnlockLevel || !gameIds.includes(game) || (game !== 'catch' && !pet.miniGames.unlocked.includes(game)) || (game === 'catch' && (pet.inventory.toy_ball ?? 0) < 1) || !id || pet.miniGames.active || pet.miniGames.lastResult?.id === id || (pet.miniGames.lastResult?.pending && pet.miniGames.lastResult.actorId === actorId) || pet.isSleeping || pet.partnerSchedule.active) return pet;
  const deck = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5];
  for (let index = deck.length - 1; index > 0; index--) { const other = hashString(`${id}:${index}`) % (index + 1); [deck[index], deck[other]] = [deck[other], deck[index]]; }
  const inventory = game === 'catch' ? removeInventoryItem(pet.inventory, 'toy_ball', 1) : pet.inventory;
  const unlocked = game === 'catch' ? [...new Set<MiniGameId>([...pet.miniGames.unlocked, 'catch'])] : pet.miniGames.unlocked;
  return { ...pet, inventory, lastInteractionAt: now, miniGames: { ...pet.miniGames, unlocked, active: { id, game, mode, actorId, paused: false, startedAt: now, lastTickAt: now, elapsedMs: 0, rewardLevel: clampLevel(pet.level), baseHearts: getMiniGameBaseHearts(pet.level, game), deck, matched: [], flipped: [], moves: 0, rounds: 0, streak: 0, bestStreak: 0, throwAt: 0, throwTargetX: 0.5, throwPetX: 0.5, bubbles: [], blowingAt: 0, participationMs: 0 } } };
};
export const acknowledgeMiniGameResult = (pet: PetState, id: string): PetState => {
  const result = pet.miniGames.lastResult;
  if (!result || result.id !== id || !result.pending) return pet;
  return { ...pet, miniGames: { ...pet.miniGames, lastResult: { ...result, pending: false } } };
};
export const pauseMiniGame = (pet: PetState): PetState => {
  const active = pet.miniGames.active;
  if (!active || active.paused) return pet;
  return { ...pet, miniGames: { ...pet.miniGames, active: { ...active, paused: true, throwAt: 0, blowingAt: 0, lastTickAt: 0 } } };
};
export const resumeMiniGame = (pet: PetState, actorId: string, now: number): PetState => {
  const active = pet.miniGames.active;
  if (!active || pet.level < miniGameUnlockLevel || active.actorId !== actorId || pet.isSleeping || pet.partnerSchedule.active) return pet;
  return { ...pet, miniGames: { ...pet.miniGames, active: { ...active, paused: false, lastTickAt: now } } };
};
export const abandonMiniGame = (pet: PetState): PetState => ({ ...pet, miniGames: { ...pet.miniGames, active: undefined } });
export const canFinishMiniGame = (session: MiniGameSession) => session.game === 'matching' ? session.matched.length === 12 : session.game === 'catch' ? session.rounds === 10 : session.bubbles.length >= 3 && session.participationMs >= bubbleSessionMs && session.elapsedMs >= bubbleSessionMs;
const finishMiniGame = (pet: PetState, now: number): PetState => {
  const active = pet.miniGames.active;
  if (!active || active.paused || !canFinishMiniGame(active)) return pet;
  const key = `${active.game}:${active.mode}`;
  const previous = pet.miniGames.records[key] ?? { completed: 0, best: 0, bestMs: 0 };
  const score = active.game === 'matching' ? active.moves : active.game === 'catch' ? active.bestStreak : active.bubbles.length;
  const best = previous.completed === 0 ? score : active.game === 'matching' ? Math.min(previous.best, score) : Math.max(previous.best, score);
  const gain = applyHeartGain(pet, active.baseHearts);
  const mood = clampPetStat(pet, pet.mood + scalePetStatDelta(pet, 4));
  let next: PetState = { ...pet, hearts: gain.hearts, boostCards: gain.boostCards, mood, lastInteractionAt: now, recentActivity: 'happy', recentActivityUntil: now + 3000,
    recentEvent: activityText(`一起玩了${gameName(active.game)}，收获 ${gain.amount} 颗心心。`, `Played ${gameName(active.game)} together and earned ${gain.amount} hearts.`),
    miniGames: { ...pet.miniGames, active: undefined, lastResult: { id: active.id, game: active.game, actorId: active.actorId, mode: active.mode, hearts: gain.amount, baseHearts: active.baseHearts, rewardLevel: active.rewardLevel, mood: Math.max(0, mood - pet.mood), score, elapsedMs: active.elapsedMs, at: now, pending: true }, records: { ...pet.miniGames.records, [key]: { completed: previous.completed + 1, best, bestMs: previous.bestMs ? Math.min(previous.bestMs, active.elapsedMs) : active.elapsedMs } } } };
  if (active.game === 'catch') {
    const priorMemory = pet.companionMemories.entries.some((entry) => entry.actorId === active.actorId && entry.kind === 'catch_record');
    if (priorMemory) next = rememberTogether(next, active.actorId, 'practice_photo', 'together', now);
    if (active.bestStreak > previous.best) next = rememberTogether(next, active.actorId, 'catch_record', active.mode, now);
  }
  return recordWishProgress(incrementAchievementCareAction(recordYearlyCareAction(recordEarnedHearts(next, gain.amount), 'play', now), 'play'), 'play', now);
};
export type MiniGameAction = { type: 'tick' | 'clear' | 'blow' | 'release' | 'finish' } | { type: 'flip' | 'pop'; index: number } | { type: 'throw'; targetX: number };
export const actMiniGame = (pet: PetState, id: string, action: MiniGameAction, now: number): PetState => {
  const previous = pet.miniGames.active;
  if (!previous || previous.id !== id || previous.paused) return pet;
  if (pet.level < miniGameUnlockLevel || pet.isSleeping || pet.partnerSchedule.active) return pauseMiniGame(pet);
  const active = { ...previous };
  if (action.type === 'tick') {
    active.elapsedMs += Math.max(0, Math.min(1000, now - active.lastTickAt));
    active.lastTickAt = now;
    if (active.game === 'catch' && active.throwAt && now >= active.throwAt + catchFlightMs) {
      const caught = Math.abs(active.throwTargetX - active.throwPetX) <= (active.mode === 'gentle' ? 0.2 : 0.13);
      active.throwAt = 0; active.rounds++; active.streak = caught ? active.streak + 1 : 0;
      active.bestStreak = Math.max(active.bestStreak, active.streak); active.throwResult = caught ? 'caught' : 'missed';
    }
  } else if (active.game === 'matching') {
    if (action.type === 'clear' && active.flipped.length === 2) active.flipped = [];
    if (action.type === 'flip' && Number.isInteger(action.index) && action.index >= 0 && action.index < 12 && active.flipped.length < 2 && !active.matched.includes(action.index) && !active.flipped.includes(action.index)) {
      active.flipped = [...active.flipped, action.index];
      if (active.flipped.length === 2) {
        active.moves++;
        if (active.deck[active.flipped[0]] === active.deck[active.flipped[1]]) { active.matched = [...active.matched, ...active.flipped]; active.flipped = []; }
      }
    }
  } else if (active.game === 'catch') {
    if (action.type === 'throw' && !active.throwAt && active.rounds < 10 && Number.isFinite(action.targetX)) {
      active.throwAt = now; active.throwTargetX = Math.max(-0.2, Math.min(1.2, action.targetX));
      active.throwPetX = getCatchPetX(active, now + catchFlightMs); active.throwResult = undefined;
    }
  } else if (active.game === 'bubbles') {
    if (action.type === 'blow' && !active.blowingAt && active.bubbles.length < 60) active.blowingAt = now;
    if (action.type === 'release' && active.blowingAt) {
      const duration = Math.max(0, Math.min(bubbleHoldMs, now - active.blowingAt));
      active.blowingAt = 0;
      if (duration >= 120) {
        const index = active.bubbles.length;
        active.bubbles = [...active.bubbles, { id: index, size: duration / 1000, shape: duration >= 900 ? 'heart' : duration >= 450 ? 'star' : 'round', popped: false }];
        active.participationMs += duration;
      }
    }
    if (action.type === 'pop' && active.bubbles.some((bubble) => bubble.id === action.index && !bubble.popped)) { active.bubbles = active.bubbles.map((bubble) => bubble.id === action.index ? { ...bubble, popped: true } : bubble); active.participationMs += 500; }
  }
  const next = { ...pet, miniGames: { ...pet.miniGames, active } };
  return (active.game !== 'bubbles' || action.type === 'finish') && canFinishMiniGame(active) ? finishMiniGame(next, now) : next;
};
