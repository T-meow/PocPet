import { useEffect, useState, type CSSProperties } from 'react';
import type { MiniGameSession } from '../../core/companionActivityTypes';
import { activityText as L } from '../../core/kitchenRecipes';
import { bubbleHoldMs, bubbleSessionMs, canFinishMiniGame, type MiniGameAction } from '../../core/miniGames';
import { CatchBoard } from './CatchBoard';
import type { MiniGameFeedback } from './miniGameFeedback';

export const MiniGameBoard = ({ session, portrait, ballImage, style, feedback, onAct }: { session: MiniGameSession; portrait: string; ballImage: string; style: string; feedback?: MiniGameFeedback; onAct: (action: MiniGameAction) => void }) => {
  const [now, setNow] = useState(Date.now());
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (session.game === 'matching') return;
    const timer = window.setInterval(() => setNow(Date.now()), 32);
    return () => window.clearInterval(timer);
  }, [session.game]);
  useEffect(() => {
    if (session.game !== 'matching' || session.flipped.length !== 2) return;
    const timer = window.setTimeout(() => onAct({ type: 'clear' }), 800);
    return () => window.clearTimeout(timer);
  }, [session.id, session.flipped.join(',')]);
  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(false), 2500);
    return () => window.clearTimeout(timer);
  }, [hint]);
  useEffect(() => {
    if (!session.blowingAt) return;
    const timer = window.setTimeout(() => onAct({ type: 'release' }), Math.max(0, session.blowingAt + bubbleHoldMs - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session.blowingAt]);
  const faces = style === 'fruit' ? ['🍎', '🍌', '🍊', '🍉', '🥕', '🥚'] : style === 'night' ? ['⭐', '🌙', '☁️', '🪐', '☄️', '✨'] : ['🌻', '🌷', '🍀', '🍄', '🌿', '🦋'];
  if (session.game === 'matching') return <div className={`matching-board play-theme--${style}`}><div className="game-companion"><img src={portrait} alt="" /><p>{L('慢慢翻，我们一起记。', 'Take your time. We’ll remember together.')}<small>{L(`已找到 ${session.matched.length / 2}/6 对 · ${session.moves} 次翻牌`, `${session.matched.length / 2}/6 pairs · ${session.moves} moves`)}</small></p></div><div className="matching-grid">{session.deck.map((face, index) => {
    const matched = session.matched.includes(index);
    const shown = matched || session.flipped.includes(index) || hint;
    return <button key={index} className={`matching-card${shown ? ' revealed' : ''}${matched ? ' matched' : ''}`} disabled={matched || session.flipped.length === 2 || session.flipped.includes(index)} onClick={() => onAct({ type: 'flip', index })} aria-label={L(`第 ${index + 1} 张${shown ? `：${faces[face]}` : '，未翻开'}`, `Card ${index + 1}${shown ? `: ${faces[face]}` : ', face down'}`)}><span key={shown ? 'face' : 'back'} className="matching-card-face">{shown ? faces[face] : '✿'}</span>{matched && <span className="matching-spark" aria-hidden="true">✦</span>}</button>;
  })}</div>{session.mode === 'gentle' && <button className="activity-secondary" onClick={() => setHint(true)}>{L('一起看一眼牌面', 'A little peek together')}</button>}</div>;
  if (session.game === 'catch') return <CatchBoard session={session} portrait={portrait} ballImage={ballImage} now={now} feedback={feedback} onAct={onAct} />;
  const held = session.blowingAt ? Math.min(bubbleHoldMs, Math.max(0, now - session.blowingAt)) / 1000 : 0;
  const seconds = bubbleSessionMs / 1000;
  return <div className="bubbles-board">
    <div className="game-companion"><img src={portrait} alt="" /><p>{L('轻轻一吹，啪！又一颗小开心。', 'A little puff, a little pop, a little joy.')}<small>{L(`吹出 ${session.bubbles.length}/3 个 · 互动 ${Math.min(seconds, Math.floor(Math.min(session.participationMs, session.elapsedMs) / 1000))}/${seconds} 秒`, `${session.bubbles.length}/3 bubbles · ${Math.min(seconds, Math.floor(Math.min(session.participationMs, session.elapsedMs) / 1000))}/${seconds} seconds together`)}</small></p></div>
    <div className="bubble-field">
      {session.bubbles.map((bubble) => <button key={bubble.id} className={`play-bubble bubble-${bubble.shape}${bubble.popped ? ' popped' : ''}`} disabled={bubble.popped} aria-hidden={bubble.popped || undefined} style={{ left: `${8 + bubble.id * 23 % 68}%`, top: `${8 + bubble.id * 37 % 57}%`, width: 42 + Math.min(1.5, bubble.size) * 24, height: 42 + Math.min(1.5, bubble.size) * 24, '--bubble-delay': `${bubble.id % 4 * -0.7}s` } as CSSProperties} aria-label={L('戳破泡泡', 'Pop a bubble')} onClick={() => onAct({ type: 'pop', index: bubble.id })}>{bubble.shape === 'heart' ? '♡' : bubble.shape === 'star' ? '☆' : ''}</button>)}
      {held > 0 && <span className="growing-bubble" style={{ width: 30 + held * 40, height: 30 + held * 40 }} />}
      {!session.bubbles.length && !held && <p>{L('圆圆的、星星的，或是一颗小心心。', 'A little circle, a star, or a heart.')}</p>}
    </div>
    <button className="activity-primary bubble-blow" onPointerDown={(event) => { if (!event.isPrimary) return; event.currentTarget.setPointerCapture(event.pointerId); onAct({ type: 'blow' }); }} onPointerUp={() => onAct({ type: 'release' })} onPointerCancel={() => onAct({ type: 'release' })} onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); onAct({ type: 'blow' }); } }} onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onAct({ type: 'release' }); } }}>{held > 0 ? L('松开，让泡泡飘起来', 'Release to let it float') : L('按住吹泡泡', 'Hold to blow a bubble')}</button>
    <button className="activity-secondary" disabled={!canFinishMiniGame(session)} onClick={() => onAct({ type: 'finish' })}>{L('收下这段开心时光', 'Keep this happy moment')}</button>
    <small className="activity-muted">{L('最多按住 1.5 秒就会飘出泡泡；吹 3 个并互动 6 秒即可收获。', 'Bubbles float free within 1.5 seconds. Make three and play for six seconds to finish.')}</small>
  </div>;
};
