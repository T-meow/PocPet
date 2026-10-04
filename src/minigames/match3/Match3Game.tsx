import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameProps } from '../types';
import { GameHeader, Stat, Tool } from '../shared/ui';
import { match3Art } from './art';
import { adjacent, createMatch3, MATCH3_SIZE, possibleMoves, swapMatch3, type Match3Frame, type Match3State } from './rules';
import './match3.css';

interface Animation { token: number; index: number; frames: Match3Frame[]; message: string; previousBest: number; }
interface Gesture { pointer: number; from: number; x: number; y: number; to: number; moved: boolean; }

export function Match3Game({ state, onChange, active, paused, feedback, complete }: GameProps<'match3'>) {
  const latest = useRef(state); latest.current = state;
  const board = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null);
  const sequence = useRef(0), suppressClick = useRef(0);
  const [visual, setVisual] = useState<Animation | null>(null), visualRef = useRef(visual);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [dragTarget, setDragTarget] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState('交换相邻的两个图案，横着或竖着凑齐三个。');
  const feedbackRef = useRef(feedback); feedbackRef.current = feedback;
  const enabled = active && !paused && !visual && state.movesLeft > 0;
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const frame = visual?.frames[visual.index];
  const grid = frame?.grid || state.grid;
  const ended = state.movesLeft === 0 && !visual;
  function animate(next: Animation | null) { visualRef.current = next; setVisual(next); }
  function commit(next: Match3State) { latest.current = next; onChange(next); }

  useEffect(() => {
    if (!active || paused) {
      if (visual) { setMessage(visual.message); animate(null); }
      gesture.current = null; setDragTarget(null); setHint(null); return;
    }
    if (!visual) return;
    const current = visual.frames[visual.index];
    if (current.kind === 'clear') feedbackRef.current(current.combo > 1 ? `${current.combo} 连锁！小花园一下子热闹起来了。` : '凑在一起啦，看看还会落下什么。', 'clear');
    const timer = window.setTimeout(() => {
      if (visualRef.current?.token !== visual.token || visualRef.current.index !== visual.index) return;
      if (visual.index + 1 < visual.frames.length) animate({ ...visual, index: visual.index + 1 });
      else { animate(null); setMessage(visual.message); }
    }, current.duration);
    return () => window.clearTimeout(timer);
  }, [visual, active, paused]);
  useEffect(() => {
    if (ended) complete({ game: 'match3', sessionId: state.id, outcome: 'complete', score: state.score });
  }, [ended, state.id, state.score, complete]);

  function exchange(from: number, to: number) {
    if (!enabledRef.current || visualRef.current) return;
    const before = latest.current, result = swapMatch3(before, from, to); if (!result) return;
    setHint(null); setDragTarget(null);
    const note = !result.valid ? '这两个换完还凑不齐三个，已经换回来了，不扣步数。'
      : result.shuffled ? `这一手 +${result.gain} 分。没有可消组合了，已重新排好，不扣额外步数。`
      : result.combo > 1 ? `${result.combo} 连锁！这一手收获了 ${result.gain} 分。`
      : `消掉啦，+${result.gain} 分。慢慢看看下一步。`;
    animate({ token: ++sequence.current, index: 0, frames: result.frames, message: note, previousBest: before.best });
    setMessage(result.valid ? '接上啦，看看会不会再来一次连锁……' : '这两个还连不起来，换个方向试试。');
    commit(result.state);
  }
  function choose(index: number) {
    if (!enabledRef.current || visualRef.current) return;
    const current = latest.current;
    if (current.selected >= 0 && adjacent(current.selected, index)) { exchange(current.selected, index); return; }
    const selected = current.selected === index ? -1 : index;
    commit({ ...current, selected }); setHint(null);
    setMessage(selected < 0 ? '交换相邻的两个图案，横着或竖着凑齐三个。' : `选好${match3Art[current.grid[index]].name}啦，再点上下左右的一格交换。`);
  }
  const actions = useRef({ exchange }); actions.current = { exchange };
  useEffect(() => {
    if (!active || paused) return;
    const track = (event: PointerEvent) => {
      const held = gesture.current; if (!held || held.pointer !== event.pointerId) return;
      const dx = event.clientX - held.x, dy = event.clientY - held.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      held.moved = true;
      const to = held.from + (Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dy > 0 ? MATCH3_SIZE : -MATCH3_SIZE));
      held.to = adjacent(held.from, to) ? to : -1;
      setDragTarget(held.to >= 0 ? [held.from, held.to] : null);
      event.preventDefault();
    };
    const finish = (event: PointerEvent) => {
      const held = gesture.current; if (!held || held.pointer !== event.pointerId) return;
      gesture.current = null; setDragTarget(null);
      if (held.moved) { suppressClick.current = Date.now() + 400; if (held.to >= 0) actions.current.exchange(held.from, held.to); }
    };
    const cancel = () => { gesture.current = null; setDragTarget(null); };
    document.addEventListener('pointermove', track, { passive: false }); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
    return () => { document.removeEventListener('pointermove', track); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); gesture.current = null; };
  }, [active, paused]);
  function restart() {
    animate(null); gesture.current = null; setHint(null); setDragTarget(null);
    commit(createMatch3(latest.current.best)); setMessage('新的一盘，看看这次能接出几次连锁。');
  }

  return <div className="match3-game">
    <GameHeader icon="grid" title="小花园，消一消" subtitle="交换一下，三个相同就能消掉。" label="40 步 · 不计时"/>
    <div className="score-strip">
      <Stat label="这一盘的分数" value={frame?.score ?? state.score}/>
      <Stat label="最佳纪录" value={visual ? Math.max(visual.previousBest, frame?.score || 0) : state.best} secondary/>
      <Stat label="还可以交换" value={state.movesLeft} unit="步" secondary/>
    </div>
    <div className="match3-table">
      <div className="match3-board-wrap">
        <div className="match3-board">
          <div ref={board} className="match3-grid" role="group" aria-label="7 行 7 列三消棋盘" aria-busy={Boolean(visual)}>
            {grid.map((kind, index) => {
              const art = match3Art[kind], offset = frame?.offsets?.[index], clearing = frame?.cells?.includes(index);
              const selected = state.selected === index || dragTarget?.[0] === index;
              const suggested = hint?.includes(index) || dragTarget?.[1] === index;
              return <button key={index} type="button" data-match3-cell={index}
                className={`match3-cell${selected ? ' selected' : ''}${suggested ? ' hinted' : ''}${offset ? ' moving' : ''}`}
                style={{ width: `${100 / MATCH3_SIZE}%`, height: `${100 / MATCH3_SIZE}%`, left: `${index % MATCH3_SIZE * 100 / MATCH3_SIZE}%`, top: `${Math.floor(index / MATCH3_SIZE) * 100 / MATCH3_SIZE}%` }}
                aria-label={`第 ${Math.floor(index / MATCH3_SIZE) + 1} 行，第 ${index % MATCH3_SIZE + 1} 列，${art.name}`} aria-pressed={selected} aria-disabled={!enabled}
                tabIndex={index === (state.selected < 0 ? 0 : state.selected) ? 0 : -1}
                onClick={() => { if (Date.now() >= suppressClick.current) choose(index); }}
                onPointerDown={event => {
                  if (!enabled || !event.isPrimary || event.button !== 0) return;
                  gesture.current = { pointer: event.pointerId, from: index, x: event.clientX, y: event.clientY, to: -1, moved: false };
                  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onKeyDown={event => {
                  const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -MATCH3_SIZE, ArrowDown: MATCH3_SIZE } as Record<string, number>)[event.key];
                  if (delta) { event.preventDefault(); const next = index + delta; if (adjacent(index, next)) board.current?.querySelector<HTMLElement>(`[data-match3-cell="${next}"]`)?.focus(); }
                }}>
                <span key={`${visual?.token || 0}:${visual?.index || 0}`} className={`match3-token${offset ? ' arriving' : ''}${clearing ? ' clearing' : ''}${frame?.kind === 'shuffle' ? ' shuffled' : ''}`}
                  style={{ '--match3-x': `${(offset?.[1] || 0) * 100}%`, '--match3-y': `${(offset?.[0] || 0) * 100}%`, animationDuration: `${frame?.duration || 0}ms` } as CSSProperties}>
                  <span className="match3-face"><img src={art.image} alt="" draggable={false}/></span>
                </span>
              </button>;
            })}
          </div>
        </div>
        {frame?.kind === 'clear' && <div key={`${visual?.token}:${visual?.index}`} className="match3-points" aria-hidden="true"><span>{frame.combo > 1 ? `${frame.combo} 连锁` : '刚刚好'}</span><strong>+{frame.gain}</strong></div>}
        {ended && <div className="water-win match3-end"><div className="win-card">
          <div className="win-stars">✦ ✧ ✦</div><h3>收获一份小开心</h3>
          <div className="match3-final-score">{state.score}<small> 分</small></div>
          <p>这一盘消掉 {state.cleared} 个图案，<br/>最长接出了 {state.bestCombo} 次连锁。</p>
          <Tool icon="reset" primary testId="match3-replay" onClick={restart}>再来一盘</Tool>
        </div></div>}
      </div>
      <p className="match3-message" aria-live="polite">{message}</p>
      <div className="match3-collection"><span>最长连锁 <b>{state.bestCombo}</b> 次</span><span>消除 <b>{state.cleared}</b> 个</span></div>
    </div>
    <div className="game-tools">
      <Tool icon="hint" testId="match3-hint" disabled={!enabled} onClick={() => {
        const move = possibleMoves(latest.current.grid)[0]; if (!move) return;
        setHint([move.from, move.to]); commit({ ...latest.current, selected: -1 }); setMessage('试试交换亮起的这两个图案，提示不扣步数。');
      }}>给点提示</Tool>
      <Tool icon="reset" testId="match3-new" onClick={restart}>换一盘</Tool>
    </div>
    <p className="match3-caption">点两格交换，也可以轻轻滑动一格 · 无效交换不扣步数</p>
  </div>;
}
