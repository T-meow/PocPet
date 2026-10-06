import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Gamepad2, Pause, X } from 'lucide-react';
import { DialogShell } from './DialogShell';
import { CompanionMemories } from './CompanionMemories';
import { MiniGameBoard } from './play/MiniGameBoard';
import { activityText as L } from '../core/kitchenRecipes';
import { acknowledgeMiniGameResult, gameName, miniGameUnlockLevel, pauseMiniGame, startMiniGame, type MiniGameAction } from '../core/miniGames';
import { isExpeditionAway } from '../core/expeditionData';
import { MiniGameResultModal } from './play/MiniGameResultModal';
import { useMiniGameFeedback } from './play/useMiniGameFeedback';
import { itemIcons } from '../assets';
import type { PetState } from '../core/pet';
import { isHostedMiniGameSession, type PlayMode } from '../core/companionActivityTypes';
import { sessionId } from '../minigames/shared/state';
import { MiniGameEntrance } from './play/MiniGameEntrance';
import { playSfx } from '../core/audio';
import './play/miniGameHub.css';

const HostedMiniGame = lazy(() => import('./play/HostedMiniGame'));
interface Props { pet: PetState; actorId: string; portrait: string; happyPortrait: string; ballImage?: string; onClose: () => void; onShop: () => void; onQuickPlay: () => void; update: (action: (pet: PetState) => PetState) => void; onAct: (id: string, action: MiniGameAction) => void; }

export const PlayModal = ({ pet, actorId, portrait, happyPortrait, ballImage = itemIcons.toy_ball, onClose, onShop, onQuickPlay, update, onAct }: Props) => {
  const [tab, setTab] = useState<'games' | 'memories'>('games');
  const [mode, setMode] = useState<PlayMode>('gentle');
  const feedback = useMiniGameFeedback(pet.miniGames, actorId);
  const active = pet.miniGames.active;
  const levelUnlocked = pet.level >= miniGameUnlockLevel;
  const available = levelUnlocked && !pet.isSleeping && !pet.partnerSchedule.active && !pet.adventure.active && !isExpeditionAway(pet) && !pet.community.fishing.active && !pet.timePause;
  const playing = active && !active.paused && active.actorId === actorId && available;
  const hosted = active && isHostedMiniGameSession(active);
  const result = pet.miniGames.lastResult?.actorId === actorId ? pet.miniGames.lastResult : undefined;
  const body = useRef<HTMLDivElement>(null);
  const returnGame = useRef<string>();
  const backToGames = () => { returnGame.current = active?.game; update(pauseMiniGame); setTab('games'); };
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    if (!playing && returnGame.current) {
      body.current?.querySelector<HTMLButtonElement>(`[data-game-entry="${returnGame.current}"] button`)?.focus({ preventScroll: true });
      returnGame.current = undefined;
    }
  }, [Boolean(playing), active?.game]);

  if (result?.pending && !active) return <MiniGameResultModal
    result={result} portrait={happyPortrait}
    canReplay={available && (result.game !== 'catch' || (pet.inventory.toy_ball ?? 0) > 0)}
    onBack={() => update((current) => acknowledgeMiniGameResult(current, result.id))}
    onClose={() => { update((current) => acknowledgeMiniGameResult(current, result.id)); onClose(); }}
    onReplay={() => { const id = sessionId(); update((current) => startMiniGame(acknowledgeMiniGameResult(current, result.id), result.game, result.mode, actorId, id, Date.now())); }}
  />;

  const changeMode = (nextMode: PlayMode) => {
    setMode(nextMode); playSfx('tap');
    update(current => current.miniGames.active?.id === active?.id && current.miniGames.active && !isHostedMiniGameSession(current.miniGames.active)
      ? { ...current, miniGames: { ...current.miniGames, active: { ...current.miniGames.active, mode: nextMode } } } : current);
  };

  return <DialogShell className={`activity-modal play-modal play-hub-modal${playing && hosted ? ' play-hub-playing' : ''}`} backdropClassName="activity-backdrop" labelId="play-title" onClose={onClose}>
    <header className="activity-header">
      <div className="activity-heading"><span className="activity-icon"><Gamepad2 /></span><div><small>陪伴小日常</small><h2 id="play-title">{playing ? gameName(active.game) : tab === 'memories' ? L('共同回忆', 'Memories') : L('一起游戏', 'Games together')}</h2></div></div>
      <div className="activity-header-actions">
        {playing && <button className="icon-button" onClick={backToGames} aria-label={hosted ? '返回游戏列表并保存进度' : L('暂停', 'Pause')}>{hosted ? <ArrowLeft size={20} /> : <Pause size={20} />}</button>}
        {!playing && tab === 'memories' && <button className="icon-button" onClick={() => { playSfx('tap'); setTab('games'); }} aria-label="返回游戏列表"><ArrowLeft size={20} /></button>}
        <button className="icon-button" onClick={onClose} aria-label={L('关闭游戏', 'Close games')}><X /></button>
      </div>
    </header>
    <div className="activity-body" ref={body}>{!levelUnlocked ? <div className="play-welcome"><img src={portrait} alt={pet.name} /><div><h3>{L(`Lv.${miniGameUnlockLevel} 解锁小游戏`, `Games unlock at Lv.${miniGameUnlockLevel}`)}</h3><p>{L('先一起熟悉小窝，长大一点再来玩吧。', 'Settle into your little home first. Games will be here as you grow.')}</p>{active && <p>{L('上次的进度已保留，解锁后可以继续。', 'Your progress is saved. Continue when games unlock.')}</p>}</div></div>
      : playing ? isHostedMiniGameSession(active)
        ? <Suspense fallback={<p className="activity-info" role="status">正在铺好游戏桌…</p>}><HostedMiniGame key={active.id} pet={pet} session={active} portrait={portrait} happyPortrait={happyPortrait} update={update} /></Suspense>
        : <><div className="play-session-settings"><div role="group" aria-label={L('节奏', 'Pace')}><span>{L('节奏', 'Pace')}</span><button aria-pressed={active.mode === 'gentle'} onClick={() => changeMode('gentle')}>{L('轻松 · 有辅助', 'Gentle · assisted')}</button><button aria-pressed={active.mode === 'normal'} onClick={() => changeMode('normal')}>{L('标准', 'Standard')}</button></div>{active.game === 'matching' && <div role="group" aria-label={L('翻牌图案', 'Matching cards')}><span>图案</span>{([['garden', L('花园', 'Garden')], ['fruit', L('水果', 'Fruit')], ['night', L('星夜', 'Night')]] as const).map(([style, label]) => <button key={style} aria-pressed={pet.miniGames.style === style} onClick={() => { playSfx('tap'); update(current => ({ ...current, miniGames: { ...current.miniGames, style } })); }}>{label}</button>)}</div>}</div><MiniGameBoard key={active.id} session={active} portrait={active.game === 'catch' && active.throwResult === 'caught' ? happyPortrait : portrait} ballImage={ballImage} style={pet.miniGames.style} feedback={feedback} onAct={(action) => onAct(active.id, action)} /></>
      : tab === 'games' ? <MiniGameEntrance pet={pet} actorId={actorId} portrait={portrait} ballImage={ballImage} mode={mode} available={available} onShop={onShop} onQuickPlay={onQuickPlay} onMemories={() => setTab('memories')} update={update} />
        : <CompanionMemories pet={pet} actorId={actorId} />}
    </div>
  </DialogShell>;
};
