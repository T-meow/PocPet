import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameProps } from '../types';
import { GameHeader, Stat, Tool } from '../shared/ui';
import { bottleDone, createWater, flavors, poured, pourAmount, solveWater, waterSolved } from './rules';
const bottlePath = 'M29 10 L65 10 L65 28 Q65 34 72 40 Q82 49 82 62 L82 141 Q82 157 66 157 L28 157 Q12 157 12 141 L12 62 Q12 49 22 40 Q29 34 29 28 Z';
function BottleArt({ bottle }: { bottle: number[] }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 94 172" aria-hidden="true"><defs><clipPath id={id}><path d={bottlePath}/></clipPath></defs><ellipse cx="47" cy="160" rx="29" ry="4" fill="#897956" opacity=".12"/><path d={bottlePath} fill="#fffcf0" fillOpacity=".66"/><g clipPath={`url(#${id})`}>{bottle.map((color, n) => { const f = flavors[color], y = 151 - (n + 1) * 27; return <g key={n}><rect x="15" y={y} width="64" height="28" fill={f.fill}/><path d={`M16 ${y + 2} Q47 ${y - 1} 78 ${y + 2}`} stroke="#fff" strokeOpacity=".28" fill="none"/><text x="48" y={y + 18} fill={f.edge} textAnchor="middle" fontSize="13" opacity=".75">{f.mark}</text></g>; })}</g><path className="glass-outline" d={bottlePath} fill="none" stroke="#a2967d" strokeWidth="2.5" strokeLinejoin="round"/><path d="M22 67v62q0 8 4 10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".65"/><path d="M72 69v18" fill="none" stroke="#fff" strokeWidth="2" opacity=".55"/><rect x="25" y="7" width="44" height="8" rx="4" fill="#faf7ea" stroke="#a2967d" strokeWidth="2"/><path d="M31 10h29" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>{bottleDone(bottle) && <path d="m37 30 7 7 13-14" fill="none" stroke="#839b6e" strokeWidth="3" strokeLinecap="round"/>}</svg>;
}
interface PourVisual { from: number; before: number[][]; path: string; width: number; height: number; color: string; }
export function WaterGame({ state, onChange, active, paused, feedback, complete }: GameProps<'water'>) {
  const [message, setMessage] = useState('选一瓶，再点空瓶或顶部同色的瓶子。');
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [visual, setVisual] = useState<PourVisual | null>(null);
  const table = useRef<HTMLDivElement>(null);
  const solved = waterSolved(state.bottles), enabled = active && !paused && !visual;
  useEffect(() => { if (!active || paused) { setVisual(null); setHint(null); } }, [active, paused]);
  useEffect(() => { if (!visual) return; const timer = window.setTimeout(() => setVisual(null), 460); return () => window.clearTimeout(timer); }, [visual]);
  useEffect(() => { if (solved) complete({ game: 'water', sessionId: state.id, outcome: 'complete', score: state.moves }); }, [solved, state.id, state.moves, complete]);
  function clickBottle(i: number) {
    if (!enabled || solved) return;
    setHint(null);
    if (state.selected === i) { onChange({ ...state, selected: -1 }); setMessage('选一瓶，再点空瓶或顶部同色的瓶子。'); return; }
    if (state.selected < 0) { if (!state.bottles[i].length) { setMessage('先选一瓶有颜色的果汁。'); return; } onChange({ ...state, selected: i }); setMessage(`选好第 ${i + 1} 瓶啦，再选一个去处。`); return; }
    const from = state.selected, amount = pourAmount(state.bottles, from, i);
    if (!amount) { setMessage(state.bottles[i].length === 4 ? '这瓶已经满啦。点已选瓶子可以取消选择。' : '只能倒到空瓶或顶部同色的瓶子。'); return; }
    const rect = table.current!.getBoundingClientRect(), a = table.current!.querySelector(`[data-bottle="${from}"]`)!.getBoundingClientRect(), b = table.current!.querySelector(`[data-bottle="${i}"]`)!.getBoundingClientRect();
    const ax = a.left + a.width * .64 - rect.left, ay = a.top + 11 - rect.top, bx = b.left + b.width / 2 - rect.left, by = b.top + 18 - rect.top;
    setVisual({ from, before: state.bottles, path: `M${ax} ${ay} Q${(ax + bx) / 2} ${Math.min(ay, by) - 38} ${bx} ${by}`, width: rect.width, height: rect.height, color: flavors[state.bottles[from][state.bottles[from].length - 1]].fill });
    const bottles = poured(state.bottles, from, i);
    onChange({ ...state, bottles, selected: -1, moves: state.moves + 1, history: [...state.history, { bottles: state.bottles, moves: state.moves }].slice(-100) });
    setMessage(bottleDone(bottles[i]) ? '又整理好一瓶啦！' : '接下来，哪两瓶颜色能靠在一起呢？');
    feedback(waterSolved(bottles) ? '每一瓶都整整齐齐的，好有成就感！' : '轻轻倒过去，让同一种颜色待在一起。', waterSolved(bottles) ? 'win' : 'pour');
  }
  function restart(difficulty = state.difficulty, level = state.level) { setVisual(null); setHint(null); onChange(createWater(difficulty, level)); setMessage('选一瓶，再点空瓶或顶部同色的瓶子。'); }
  const bottles = visual?.before || state.bottles, split = Math.ceil(bottles.length / 2);
  return <div><GameHeader icon="bottle" title="把颜色，慢慢理好" subtitle="同色倒在一起，每瓶只留一种颜色。"/>
    <div className="water-config"><div className="difficulty" role="group" aria-label="彩瓶难度">{['轻松', '适中', '挑战'].map((name, i) => <button type="button" key={name} className={state.difficulty === i ? 'active' : ''} aria-pressed={state.difficulty === i} onClick={() => { if (i !== state.difficulty) restart(i, 0); }}>{name}</button>)}</div><span className="level-name">第 {state.level + 1} 关 · {state.difficulty + 3} 种颜色</span></div>
    <div className="score-strip"><Stat label="已经整理好" value={state.bottles.filter(bottleDone).length} unit={`/ ${state.difficulty + 3} 瓶`}/><Stat label="轻轻倒了" value={state.moves} unit="步" secondary/></div>
    <div className="water-table" ref={table}><div role="group" aria-label="果汁彩瓶">{[bottles.slice(0, split), bottles.slice(split)].map((row, r) => <div className="bottle-row" key={r}>{row.map((bottle, c) => { const i = r === 0 ? c : c + split; return <button key={i} type="button" data-bottle={i} className={`bottle${state.selected === i ? ' selected' : ''}${bottleDone(bottle) ? ' complete' : ''}${hint?.[0] === i ? ' hint-source' : ''}${hint?.[1] === i ? ' hint-target' : ''}${visual?.from === i ? ' pouring' : ''}`} aria-pressed={state.selected === i} aria-label={`第 ${i + 1} 瓶，${bottle.length ? `自下而上：${bottle.map(n => flavors[n].name).join('、')}` : '空瓶'}`} onClick={() => clickBottle(i)}><BottleArt bottle={bottle}/><span className="bottle-label">{bottleDone(bottle) ? '✓' : hint?.[0] === i ? '从这里' : hint?.[1] === i ? '倒这里' : i + 1}</span></button>; })}</div>)}</div>
      {visual && <svg className="pour-overlay" viewBox={`0 0 ${visual.width} ${visual.height}`} aria-hidden="true"><path className="pour-path" d={visual.path} stroke={visual.color} strokeWidth="7"/></svg>}
      <p className="water-message" aria-live="polite">{message}</p><div className="flavor-legend">{flavors.slice(0, state.difficulty + 3).map(f => <span className="flavor" key={f.name}><i className="flavor-dot" style={{ '--flavor': f.fill } as CSSProperties}/>{f.mark} {f.name}</span>)}</div>
      {solved && !visual && <div className="water-win"><div className="win-card"><div className="win-stars">✦ ✧ ✦</div><h3>都找到自己的颜色啦</h3><p>一起倒了 {state.moves} 步。整整齐齐，心情也亮了。</p><Tool icon="arrow" primary testId="water-next" onClick={() => restart(state.difficulty, state.level + 1)}>再整理一组</Tool></div></div>}
    </div><div className="game-tools"><Tool icon="undo" testId="water-undo" disabled={!state.history.length} onClick={() => { const p = state.history[state.history.length - 1]; if (!p) return; setVisual(null); setHint(null); onChange({ ...state, ...p, selected: -1, history: state.history.slice(0, -1) }); setMessage('回到刚才，试试另一种顺序。'); }}>撤回一步</Tool><Tool icon="hint" testId="water-hint" disabled={!enabled || solved} onClick={() => { const result = solveWater(state.bottles); if (result.path?.length) { setHint(result.path[0]); onChange({ ...state, selected: result.path[0][0] }); setMessage(`把第 ${result.path[0][0] + 1} 瓶，倒进第 ${result.path[0][1] + 1} 瓶试试。`); } else setMessage(result.cutoff ? '这一步有点绕，可以先撤回一步再想。' : '这条路走不通啦，可以撤回几步试试。'); }}>给点提示</Tool><Tool icon="reset" testId="water-restart" onClick={() => restart()}>重新整理</Tool></div>
  </div>;
}
