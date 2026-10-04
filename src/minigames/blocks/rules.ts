import { clone, integer, object, readId, sessionId } from '../shared/state';

export type Cell = [number, number];
export interface BlockPiece { shape: number; rotation: number; color: number; }
export interface BlockPosition { grid: number[]; pieces: (BlockPiece | null)[]; score: number; lines: number; }
export interface BlockState extends BlockPosition { id: string; best: number; selected: number; history: BlockPosition[]; }
export const shapes: { name: string; cells: Cell[] }[] = [
  { name: '三格长条', cells: [[0, 0], [0, 1], [0, 2]] },
  { name: '小拐角', cells: [[0, 0], [1, 0], [1, 1]] },
  { name: '小方块', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { name: '四格长条', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { name: '小台阶', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { name: '小山丘', cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  { name: '长拐角', cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { name: '两格积木', cells: [[0, 0], [0, 1]] },
  { name: '小小一格', cells: [[0, 0]] },
  { name: '大方块', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
];
export function pieceCells(piece: BlockPiece): Cell[] {
  let cells = shapes[piece.shape].cells.map(([y, x]): Cell => [y, x]);
  for (let n = 0; n < piece.rotation; n++) {
    cells = cells.map(([y, x]): Cell => [x, -y]);
    const minY = Math.min(...cells.map(c => c[0])), minX = Math.min(...cells.map(c => c[1]));
    cells = cells.map(([y, x]): Cell => [y - minY, x - minX]);
  }
  return cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
export const orientations = (piece: BlockPiece) => {
  const seen = new Set<string>();
  return [0, 1, 2, 3].map(rotation => ({ ...piece, rotation })).filter(p => {
    const key = JSON.stringify(pieceCells(p));
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
};
export const canPlace = (grid: number[], piece: BlockPiece, row: number, col: number) => Number.isInteger(row) && Number.isInteger(col) && pieceCells(piece).every(([dy, dx]) => {
  const y = row + dy, x = col + dx;
  return y >= 0 && y < 8 && x >= 0 && x < 8 && grid[y * 8 + x] === -1;
});
export function placements(grid: number[], piece: BlockPiece) {
  const result: { row: number; col: number; piece: BlockPiece }[] = [];
  for (const p of orientations(piece)) for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    if (canPlace(grid, p, row, col)) result.push({ row, col, piece: p });
  }
  return result;
}
export const isBlocked = (state: BlockPosition) => state.pieces.some(Boolean) && !state.pieces.some(p => p && placements(state.grid, p).length);
export function fullLines(grid: number[]) {
  const rows: number[] = [], cols: number[] = [];
  for (let n = 0; n < 8; n++) {
    if (grid.slice(n * 8, n * 8 + 8).every(v => v >= 0)) rows.push(n);
    if ([0, 1, 2, 3, 4, 5, 6, 7].every(r => grid[r * 8 + n] >= 0)) cols.push(n);
  }
  return { count: rows.length + cols.length, cells: grid.map((_, i) => i).filter(i => rows.includes(Math.floor(i / 8)) || cols.includes(i % 8)) };
}
export function createBlocks(best = 0): BlockState {
  const grid = Array<number>(64).fill(-1);
  [[40, 0], [48, 0], [49, 0], [56, 0], [57, 0], [58, 2], [59, 2], [60, 2], [34, 3], [35, 3], [42, 3], [23, 1], [31, 1]].forEach(([i, color]) => { grid[i] = color; });
  return { id: sessionId(), grid, pieces: [0, 1, 2].map((shape, i) => ({ shape, rotation: 0, color: [2, 0, 1][i] })), score: 0, lines: 0, best, selected: -1, history: [] };
}
function deal(grid: number[], random: () => number) {
  const pool = shapes.map((_, shape) => shape).filter(shape => placements(grid, { shape, rotation: 0, color: 0 }).length);
  return [0, 1, 2].map(i => ({ shape: i === 0 && pool.length ? pool[Math.floor(random() * pool.length)] : Math.floor(random() * shapes.length), rotation: Math.floor(random() * 4), color: Math.floor(random() * 6) }));
}
export function placeBlock(state: BlockState, row: number, col: number, random = Math.random) {
  const piece = state.pieces[state.selected];
  if (!piece || !canPlace(state.grid, piece, row, col)) return null;
  const before: BlockPosition = clone({ grid: state.grid, pieces: state.pieces, score: state.score, lines: state.lines });
  const grid = state.grid.slice(), placed = pieceCells(piece).map(([y, x]) => (row + y) * 8 + col + x);
  placed.forEach(i => { grid[i] = piece.color; });
  const clear = fullLines(grid), gain = placed.length * 10 + clear.count ** 2 * 80;
  clear.cells.forEach(i => { grid[i] = -1; });
  let pieces = state.pieces.map((p, i) => i === state.selected ? null : p);
  if (pieces.every(p => !p)) pieces = deal(grid, random);
  return { state: { ...state, grid, pieces, selected: -1, score: state.score + gain, lines: state.lines + clear.count, best: Math.max(state.best, state.score + gain), history: [...state.history, before].slice(-50) }, placed, clear, gain };
}
export function blockHint(state: BlockState) {
  let best: { index: number; row: number; col: number; piece: BlockPiece; rating: number } | undefined;
  state.pieces.forEach((piece, index) => { if (piece) for (const p of placements(state.grid, piece)) {
    const grid = state.grid.slice(); pieceCells(p.piece).forEach(([y, x]) => { grid[(p.row + y) * 8 + p.col + x] = p.piece.color; });
    const rating = fullLines(grid).count * 1000 + p.row * 4 + p.col;
    if (!best || rating > best.rating) best = { ...p, index, rating };
  } });
  return best;
}
function readPosition(raw: unknown): BlockPosition | null {
  const v = object(raw);
  if (!Array.isArray(v.grid) || v.grid.length !== 64 || !v.grid.every(n => Number.isInteger(n) && n >= -1 && n <= 5)) return null;
  if (!Array.isArray(v.pieces) || v.pieces.length !== 3) return null;
  const pieces: (BlockPiece | null)[] = [];
  for (const p of v.pieces) {
    if (p === null) { pieces.push(null); continue; }
    const item = object(p);
    if (![item.shape, item.rotation, item.color].every(Number.isInteger) || Number(item.shape) < 0 || Number(item.shape) >= shapes.length || Number(item.rotation) < 0 || Number(item.rotation) > 3 || Number(item.color) < 0 || Number(item.color) > 5) return null;
    pieces.push({ shape: Number(item.shape), rotation: Number(item.rotation), color: Number(item.color) });
  }
  if (pieces.every(p => !p) || fullLines(v.grid as number[]).count) return null;
  return { grid: (v.grid as number[]).slice(), pieces, score: integer(v.score), lines: integer(v.lines) };
}
export function normalizeBlocks(raw: unknown): BlockState {
  const v = object(raw), position = readPosition(v), best = Math.max(integer(v.best), position?.score ?? 0);
  if (!position) return createBlocks(best);
  const selected = Number.isInteger(v.selected) && Number(v.selected) >= 0 && Number(v.selected) < 3 && position.pieces[Number(v.selected)] ? Number(v.selected) : -1;
  return { ...position, id: readId(v.id), best, selected, history: (Array.isArray(v.history) ? v.history.slice(-50) : []).map(readPosition).filter((p): p is BlockPosition => Boolean(p)) };
}
