import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameProps } from '../types';
import { GameHeader, Stat, Tool } from '../shared/ui';
import { puzzles } from './levels';
import { revealColor } from './art';
import { analyze, clues, countSolutions, createNonogram, getPuzzle, logicalSolve, nonogramSolved, runs, solution, type Mark, type NonogramState, type PaintTool } from './rules';

export function NonogramGame({ state, onChange, active, paused, feedback, complete }: GameProps<'nonogram'>) {
  const latest = useRef(state); latest.current = state;
  const root = useRef<HTMLDivElement>(null);
  const stroke = useRef<{ value: Mark; seen: Set<number>; before: Mark[]; committed: boolean } | null>(null);
  const [message, setMessage] = useState('数字表示连续涂色的格数；两段之间至少留一格。');
  const [hint, setHint] = useState<number | null>(null);
  const [conflict, setConflict] = useState<{ axis: string; line: number } | null>(null);
  const puzzle = getPuzzle(state.puzzleId), numbers = clues(puzzle), solved = nonogramSolved(state), list = puzzles.filter(p => p.size === puzzle.size), index = list.findIndex(p => p.id === puzzle.id);
  const enabled = active && !paused && !solved;
  const commit = (next: NonogramState) => { latest.current = next; onChange(next); };
  useEffect(() => {
    if (solved) {
      complete({ game: 'nonogram', sessionId: state.id, outcome: 'complete', score: solution(puzzle).filter(Boolean).length });
      if (!state.solvedIds.includes(puzzle.id)) { onChange({ ...state, solvedIds: [...state.solvedIds, puzzle.id] }); feedback(`原来是一幅「${puzzle.name}」！这是我们一起想出来的。`, 'win'); }
    }
  }, [solved, state.id, puzzle.id, complete]);
  useEffect(() => { stroke.current = null; setHint(null); setConflict(null); }, [active, paused, state.id]);
  function paint(i: number, first: boolean, alternate = false) {
    if (!enabled) return;
    const current = latest.current;
    if (first) {
      const tool = alternate ? 'empty' : current.tool, desired: Mark = tool === 'fill' ? 1 : tool === 'empty' ? 0 : -1;
      stroke.current = { value: current.marks[i] === desired ? -1 : desired, seen: new Set(), before: current.marks.slice(), committed: false };
    }
    const held = stroke.current; if (!held || held.seen.has(i)) return;
    held.seen.add(i); if (current.marks[i] === held.value) return;
    const marks = current.marks.slice(); marks[i] = held.value;
    const firstChange = !held.committed; held.committed = true;
    commit({ ...current, marks, history: firstChange ? [...current.history, held.before].slice(-50) : current.history, moves: current.moves + Number(firstChange) });
    setHint(null); setConflict(null);
  }
  const paintRef = useRef(paint); paintRef.current = paint;
  useEffect(() => {
    if (!active || paused) return;
    const move = (event: PointerEvent) => {
      if (!stroke.current) return;
      event.preventDefault();
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-nonogram-cell]');
      if (cell && root.current?.contains(cell)) paintRef.current(Number(cell.dataset.nonogramCell), false);
    };
    const finish = () => { stroke.current = null; };
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', finish);
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', finish); stroke.current = null; };
  }, [active, paused]);
  function changePuzzle(id: string) { stroke.current = null; commit(createNonogram(id, state.solvedIds)); setHint(null); setConflict(null); setMessage('数字表示连续涂色的格数；两段之间至少留一格。'); }
  function giveHint() {
    const result = analyze(puzzle, state.marks);
    if (result.conflict) { setConflict(result.conflict); setHint(null); setMessage(`第 ${result.conflict.line + 1} ${result.conflict.axis === 'row' ? '行' : '列'}的标记和数字有矛盾，先检查一下填色与叉号。`); return; }
    const continuation = logicalSolve(puzzle, state.marks);
    if (continuation.source) {
      setConflict(continuation.source); setHint(null);
      setMessage(`沿已有标记继续推理，第 ${continuation.source.line + 1} ${continuation.source.axis === 'row' ? '行' : '列'}会出现矛盾。先核对与它相连的填色和叉号，也可以撤回几笔。`); return;
    }
    if (!continuation.complete) {
      const possible = countSolutions(puzzle, state.marks, 1);
      if (possible.exhausted && possible.count === 0) { setHint(null); setMessage('已有标记不能同时满足所有行列。先检查填色与叉号所在的行列，也可以撤回几笔。'); return; }
    }
    const d = result.deductions[0];
    if (d) { setHint(d.index); setConflict(null); setMessage(`第 ${d.line + 1} ${d.axis === 'row' ? '行' : '列'}的数字是 ${d.groups.join('、') || '0'}：所有符合标记的摆法都${d.mark ? '覆盖' : '避开'}亮起的这格，因此可以${d.mark ? '填色' : '标空'}。`); }
    else { const check = countSolutions(puzzle, state.marks, 1); setMessage(check.exhausted && check.count === 0 ? '目前标记不能组成完整答案，可以撤回几步重新核对行列。' : '先把确定的空格标上叉号，再检查相邻行列。'); }
  }
  return <div ref={root}><GameHeader icon="grid" title="一格一格，画出小惊喜" subtitle="跟着数字推理，最后再揭晓图案。"/>
    <div className="water-config"><div className="difficulty" role="group" aria-label="数织尺寸">{([5, 10] as const).map(size => <button key={size} type="button" className={puzzle.size === size ? 'active' : ''} aria-pressed={puzzle.size === size} onClick={() => { if (puzzle.size !== size) changePuzzle(puzzles.find(p => p.size === size)!.id); }}>{size} × {size}</button>)}</div><label className="puzzle-picker">选择图案 <select aria-label="选择数织关卡" value={puzzle.id} onChange={event => changePuzzle(event.target.value)}>{list.map((p, i) => <option key={p.id} value={p.id}>第 {i + 1} 张{state.solvedIds.includes(p.id) ? ` · ${p.name} ✓` : ' · 待揭晓'}</option>)}</select></label></div>
    <div className="score-strip"><Stat label="已经涂色" value={state.marks.filter(n => n === 1).length} unit={`/ ${solution(puzzle).filter(Boolean).length} 格`}/><Stat label="收藏图案" value={state.solvedIds.length} unit="/ 12" secondary/></div>
    <div className="nonogram-table"><div className="paint-tools" role="group" aria-label="数织画笔">{([['fill', '■', '填色'], ['empty', '×', '标空'], ['erase', '□', '擦除']] as const).map(([tool, icon, text]) => <button key={tool} type="button" className={state.tool === tool ? 'selected' : ''} aria-pressed={state.tool === tool} onClick={() => commit({ ...state, tool: tool as PaintTool })}><span>{icon}</span>{text}</button>)}</div>
      <div className={`nonogram-puzzle size-${puzzle.size}${solved ? ' solved' : ''}`} style={{ '--puzzle-color': puzzle.color } as CSSProperties}>
        <div className="nonogram-corner"><span>{puzzle.size}×{puzzle.size}</span></div>
        <div className="column-clues">{numbers.cols.map((groups, c) => <div key={c} className={`clue${JSON.stringify(runs(Array.from({ length: puzzle.size }, (_, r) => state.marks[r * puzzle.size + c]))) === JSON.stringify(groups) ? ' satisfied' : ''}${conflict?.axis === 'col' && conflict.line === c ? ' conflict' : ''}`} aria-label={`第 ${c + 1} 列：${groups.join('、') || '0'}`}>{(groups.length ? groups : [0]).map((n, i) => <span key={i}>{n}</span>)}</div>)}</div>
        <div className="row-clues">{numbers.rows.map((groups, r) => <div key={r} className={`clue${JSON.stringify(runs(state.marks.slice(r * puzzle.size, (r + 1) * puzzle.size))) === JSON.stringify(groups) ? ' satisfied' : ''}${conflict?.axis === 'row' && conflict.line === r ? ' conflict' : ''}`} aria-label={`第 ${r + 1} 行：${groups.join('、') || '0'}`}>{(groups.length ? groups : [0]).map((n, i) => <span key={i}>{n}</span>)}</div>)}</div>
        <div className="nonogram-cells" role="group" aria-label={`${puzzle.size} 行 ${puzzle.size} 列数织`} onContextMenu={event => event.preventDefault()}><div className="nonogram-grid">{state.marks.map((mark, i) => <button key={i} type="button" data-nonogram-cell={i} className={`nonogram-cell${mark === 1 ? ' painted' : ''}${mark === 0 && !solved ? ' crossed' : ''}${hint === i ? ' hinted' : ''}${i % puzzle.size === 4 ? ' divider-right' : ''}${Math.floor(i / puzzle.size) === 4 ? ' divider-bottom' : ''}`} style={{ width: `${100 / puzzle.size}%`, height: `${100 / puzzle.size}%`, ...(solved && mark === 1 ? { backgroundColor: revealColor(puzzle, i), borderColor: revealColor(puzzle, i) } : {}) }} aria-label={`第 ${Math.floor(i / puzzle.size) + 1} 行，第 ${i % puzzle.size + 1} 列，${mark === 1 ? '已填色' : mark === 0 ? '已标空' : '未标记'}`} tabIndex={i === 0 ? 0 : -1} onPointerDown={event => { if (!event.isPrimary || (event.button !== 0 && event.button !== 2)) return; event.preventDefault(); paint(i, true, event.button === 2); }} onClick={event => { if (event.detail === 0) { paint(i, true); stroke.current = null; } }} onKeyDown={event => { const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.size, ArrowDown: puzzle.size } as Record<string, number>)[event.key]; if (delta) { event.preventDefault(); root.current?.querySelector<HTMLElement>(`[data-nonogram-cell="${Math.max(0, Math.min(state.marks.length - 1, i + delta))}"]`)?.focus(); } }}>{mark === 0 && !solved ? '×' : ''}</button>)}</div>
      </div></div>
      <p className="nonogram-message" aria-live="polite">{message}</p>
      {solved && <div className="nonogram-reveal"><span>✧ 图案揭晓 ✧</span><h3>{puzzle.name}</h3><p>这是我们一起推理出来的小惊喜。</p><Tool icon="arrow" primary testId="nonogram-next" onClick={() => changePuzzle(list[(index + 1) % list.length].id)}>下一张图案</Tool></div>}
    </div><div className="game-tools"><Tool icon="undo" testId="nonogram-undo" disabled={!state.history.length} onClick={() => { stroke.current = null; const marks = state.history[state.history.length - 1]; if (!marks) return; commit({ ...state, marks, history: state.history.slice(0, -1), moves: Math.max(0, state.moves - 1) }); setHint(null); setConflict(null); setMessage('退回刚才的一笔，慢慢核对。'); }}>撤回一笔</Tool><Tool icon="hint" testId="nonogram-hint" disabled={!enabled} onClick={giveHint}>给点提示</Tool><Tool icon="reset" testId="nonogram-restart" onClick={() => changePuzzle(puzzle.id)}>重新画</Tool></div>
    <details className="nonogram-example"><summary>第一次玩？看看「2 1」是什么意思</summary><p>「2 1」表示先连续涂 2 格，至少空 1 格，再涂 1 格。例如 <b>■■ × ■ ×</b>。位置需要同时符合横行和竖列的数字。叉号表示你已经确定这里是空格。</p></details>
  </div>;
}
