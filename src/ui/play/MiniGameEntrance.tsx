import { ArrowRight, BookOpen, Coffee, Heart } from 'lucide-react';
import { MiniGameEntryArt } from './MiniGameEntryArt';
import { abandonMiniGame, buyBubbleWand, gameName, getMiniGameBaseHearts, getMiniGameSkillCategory, isScoreMiniGame, miniGameDefinitions, miniGameScoreUnit, resumeMiniGame, startMiniGame } from '../../core/miniGames';
import { isHostedMiniGameSession, type MiniGameId, type PlayMode } from '../../core/companionActivityTypes';
import { formatPracticeSkillXp, partnerScheduleMaxSkillLevel } from '../../core/partnerSchedule';
import { playSfx } from '../../core/audio';
import { isHubGameId } from '../../minigames/catalog';
import { sessionId } from '../../minigames/shared/state';
import { activityText as L } from '../../core/kitchenRecipes';
import type { PetState } from '../../core/petTypes';

const presentation: Record<MiniGameId, { category: string; description: string; detail: string }> = {
  blocks: { category: '动动脑', description: '转一转，摆一摆，让每一块都刚刚好。', detail: '不计时 · 随时按分数结算' },
  water: { category: '理一理', description: '把同色果汁放一起，整理一小份好心情。', detail: '三个难度 · 通关收获心心' },
  fruit: { category: '碰一碰', description: '小水果碰出大惊喜，今天能攒出西瓜吗？', detail: '经典合成 · 随时按分数结算' },
  match3: { category: '连一连', description: '交换花园的小图案，连成一串小开心。', detail: '每局 40 步 · 可提前结算' },
  matching: { category: '一起记', description: '翻开十二张小卡片，找到藏起来的好朋友。', detail: '六对图案 · 可选辅助与主题' },
  catch: { category: '陪伙伴', description: '向伙伴的方向轻轻一抛，接住一点点开心。', detail: '十次抛球 · 每局消耗 1 个球' },
  bubbles: { category: '放轻松', description: '吹一颗小泡泡，把烦恼也轻轻放走。', detail: '按住吹 · 轻点戳破' },
};

interface Props {
  pet: PetState;
  actorId: string;
  portrait: string;
  ballImage: string;
  mode: PlayMode;
  available: boolean;
  onShop: () => void;
  onQuickPlay: () => void;
  onMemories: () => void;
  update: (action: (pet: PetState) => PetState) => void;
}

export function MiniGameEntrance({ pet, actorId, portrait, ballImage, mode, available, onShop, onQuickPlay, onMemories, update }: Props) {
  const active = pet.miniGames.active;
  const hosted = active && isHostedMiniGameSession(active);
  const maySwitch = hosted && active.paused && active.actorId === actorId;
  const startDisabled = !available || Boolean(active && !maySwitch);
  const round = hosted ? pet.miniGames.hub?.games[active.game] : undefined;
  const progress = round ? 'moves' in round ? `${round.moves} 步` : `${round.score} 分` : undefined;

  return <>
    <section className="play-hub-intro">
      <div className="play-hub-intro-copy"><small>闲下来的一小会儿</small><h3>今天，想玩点什么？</h3><p>{L('开心就好，不用拿满分。', 'No perfect scores needed. Just us.')}</p><div className="play-hub-level"><span>Lv.{pet.level}</span>心心收益随等级一起成长</div></div>
      <div className="play-hub-portrait"><span aria-hidden="true">✧</span><img src={portrait} alt={pet.name} /><small>我都陪着你</small></div>
    </section>
    {!available && <p className="activity-info">伙伴正在休息或忙着别的事，等空闲再一起玩吧。</p>}
    {active && <section className="play-resume">
      <div className="play-resume-main"><span className="play-resume-art"><MiniGameEntryArt game={active.game} ballImage={ballImage} /></span><div className="play-resume-copy"><small>上次的小进度，还留在这里</small><strong>{gameName(active.game)}</strong><span>{progress && `${progress} · `}{L('已暂停', 'Paused')}</span></div><button className="play-resume-button" disabled={!available || active.actorId !== actorId} onClick={() => { if (hosted) playSfx('tap'); update(current => resumeMiniGame(current, actorId, Date.now())); }}>继续玩<ArrowRight size={15} /></button></div>
      {active.actorId !== actorId && <p>这是与另一位伙伴开始的一局，切回那位伙伴可以继续。</p>}
      <div className="play-resume-foot"><span>{maySwitch ? '换款游戏也没关系，各自的进度都会保留。' : '离开期间不计时，随时可以回来。'}</span><button onClick={() => { playSfx('tap'); update(abandonMiniGame); }}>{hosted ? '收好进度' : L('结束这一局', 'End this game')}</button></div>
    </section>}
    <div className="play-hub-section-heading"><h3>挑一个喜欢的</h3><span>7 款小游戏</span></div>
    <div className="play-entry-grid">{miniGameDefinitions.map(game => {
      const hubGame = isHubGameId(game.id), copy = presentation[game.id];
      const unlocked = hubGame || (game.id === 'catch' ? (pet.inventory.toy_ball ?? 0) > 0 : pet.miniGames.unlocked.includes(game.id));
      const gameMode = hubGame ? 'normal' : mode;
      const record = pet.miniGames.records[`${game.id}:${gameMode}`];
      const skill = getMiniGameSkillCategory(game.id);
      const bestLabel = game.id === 'water' || game.id === 'matching' ? '步' : game.id === 'catch' ? '连击' : game.id === 'bubbles' ? '个泡泡' : '分';
      return <div className="play-entry-wrap" key={game.id}><article className={`play-entry-card play-entry-card--${game.id}`} data-game-entry={game.id}>
        <div className="play-entry-art"><span>{copy.category}</span><MiniGameEntryArt game={game.id} ballImage={ballImage} /></div>
        <div className="play-entry-content"><h3>{gameName(game.id)}</h3><p>{copy.description}</p><div className="play-entry-detail">{copy.detail}</div>
          {skill && pet.partnerSchedule.skills[skill].level < partnerScheduleMaxSkillLevel && <small className="play-entry-skill">{formatPracticeSkillXp(skill)}</small>}
          {game.id === 'catch' && <small className="play-entry-skill">持有 {pet.inventory.toy_ball ?? 0} 个玩具球</small>}
          <div className="play-entry-reward"><Heart size={13} /><span>{isScoreMiniGame(game.id) ? `每 ${miniGameScoreUnit} 分 ${getMiniGameBaseHearts(pet.level, game.id)} 心` : L(`至少 ${getMiniGameBaseHearts(pet.level, game.id)} 心`, `At least ${getMiniGameBaseHearts(pet.level, game.id)} hearts`)}</span></div>
          <small className="play-entry-record">{record ? `最佳 ${record.best} ${bestLabel} · 完成 ${record.completed} 局` : '等我们留下第一份小纪录'}</small>
          {unlocked ? <button className="play-entry-button" disabled={startDisabled} onClick={() => {
            if (hubGame) playSfx('tap');
            const id = sessionId(); update(current => startMiniGame(current, game.id, gameMode, actorId, id, Date.now()));
          }}>{maySwitch && active.game === game.id ? '继续玩' : L('一起玩', 'Let’s play')}<ArrowRight size={14} /></button>
            : game.id === 'catch' ? <button className="play-entry-button" onClick={onShop}>{L('去买玩具球', 'Get a toy ball')}<ArrowRight size={14} /></button>
              : <button className="play-entry-button" disabled={pet.coins < 30} onClick={() => { playSfx('tap'); update(buyBubbleWand); }}>解锁泡泡棒 · 30 金币</button>}
        </div>
      </article></div>;
    })}</div>
    <div className="play-hub-extra-links"><button onClick={() => { playSfx('tap'); onMemories(); }}><BookOpen size={22} /><span><strong>{L('共同回忆', 'Memories')}</strong><small>收藏我们的小日常</small></span><ArrowRight size={15} /></button><button disabled={!available || Boolean(active)} onClick={onQuickPlay}><Coffee size={22} /><span><strong>简单陪玩一下</strong><small>就这样，待一小会儿</small></span><ArrowRight size={15} /></button></div>
    <p className="play-hub-footer"><Heart size={13} />小小的快乐，也值得认真收藏。</p>
  </>;
}
