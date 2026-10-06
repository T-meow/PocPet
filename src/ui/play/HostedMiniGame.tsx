import { MiniGamesHub } from '../../minigames/MiniGamesHub';
import { endMiniGameHub, finishMiniGameHub, saveMiniGameHub } from '../../core/miniGameHub';
import { getMiniGameScoreHearts, isScoreMiniGame, miniGameScoreUnit } from '../../core/miniGames';
import { getAudioEnabled, playSfx, type SfxId } from '../../core/audio';
import type { HostedMiniGameSession } from '../../core/companionActivityTypes';
import type { PetState } from '../../core/petTypes';
import type { FeedbackSound, MiniGameHost } from '../../minigames/types';

const sounds: Record<FeedbackSound, SfxId> = { tap: 'tap', place: 'tap', clear: 'game_match', pour: 'action_bath', win: 'game_finish' };

interface Props {
  pet: PetState;
  session: HostedMiniGameSession;
  portrait: string;
  happyPortrait: string;
  update: (action: (pet: PetState) => PetState) => void;
}

export default function HostedMiniGame({ pet, session, portrait, happyPortrait, update }: Props) {
  const result = pet.miniGames.lastResult;
  const roundId = pet.miniGames.hub?.games[session.game].id;
  const host: MiniGameHost = {
    companion: { name: pet.name, idle: portrait, happy: happyPortrait },
    load: () => pet.miniGames.hub,
    save: snapshot => update(current => saveMiniGameHub(current, session.id, session.actorId, snapshot, Date.now())),
    onResult: completed => update(current => finishMiniGameHub(current, session.id, session.actorId, completed, Date.now())),
    onFinish: snapshot => update(current => endMiniGameHub(current, session.id, session.actorId, snapshot, Date.now())),
    audio: { enabled: getAudioEnabled(), play: sound => playSfx(sounds[sound]) },
    renderActions: (snapshot, finish) => {
      if (!isScoreMiniGame(session.game)) return null;
      const round = snapshot.games[session.game];
      if (snapshot.reportedSessions.includes(round.id) || pet.miniGames.hub?.reportedSessions.includes(round.id)) return null;
      const hearts = getMiniGameScoreHearts(session.baseHearts, round.score);
      return <section className="hosted-game-settlement" aria-label="本局结算">
        <div><small>当前 {round.score} 分</small><strong>基础可得 ♥ {hearts}</strong><p>每 {miniGameScoreUnit} 分折合 {session.baseHearts} 心，向下取整；结算后结束本局。{hearts === 0 ? '当前不足 1 心。' : '已有心心加成另计。'}</p></div>
        <button type="button" className="hosted-settle-button" disabled={session.paused} onClick={event => { event.stopPropagation(); finish(); }}>结算并结束</button>
      </section>;
    },
  };
  return <div className="hosted-mini-game" data-hosted-game={session.game}>
    {result && result.id === roundId && result.actorId === session.actorId && <p className="hosted-game-reward" role="status">♥ 本局收获 {result.hearts} 心心，已经收好啦。</p>}
    <MiniGamesHub host={host} gameId={session.game} embedded paused={session.paused} />
  </div>;
}
