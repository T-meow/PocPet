import { MiniGamesHub } from '../../minigames/MiniGamesHub';
import { finishMiniGameHub, saveMiniGameHub } from '../../core/miniGameHub';
import type { HostedMiniGameSession } from '../../core/companionActivityTypes';
import type { PetState } from '../../core/petTypes';
import type { MiniGameHost } from '../../minigames/types';

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
  };
  return <div className="hosted-mini-game" data-hosted-game={session.game}>
    {result && result.id === roundId && result.actorId === session.actorId && <p className="hosted-game-reward" role="status">♥ 本局收获 {result.hearts} 心心，已经收好啦。</p>}
    <MiniGamesHub host={host} gameId={session.game} embedded paused={session.paused} />
  </div>;
}
