import { useState } from 'react';
import { Gamepad2, Heart, Pause, X } from 'lucide-react';
import { DialogShell } from './DialogShell';
import { CompanionMemories } from './CompanionMemories';
import { MiniGameBoard } from './play/MiniGameBoard';
import { activityText as L } from '../core/kitchenRecipes';
import { abandonMiniGame, acknowledgeMiniGameResult, buyBubbleWand, gameName, getMiniGameBaseHearts, getPlayTotal, miniGameDefinitions, miniGameUnlockLevel, pauseMiniGame, resumeMiniGame, startMiniGame, type MiniGameAction } from '../core/miniGames';
import { MiniGameResultModal } from './play/MiniGameResultModal';
import { useMiniGameFeedback } from './play/useMiniGameFeedback';
import { itemIcons } from '../assets';
import type { PetState } from '../core/pet';
import type { PlayMode } from '../core/companionActivityTypes';

interface Props { pet: PetState; actorId: string; portrait: string; happyPortrait: string; ballImage?: string; onClose: () => void; onShop: () => void; onQuickPlay: () => void; update: (action: (pet: PetState) => PetState) => void; onAct: (id: string, action: MiniGameAction) => void; }
export const PlayModal = ({ pet, actorId, portrait, happyPortrait, ballImage = itemIcons.toy_ball, onClose, onShop, onQuickPlay, update, onAct }: Props) => {
  const [tab, setTab] = useState<'games' | 'memories'>('games');
  const [mode, setMode] = useState<PlayMode>('gentle');
  const feedback = useMiniGameFeedback(pet.miniGames, actorId);
  const active = pet.miniGames.active;
  const levelUnlocked = pet.level >= miniGameUnlockLevel;
  const available = levelUnlocked && !pet.isSleeping && !pet.partnerSchedule.active;
  const playing = active && !active.paused && active.actorId === actorId && available;
  const result = pet.miniGames.lastResult?.actorId === actorId ? pet.miniGames.lastResult : undefined;
  const total = getPlayTotal(pet);
  if (result?.pending && !active) return <MiniGameResultModal
    result={result} portrait={happyPortrait}
    canReplay={available && (result.game !== 'catch' || (pet.inventory.toy_ball ?? 0) > 0)}
    onBack={() => update((current) => acknowledgeMiniGameResult(current, result.id))}
    onClose={() => { update((current) => acknowledgeMiniGameResult(current, result.id)); onClose(); }}
    onReplay={() => {
      const id = crypto.randomUUID();
      update((current) => startMiniGame(acknowledgeMiniGameResult(current, result.id), result.game, result.mode, actorId, id, Date.now()));
    }}
  />;
  return <DialogShell className="activity-modal play-modal" labelId="play-title" onClose={onClose}>
    <header className="activity-header"><div className="activity-heading"><span className="activity-icon"><Gamepad2 /></span><div><small>A LITTLE TIME, TOGETHER</small><h2 id="play-title">{playing ? gameName(active.game) : L('一起游戏', 'Games together')}</h2></div></div><div className="activity-header-actions">{playing && <button className="icon-button" onClick={() => update(pauseMiniGame)} aria-label={L('暂停', 'Pause')}><Pause size={20} /></button>}<button className="icon-button" onClick={onClose} aria-label={L('关闭游戏', 'Close games')}><X /></button></div></header>
    <div className="activity-body">{!levelUnlocked ? <div className="play-welcome"><img src={portrait} alt={pet.name} /><div><h3>{L(`Lv.${miniGameUnlockLevel} 解锁小游戏`, `Games unlock at Lv.${miniGameUnlockLevel}`)}</h3><p>{L('先一起熟悉小窝，长大一点再来玩吧。', 'Settle into your little home first. Games will be here as you grow.')}</p>{active && <p>{L('上次的进度已保留，解锁后可以继续。', 'Your progress is saved. Continue when games unlock.')}</p>}</div></div> : playing ? <MiniGameBoard key={active.id} session={active} portrait={active.game === 'catch' && active.throwResult === 'caught' ? happyPortrait : portrait} ballImage={ballImage} style={pet.miniGames.style} feedback={feedback} onAct={(action) => onAct(active.id, action)} /> : <>
      <div className="play-welcome"><img src={portrait} alt={pet.name} /><div><h3>{L('开心就好，不用拿满分。', 'No perfect scores needed. Just us.')}</h3><p>{L('随时开始，随时休息。每次完成都有心心。', 'Start whenever you like. Take breaks. Every finished game earns hearts.')}</p><span className="activity-heart"><Heart size={16} /> {L(`Lv.${pet.level} · 心心收益随等级一起成长`, `Lv.${pet.level} · Heart rewards grow with your level`)}</span></div></div>
      <nav className="activity-tabs"><button aria-pressed={tab === 'games'} className={tab === 'games' ? 'selected' : ''} onClick={() => setTab('games')}>{L('小游戏', 'Games')}</button><button aria-pressed={tab === 'memories'} className={tab === 'memories' ? 'selected' : ''} onClick={() => setTab('memories')}>{L('共同回忆', 'Memories')}</button></nav>
      {!available && <p className="activity-info">{L('伙伴正在休息或忙日程，等空闲再一起玩吧。', 'Your companion is resting or busy. Come back when they’re free.')}</p>}
      {active && <section className="paused-game"><h3>{L('上次的一局还留在这里', 'Your game is right where you left it')}</h3><p>{gameName(active.game)} · {L('已暂停，离开期间不计时', 'Paused; time away does not count')}</p>{active.actorId !== actorId && <p>{L('这是与另一位伙伴开始的一局。切回那位伙伴可以继续。', 'This game belongs to another companion. Switch back to continue.')}</p>}<div className="activity-choice"><button className="activity-primary" disabled={!available || active.actorId !== actorId} onClick={() => update((current) => resumeMiniGame(current, actorId, Date.now()))}>{L('继续一起玩', 'Continue playing')}</button><button className="activity-secondary" onClick={() => update(abandonMiniGame)}>{L('结束这一局', 'End this game')}</button></div></section>}
      {tab === 'games' ? <><div className="activity-choice mode-choice"><span>{L('节奏', 'Pace')}</span><button aria-pressed={mode === 'gentle'} onClick={() => setMode('gentle')}>{L('轻松 · 有辅助', 'Gentle · assisted')}</button><button aria-pressed={mode === 'normal'} onClick={() => setMode('normal')}>{L('标准', 'Standard')}</button><small>{L('两种模式同等奖励', 'Same rewards in both modes')}</small></div><div className="play-game-grid">{miniGameDefinitions.map((game) => {
        const unlocked = game.id === 'catch' ? (pet.inventory.toy_ball ?? 0) > 0 : pet.miniGames.unlocked.includes(game.id);
        const record = pet.miniGames.records[`${game.id}:${mode}`];
        const descriptions = { matching: L('翻开十二张牌，慢慢找到六对朋友。', 'Find six pairs among twelve cards.'), catch: L('滑动把球抛出去，移动中的伙伴来接！一局十次。', 'Swipe to throw at your moving companion. Ten throws per game!'), bubbles: L('轻按、松开、戳破。吹出三个泡泡，互动六秒就有收获。', 'Hold, release, pop! Three bubbles and six seconds earn your reward.') };
        return <article className={`play-game-card play-game-card--${game.id}`} key={game.id}>
          <span className="game-glyph">{game.id === 'catch' ? <img src={ballImage} alt="" draggable={false} /> : game.glyph}</span><h3>{gameName(game.id)}</h3><p>{descriptions[game.id]}</p>
          <span className="activity-heart">♥ {L(`至少 ${getMiniGameBaseHearts(pet.level, game.id)} 心`, `At least ${getMiniGameBaseHearts(pet.level, game.id)} hearts`)}</span>
          {game.id === 'catch' && <small>{L(`每局消耗 1 个玩具球 · 持有 ${pet.inventory.toy_ball ?? 0}`, `One toy ball per game · ${pet.inventory.toy_ball ?? 0} owned`)}</small>}
          {record && <small>{L(`完成 ${record.completed} 局 · 最佳${game.id === 'matching' ? '步数' : game.id === 'catch' ? '连击' : '泡泡数'} ${record.best}`, `${record.completed} completed · Best ${record.best}`)}</small>}
          {unlocked ? <button className="activity-primary" disabled={!available || Boolean(active)} onClick={() => { const id = crypto.randomUUID(); update((current) => startMiniGame(current, game.id, mode, actorId, id, Date.now())); }}>{L('一起玩', 'Let’s play')}</button>
            : game.id === 'catch' ? <button className="activity-secondary" onClick={onShop}>{L('去买玩具球', 'Get a toy ball')}</button>
              : <button className="activity-secondary" disabled={pet.coins < 30} onClick={() => update(buyBubbleWand)}>{L('泡泡棒 · 30 金币，永久使用', 'Bubble wand · 30 coins, yours forever')}</button>}
        </article>;
      })}</div><div className="play-collection"><h3>{L('换一点小风景', 'A change of scenery')}</h3><div className="activity-choice">{(['garden', 'fruit', 'night'] as const).map((style, index) => <button key={style} aria-pressed={pet.miniGames.style === style} disabled={total < [0, 3, 10][index]} onClick={() => update((current) => ({ ...current, miniGames: { ...current.miniGames, style } }))}>{['🌿', '🍎', '🌙'][index]} {L(['小花园', '水果篮', '星空'][index], ['Garden', 'Fruit basket', 'Starry sky'][index])}{total < [0, 3, 10][index] && ` · ${total}/${[0, 3, 10][index]}`}</button>)}</div><button className="activity-link" disabled={!available || Boolean(active)} onClick={onQuickPlay}>{L('只想简单陪玩一下', 'Just a little quick play')}</button></div>{result && <section className="play-result" aria-live="polite"><img src={happyPortrait} alt="" /><div><small>{L('上次的开心时光', 'OUR LAST HAPPY MOMENT')}</small><h3>{gameName(result.game)}</h3><p className="activity-heart">♥ +{result.hearts}</p><p>{L('已经收好啦，下次还一起玩。', 'All saved. Let’s play again sometime.')}</p></div></section>}</> : <CompanionMemories pet={pet} actorId={actorId} />}
    </>}</div>
  </DialogShell>;
};
