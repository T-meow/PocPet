import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../types';
import { GameHeader, Stat, Tool } from '../shared/ui';
import { blockHint, canPlace, createBlocks, isBlocked, pieceCells, placeBlock, shapes, type BlockPiece, type BlockState } from './rules';

export function BlockGame({ state, onChange, active, paused, feedback, complete }: GameProps<'blocks'>) {
  const latest = useRef(state); latest.current = state;
  const gridRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState('先选一块积木，再点空格放下。');
  const [visual, setVisual] = useState<{ grid: number[]; cleared: number[]; gain: number } | null>(null);
  const drag = useRef<{ index: number; x: number; y: number; moved: boolean; anchor: [number, number] | null } | null>(null);
  const suppress = useRef(0);
  const enabled = active && !paused && !visual;
  const commit = (next: BlockState) => { latest.current = next; onChange(next); };
  useEffect(() => { if (!active || paused) { setVisual(null); setAnchor(null); drag.current = null; } }, [active, paused]);
  useEffect(() => { if (!visual) return; const timer = window.setTimeout(() => setVisual(null), 330); return () => window.clearTimeout(timer); }, [visual]);
  const stuck = isBlocked(state);
  useEffect(() => { if (stuck) complete({ game: 'blocks', sessionId: state.id, outcome: 'over', score: state.score }); }, [stuck, state.id, state.score, complete]);
  function select(index: number) {
    if (!enabled || !latest.current.pieces[index]) return;
    commit({ ...latest.current, selected: index }); setAnchor(null);
    setMessage('点一个空格作为左上角，或旋转后再放。');
  }
  function rotate() {
    const current = latest.current, p = current.pieces[current.selected]; if (!enabled || !p) return;
    commit({ ...current, pieces: current.pieces.map((piece, i) => i === current.selected ? { ...p, rotation: (p.rotation + 1) % 4 } : piece) });
    setMessage('转一下，再找个合适的空位。');
  }
  function place(row: number, col: number) {
    if (!enabled) return;
    const current = latest.current;
    if (current.selected < 0) { setMessage('先点选下方的一块积木。'); return; }
    const result = placeBlock(current, row, col);
    if (!result) { setMessage('这里放不下，转一下或换个空位试试。'); return; }
    if (result.clear.count) {
      const grid = current.grid.slice(), color = current.pieces[current.selected]!.color;
      result.placed.forEach(i => { grid[i] = color; }); setVisual({ grid, cleared: result.clear.cells, gain: result.gain });
      setMessage(`刚刚好，消掉了 ${result.clear.count} 行 / 列！`); feedback('整整齐齐的，看着就很开心。', 'clear');
    } else { setMessage('放好啦，再挑一块喜欢的。'); feedback('慢慢摆，我陪着你。', 'place'); }
    setAnchor(null); commit(result.state);
  }
  const actions = useRef({ select, place }); actions.current = { select, place };
  useEffect(() => {
    if (!active || paused) return;
    const move = (event: PointerEvent) => {
      const held = drag.current; if (!held) return;
      if (!held.moved && Math.abs(event.clientX - held.x) + Math.abs(event.clientY - held.y) > 9) { held.moved = true; actions.current.select(held.index); }
      if (!held.moved) return;
      event.preventDefault();
      const piece = latest.current.pieces[held.index], rect = gridRef.current?.getBoundingClientRect(); if (!piece || !rect) return;
      const cells = pieceCells(piece), width = Math.max(...cells.map(c => c[1])) + 1, height = Math.max(...cells.map(c => c[0])) + 1;
      held.anchor = [Math.floor((event.clientY - rect.top) / (rect.height / 8)) - Math.floor(height / 2), Math.floor((event.clientX - rect.left) / (rect.width / 8)) - Math.floor(width / 2)];
      setAnchor(held.anchor);
    };
    const up = () => { const held = drag.current; drag.current = null; if (held?.moved) { suppress.current = Date.now() + 400; if (held.anchor) actions.current.place(...held.anchor); setAnchor(null); } };
    const cancel = () => { drag.current = null; setAnchor(null); };
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); drag.current = null; };
  }, [active, paused]);
  const selected = state.pieces[state.selected], preview = selected && anchor ? pieceCells(selected).map(([r, c]) => [r + anchor[0], c + anchor[1]]) : [];
  const valid = Boolean(selected && anchor && canPlace(state.grid, selected, ...anchor));
  return <div onKeyDown={event => { if (event.key.toLowerCase() === 'r' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); rotate(); } }}>
    <GameHeader icon="blocks" title="一块一块，刚刚好" subtitle="填满一行或一列，就能轻轻消掉。"/>
    <div className="score-strip"><Stat label="这一盘的分数" value={state.score}/><Stat label="最佳纪录" value={state.best} secondary/><Stat label="已消除" value={state.lines} unit="行 / 列" secondary/></div>
    <div className="block-table"><div className="board-wrap"><div className="board"><div className="board-grid" ref={gridRef} role="group" aria-label="8 行 8 列积木棋盘" onMouseLeave={() => { if (!drag.current) setAnchor(null); }}>
      {(visual?.grid || state.grid).map((color, i) => {
        const r = Math.floor(i / 8), c = i % 8, highlighted = preview.some(p => p[0] === r && p[1] === c);
        return <button key={i} type="button" className={`cell${color >= 0 ? ` filled color-${color}` : ''}${highlighted ? valid ? ' preview' : ' invalid' : ''}${visual?.cleared.includes(i) ? ' clearing' : ''}`} data-cell={i} aria-label={`第 ${r + 1} 行，第 ${c + 1} 列，${color >= 0 ? '已有积木' : '空格'}`} onClick={() => { if (Date.now() >= suppress.current) place(r, c); }} onMouseEnter={() => { if (enabled && selected && !drag.current) setAnchor([r, c]); }} onFocus={() => { if (selected) setAnchor([r, c]); }} onKeyDown={event => { const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 } as Record<string, number>)[event.key]; if (delta) { event.preventDefault(); (gridRef.current?.children[Math.max(0, Math.min(63, i + delta))] as HTMLElement | undefined)?.focus(); } }}/>;
      })}
    </div></div>{visual && <div className="float-points">+{visual.gain}</div>}</div><p className="board-message" aria-live="polite">{message}</p>
    <div className="tray" role="group" aria-label="待放置积木">{state.pieces.map((piece, i) => <button type="button" key={i} className={`piece${!piece ? ' empty' : ''}${state.selected === i ? ' selected' : ''}`} data-piece={i} disabled={!piece || !enabled} aria-label={piece ? `选择${shapes[piece.shape].name}，旋转 ${piece.rotation * 90} 度` : '这块已经放好'} aria-pressed={state.selected === i} onClick={() => { if (Date.now() >= suppress.current) select(i); }} onPointerDown={event => { if (enabled && piece && event.isPrimary && event.button === 0) drag.current = { index: i, x: event.clientX, y: event.clientY, moved: false, anchor: null }; }}>{piece && <PieceArt piece={piece}/>}</button>)}</div>
    <p className="tray-caption">点选或拖动放置 · 选中后按 R 旋转</p></div>
    <div className="game-tools block-tools">
      <Tool icon="rotate" disabled={!selected || !enabled} onClick={rotate} testId="block-rotate" title="顺时针旋转 90°（R）">旋转</Tool>
      <Tool icon="undo" disabled={!state.history.length} testId="block-undo" onClick={() => { const before = state.history[state.history.length - 1]; if (!before) return; setVisual(null); setAnchor(null); commit({ ...state, ...before, selected: -1, history: state.history.slice(0, -1) }); setMessage('退回这一步，试试另一个方向。'); }}>撤回</Tool>
      <Tool icon="hint" disabled={!enabled} testId="block-hint" onClick={() => { const hint = blockHint(state); if (!hint) { setMessage('现在放不下啦，可以撤回一步。'); return; } commit({ ...state, selected: hint.index, pieces: state.pieces.map((p, i) => i === hint.index ? hint.piece : p) }); setAnchor([hint.row, hint.col]); setMessage(`已经转好方向，点第 ${hint.row + 1} 行、第 ${hint.col + 1} 列试试。`); }}>帮我想想</Tool>
      <Tool icon="reset" testId="block-new" onClick={() => { setVisual(null); setAnchor(null); commit(createBlocks(state.best)); setMessage('新的一盘，转一转，慢慢来。'); }}>换一盘</Tool>
    </div>{stuck && !visual && <div className="game-status"><strong>所有方向都试过，暂时放不下啦。</strong>可以撤回几步，或换一盘继续玩。</div>}
  </div>;
}
function PieceArt({ piece }: { piece: BlockPiece }) {
  const cells = pieceCells(piece), w = Math.max(...cells.map(c => c[1])) + 1, h = Math.max(...cells.map(c => c[0])) + 1, size = Math.max(w, h) === 4 ? 19 : 23;
  return <span className="shape" style={{ width: w * size, height: h * size }}>{cells.map(([r, c]) => <i key={`${r}:${c}`} className={`tile color-${piece.color}`} style={{ width: size - 1, height: size - 1, top: r * size, left: c * size }}/>)}</span>;
}
