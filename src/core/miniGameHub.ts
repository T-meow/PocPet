import { isHostedMiniGameSession } from './companionActivityTypes';
import { getMiniGameBaseHearts, isScoreMiniGame, miniGameUnlockLevel, settleMiniGame } from './miniGames';
import { isExpeditionAway } from './expeditionData';
import { clampLevel } from './petStats';
import { normalizeMiniGamesSave } from '../minigames/storage';
import { normalizeGameReceipts } from '../minigames/shared/receipts';
import { createBlocks, isBlocked } from '../minigames/blocks/rules';
import { createFruit } from '../minigames/fruit/state';
import { createMatch3 } from '../minigames/match3/rules';
import { waterSolved } from '../minigames/water/rules';
import type { GameResult, MiniGamesSave } from '../minigames/types';
import type { PetState } from './petTypes';

function maySettle(pet: PetState, activityId: string, actorId: string) {
  const active = pet.miniGames.active;
  return active && isHostedMiniGameSession(active) && active.id === activityId && active.actorId === actorId && !active.paused
    && pet.level >= miniGameUnlockLevel && !pet.isSleeping && !pet.partnerSchedule.active && !pet.adventure.active
    && !isExpeditionAway(pet) && !pet.community.fishing.active && !pet.timePause;
}

// The activity ID owns this mounted view; game IDs identify individual rounds.
// Late saves from an old view cannot overwrite a newly opened game.
export function saveMiniGameHub(pet: PetState, activityId: string, actorId: string, snapshot: MiniGamesSave, now: number): PetState {
  const active = pet.miniGames.active;
  if (!active || !isHostedMiniGameSession(active) || active.id !== activityId || active.actorId !== actorId || pet.timePause) return pet;
  const previous = pet.miniGames.hub;
  const incoming = normalizeMiniGamesSave(snapshot);
  const hub = previous ?? incoming;
  const changedRound = previous && previous.games[active.game].id !== incoming.games[active.game].id;
  return { ...pet, miniGames: { ...pet.miniGames,
    hub: { ...hub, activeGame: active.game, sound: incoming.sound,
      games: { ...hub.games, [active.game]: incoming.games[active.game] },
      // Only accepted settlements may add reward receipts to the formal save.
      reportedSessions: previous?.reportedSessions ?? [],
    },
    active: changedRound ? { ...active, startedAt: now, elapsedMs: 0, lastTickAt: active.paused ? 0 : now,
      rewardLevel: clampLevel(pet.level), baseHearts: getMiniGameBaseHearts(pet.level, active.game) } : active,
  } };
}

export function finishMiniGameHub(pet: PetState, activityId: string, actorId: string, result: GameResult, now: number): PetState {
  const active = pet.miniGames.active, hub = pet.miniGames.hub;
  if (!active || !isHostedMiniGameSession(active) || !hub || !maySettle(pet, activityId, actorId)
    || active.game !== result.game || hub.games[active.game].id !== result.sessionId || hub.reportedSessions.includes(result.sessionId)
  ) return pet;

  let score: number;
  if (active.game === 'blocks') {
    if (result.outcome !== 'over' || !isBlocked(hub.games.blocks) || hub.games.blocks.score <= 0) return pet;
    score = hub.games.blocks.score;
  } else if (active.game === 'water') {
    if (result.outcome !== 'complete' || !waterSolved(hub.games.water.bottles) || hub.games.water.moves <= 0) return pet;
    score = hub.games.water.moves;
  } else if (active.game === 'fruit') {
    if (result.outcome !== 'over' || !hub.games.fruit.over || hub.games.fruit.bodies.length === 0) return pet;
    score = hub.games.fruit.score;
  } else {
    if (result.outcome !== 'complete' || hub.games.match3.movesLeft !== 0 || hub.games.match3.cleared === 0) return pet;
    score = hub.games.match3.score;
  }
  const next = settleMiniGame(pet, now, score, result.sessionId, true);
  if (next === pet) return pet;
  return { ...next, miniGames: { ...next.miniGames, hub: { ...hub, reportedSessions: normalizeGameReceipts([...hub.reportedSessions, result.sessionId], hub.games) } } };
}

// End only the live scored round. Persist its latest committed board before calculating
// rewards, then replace that round so returning or replaying cannot award it twice.
export function endMiniGameHub(pet: PetState, activityId: string, actorId: string, snapshot: MiniGamesSave, now: number): PetState {
  const active = pet.miniGames.active, previous = pet.miniGames.hub;
  if (!active || !isHostedMiniGameSession(active) || !isScoreMiniGame(active.game) || !previous || !maySettle(pet, activityId, actorId)) return pet;
  const game = active.game, roundId = previous.games[game].id;
  const incoming = normalizeMiniGamesSave(snapshot);
  if (incoming.games[game].id !== roundId || previous.reportedSessions.includes(roundId)) return pet;
  const saved = saveMiniGameHub(pet, activityId, actorId, incoming, now);
  const hub = saved.miniGames.hub!;
  const round = hub.games[game];
  const next = settleMiniGame(saved, now, round.score, roundId);
  if (next === saved) return pet;
  const games = { ...hub.games };
  if (game === 'blocks') games.blocks = createBlocks(Math.max(round.best, round.score));
  else if (game === 'fruit') games.fruit = createFruit(Math.max(round.best, round.score));
  else games.match3 = createMatch3(Math.max(round.best, round.score));
  return { ...next, miniGames: { ...next.miniGames, hub: { ...hub, games,
    reportedSessions: normalizeGameReceipts([...hub.reportedSessions, roundId], games),
  } } };
}
