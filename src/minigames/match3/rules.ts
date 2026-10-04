import { integer, object, readId, sessionId } from '../shared/state';

export const MATCH3_SIZE = 7;
export const MATCH3_KINDS = 5;
export const MATCH3_MOVES = 40;
const CELL_COUNT = MATCH3_SIZE * MATCH3_SIZE;

export interface Match3State {
  id: string;
  grid: number[];
  seed: number;
  score: number;
  best: number;
  movesLeft: number;
  bestCombo: number;
  cleared: number;
  selected: number;
}
export interface Match3Frame {
  kind: 'swap' | 'return' | 'clear' | 'fall' | 'shuffle';
  grid: number[];
  offsets?: Record<number, [number, number]>;
  cells?: number[];
  score: number;
  combo: number;
  gain: number;
  duration: number;
}
export interface Match3Move {
  state: Match3State;
  frames: Match3Frame[];
  valid: boolean;
  shuffled: boolean;
  combo: number;
  gain: number;
}

function nextRandom(seed: number) { return (Math.imul(seed, 1664525) + 1013904223) >>> 0; }
export function adjacent(a: number, b: number) {
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < CELL_COUNT && b < CELL_COUNT
    && Math.abs(Math.floor(a / MATCH3_SIZE) - Math.floor(b / MATCH3_SIZE)) + Math.abs(a % MATCH3_SIZE - b % MATCH3_SIZE) === 1;
}
export function findMatches(grid: readonly number[]) {
  const found = new Set<number>();
  for (let direction = 0; direction < 2; direction++) for (let line = 0; line < MATCH3_SIZE; line++) {
    const index = (pos: number) => direction === 0 ? line * MATCH3_SIZE + pos : pos * MATCH3_SIZE + line;
    for (let start = 0; start < MATCH3_SIZE;) {
      let end = start + 1;
      while (end < MATCH3_SIZE && grid[index(end)] === grid[index(start)]) end++;
      if (grid[index(start)] >= 0 && end - start >= 3) for (let pos = start; pos < end; pos++) found.add(index(pos));
      start = end;
    }
  }
  return [...found].sort((a, b) => a - b);
}
export function possibleMoves(grid: readonly number[]) {
  const moves: { from: number; to: number; count: number }[] = [];
  for (let from = 0; from < CELL_COUNT; from++) for (const to of [from + 1, from + MATCH3_SIZE]) {
    if (!adjacent(from, to) || grid[from] === grid[to]) continue;
    const next = grid.slice(); [next[from], next[to]] = [next[to], next[from]];
    const count = findMatches(next).length;
    if (count) moves.push({ from, to, count });
  }
  return moves.sort((a, b) => b.count - a.count || a.from - b.from);
}

export function makeBoard(seed: number): { grid: number[]; seed: number } {
  for (let attempt = 0; attempt < 32; attempt++) {
    const grid: number[] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      const blocked = new Set<number>();
      if (i % MATCH3_SIZE >= 2 && grid[i - 1] === grid[i - 2]) blocked.add(grid[i - 1]);
      if (i >= MATCH3_SIZE * 2 && grid[i - MATCH3_SIZE] === grid[i - MATCH3_SIZE * 2]) blocked.add(grid[i - MATCH3_SIZE]);
      const choices = [0, 1, 2, 3, 4].filter(n => !blocked.has(n));
      seed = nextRandom(seed); grid.push(choices[seed % choices.length]);
    }
    if (possibleMoves(grid).length) return { grid, seed };
  }
  // Bounded fallback: no initial runs, with a guaranteed swap at cells 1 and 8.
  const grid = Array.from({ length: CELL_COUNT }, (_, i) => (Math.floor(i / MATCH3_SIZE) * 2 + i % MATCH3_SIZE) % MATCH3_KINDS);
  grid[0] = 0; grid[1] = 1; grid[2] = 0; grid[8] = 0;
  return { grid, seed };
}
export function shuffleBoard(before: readonly number[], seed: number) {
  for (let attempt = 0; attempt < 128; attempt++) {
    const grid = before.slice();
    for (let i = grid.length - 1; i > 0; i--) { seed = nextRandom(seed); const j = seed % (i + 1); [grid[i], grid[j]] = [grid[j], grid[i]]; }
    if (!findMatches(grid).length && possibleMoves(grid).length) return { grid, seed };
  }
  return makeBoard(seed);
}
export function createMatch3(best = 0): Match3State {
  const board = makeBoard(Math.floor(Math.random() * 0x100000000));
  return { id: sessionId(), ...board, score: 0, best, movesLeft: MATCH3_MOVES, bestCombo: 0, cleared: 0, selected: -1 };
}
function refill(before: number[], cells: number[], seed: number) {
  const grid = before.slice(), removed = new Set(cells), offsets: Record<number, [number, number]> = {};
  for (let col = 0; col < MATCH3_SIZE; col++) {
    let dest = MATCH3_SIZE - 1;
    for (let row = MATCH3_SIZE - 1; row >= 0; row--) {
      const from = row * MATCH3_SIZE + col;
      if (removed.has(from)) continue;
      const to = dest * MATCH3_SIZE + col; grid[to] = before[from];
      if (row !== dest) offsets[to] = [row - dest, 0];
      dest--;
    }
    const distance = dest + 1;
    for (let row = dest; row >= 0; row--) {
      seed = nextRandom(seed); const to = row * MATCH3_SIZE + col;
      grid[to] = seed % MATCH3_KINDS; offsets[to] = [-distance, 0];
    }
  }
  return { grid, seed, offsets };
}
function swapOffsets(from: number, to: number): Record<number, [number, number]> {
  const dy = Math.floor(from / MATCH3_SIZE) - Math.floor(to / MATCH3_SIZE), dx = from % MATCH3_SIZE - to % MATCH3_SIZE;
  return { [from]: [-dy, -dx], [to]: [dy, dx] };
}

// Settle the complete move before saving. Animation frames never mutate game progress.
export function swapMatch3(state: Match3State, from: number, to: number): Match3Move | null {
  if (state.movesLeft <= 0 || !adjacent(from, to)) return null;
  let grid = state.grid.slice(), seed = state.seed, score = state.score, cleared = state.cleared, combo = 0;
  [grid[from], grid[to]] = [grid[to], grid[from]];
  const frames: Match3Frame[] = [{ kind: 'swap', grid, offsets: swapOffsets(from, to), score, combo: 0, gain: 0, duration: 190 }];
  let cells = findMatches(grid);
  if (!cells.length) {
    frames.push({ kind: 'return', grid: state.grid, offsets: swapOffsets(from, to), score, combo: 0, gain: 0, duration: 190 });
    return { state: { ...state, selected: -1 }, frames, valid: false, shuffled: false, combo: 0, gain: 0 };
  }
  while (cells.length && combo < 20) {
    combo++; const gain = cells.length * 10 * combo; score += gain; cleared += cells.length;
    frames.push({ kind: 'clear', grid, cells, score, combo, gain, duration: 240 });
    const fall = refill(grid, cells, seed); grid = fall.grid; seed = fall.seed;
    frames.push({ kind: 'fall', grid, offsets: fall.offsets, score, combo, gain: 0, duration: 270 });
    cells = findMatches(grid);
  }
  const movesLeft = state.movesLeft - 1;
  const shuffled = cells.length > 0 || (movesLeft > 0 && !possibleMoves(grid).length);
  if (shuffled) {
    const fresh = shuffleBoard(grid, seed); grid = fresh.grid; seed = fresh.seed;
    frames.push({ kind: 'shuffle', grid, score, combo, gain: 0, duration: 300 });
  }
  return {
    state: { ...state, grid, seed, score, best: Math.max(state.best, score), movesLeft, bestCombo: Math.max(state.bestCombo, combo), cleared, selected: -1 },
    frames, valid: true, shuffled, combo, gain: score - state.score,
  };
}
export function normalizeMatch3(raw: unknown): Match3State {
  const v = object(raw), best = Math.max(integer(v.best), integer(v.score));
  if (!Array.isArray(v.grid) || v.grid.length !== CELL_COUNT || !v.grid.every(n => Number.isInteger(n) && n >= 0 && n < MATCH3_KINDS) || findMatches(v.grid as number[]).length) return createMatch3(best);
  const movesLeft = integer(v.movesLeft, MATCH3_MOVES, MATCH3_MOVES), grid = (v.grid as number[]).slice(), seed = integer(v.seed, 0xffffffff, 1);
  const shuffled = movesLeft > 0 && !possibleMoves(grid).length;
  const board = shuffled ? shuffleBoard(grid, seed) : { grid, seed };
  const selected = !shuffled && movesLeft > 0 && Number.isInteger(v.selected) && Number(v.selected) >= 0 && Number(v.selected) < CELL_COUNT ? Number(v.selected) : -1;
  return { id: readId(v.id), ...board, score: integer(v.score), best, movesLeft, bestCombo: integer(v.bestCombo, 20), cleared: integer(v.cleared), selected };
}
