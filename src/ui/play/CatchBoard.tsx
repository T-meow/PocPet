import { useRef, useState, type PointerEvent } from 'react';
import type { MiniGameSession } from '../../core/companionActivityTypes';
import { activityText as L } from '../../core/kitchenRecipes';
import { catchFlightMs, getCatchPetX, type MiniGameAction } from '../../core/miniGames';
import type { MiniGameFeedback } from './miniGameFeedback';

interface Point { x: number; y: number; }
export const getSwipeThrowTarget = (start: Point, end: Point) => {
  const upward = start.y - end.y;
  return upward < 0.06 ? undefined : Math.max(-0.2, Math.min(1.2, 0.5 + (end.x - start.x) / upward * 0.63));
};

export const CatchBoard = ({ session, portrait, ballImage, now, feedback, onAct }: {
  session: MiniGameSession; portrait: string; ballImage: string; now: number; feedback?: MiniGameFeedback; onAct: (action: MiniGameAction) => void;
}) => {
  const scene = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; start: Point }>();
  const [drag, setDrag] = useState<{ start: Point; end: Point }>();
  const [aim, setAim] = useState(0.5);
  const [hint, setHint] = useState(false);
  const point = (event: PointerEvent) => {
    const box = scene.current!.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
  };
  const progress = session.throwAt ? Math.min(1, Math.max(0, (now - session.throwAt) / catchFlightMs)) : 0;
  const petX = getCatchPetX(session, now);
  const target = drag ? getSwipeThrowTarget(drag.start, drag.end) ?? 0.5 : aim;
  return <div className="catch-board">
    <p className="game-progress">{L(`已抛 ${session.rounds} / 10 次 · 最佳连击 ${session.bestStreak}`, `${session.rounds} / 10 throws · Best streak ${session.bestStreak}`)}</p>
    <div className="catch-swipe-scene" ref={scene}>
      <div className="catch-moving-pet" style={{ left: `${petX * 100}%` }}>
        <span className="catch-receive-zone" />
        <img key={feedback?.event === 'catch' ? feedback.serial : 'pet'} className={feedback?.event === 'catch' ? 'catch-pet-cheer' : ''} src={portrait} alt="" draggable={false} />
      </div>
      {drag && <svg className="catch-aim-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={`M 50 87 Q 50 45 ${target * 100} 24`} /></svg>}
      {session.throwAt > 0 && <span className="catch-flying-ball" aria-hidden="true" style={{ left: `${50 + (session.throwTargetX - 0.5) * progress * 100}%`, top: `${87 - progress * 63 - Math.sin(progress * Math.PI) * 10}%`, transform: `translate(-50%, -50%) scale(${1 - progress * 0.5}) rotate(${progress * 270}deg)` }}><img src={ballImage} alt="" draggable={false} /></span>}
      <button
        className={`catch-swipe-ball${drag ? ' dragging' : ''}${session.throwAt ? ' in-flight' : ''}`}
        aria-disabled={Boolean(session.throwAt)}
        aria-label={L('向上滑动抛球；键盘方向键瞄准，空格抛球', 'Swipe up to throw; arrow keys aim, Space throws')}
        onPointerDown={(event) => {
          if (session.throwAt || pointer.current || !event.isPrimary) return;
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
          const start = point(event); pointer.current = { id: event.pointerId, start }; setDrag({ start, end: start }); setHint(false);
        }}
        onPointerMove={(event) => { if (pointer.current?.id === event.pointerId) setDrag({ start: pointer.current.start, end: point(event) }); }}
        onPointerUp={(event) => {
          if (pointer.current?.id !== event.pointerId) return;
          const targetX = getSwipeThrowTarget(pointer.current.start, point(event));
          pointer.current = undefined; setDrag(undefined);
          if (targetX === undefined) { setHint(true); return; }
          onAct({ type: 'throw', targetX });
        }}
        onPointerCancel={() => { pointer.current = undefined; setDrag(undefined); }}
        onLostPointerCapture={() => { pointer.current = undefined; setDrag(undefined); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault(); setAim((value) => Math.max(0, Math.min(1, value + (event.key === 'ArrowLeft' ? -0.08 : 0.08))));
          } else if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); if (!session.throwAt) onAct({ type: 'throw', targetX: aim }); }
        }}
      ><img src={ballImage} alt="" draggable={false} /><span aria-hidden="true">↑</span></button>
      {(feedback?.event === 'catch' || feedback?.event === 'miss') && <span key={feedback.serial} className={`catch-reaction catch-reaction--${feedback.event}`}>{feedback.event === 'catch' ? L('接住啦！', 'Got it!') : L('再来一球', 'One more!')}</span>}
    </div>
    <p className="catch-feedback" aria-live="polite">{hint ? L('按住球，向上滑一小段再松手', 'Hold the ball, swipe up a little, then release') : L('向伙伴的方向滑动，把球抛给它！', 'Swipe toward your companion and send the ball flying!')}</p>
    <small className="activity-muted">{L('一局消耗 1 个玩具球，共抛 10 次；没接住也有同样的心心。', 'One toy ball buys ten throws. Misses earn the same hearts.')}</small>
    <small className="catch-keyboard-help">{L(`键盘：← → 瞄准 ${Math.round(aim * 100)}% · 空格抛球`, `Keyboard: ← → aim ${Math.round(aim * 100)}% · Space to throw`)}</small>
  </div>;
};
