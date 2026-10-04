import { levels } from './levels';
import { integer, object, readId, sessionId } from '../shared/state';
export interface WaterPosition { bottles: number[][]; moves: number; }
export interface WaterState extends WaterPosition { id: string; difficulty: number; level: number; selected: number; history: WaterPosition[]; }
export const flavors = [
  { name: '草莓', fill: '#dca1ad', edge: '#b98090', mark: '✿' }, { name: '蜜桃', fill: '#ebc17f', edge: '#be965b', mark: '●' },
  { name: '薄荷', fill: '#aec59b', edge: '#849b73', mark: '◆' }, { name: '葡萄', fill: '#beb0d4', edge: '#9583af', mark: '✦' }, { name: '蓝莓', fill: '#9abccb', edge: '#7399ac', mark: '○' },
];
export const uniform = (b: number[]) => b.length > 0 && b.every(c => c === b[0]);
export const bottleDone = (b: number[]) => b.length === 4 && uniform(b);
export const waterSolved = (b: number[][]) => b.every(v => !v.length || bottleDone(v));
export function pourAmount(bottles: number[][], from: number, to: number) {
  if (from === to || !bottles[from] || !bottles[to]) return 0;
  const a = bottles[from], b = bottles[to], color = a[a.length - 1];
  if (!a.length || b.length >= 4 || (b.length && b[b.length - 1] !== color)) return 0;
  let run = 1; for (let i = a.length - 2; i >= 0 && a[i] === color; i--) run++;
  return Math.min(run, 4 - b.length);
}
export function poured(bottles: number[][], from: number, to: number) {
  const n = pourAmount(bottles, from, to), next = bottles.map(b => b.slice());
  if (n) next[to].push(...next[from].splice(next[from].length - n, n));
  return next;
}
export function solveWater(initial: number[][], limit = 45000) {
  let visited = 0, cutoff = false;
  const seen = new Map<string, number>();
  function search(state: number[][], depth: number): [number, number][] | null {
    if (waterSolved(state)) return [];
    if (depth > 65 || visited >= limit) { cutoff = true; return null; }
    const key = state.map(b => b.join('') || '-').sort().join('|');
    if (seen.has(key) && seen.get(key)! <= depth) return null;
    seen.set(key, depth); visited++;
    const moves: { from: number; to: number; next: number[][]; priority: number }[] = [];
    for (let from = 0; from < state.length; from++) {
      if (!state[from].length || bottleDone(state[from])) continue;
      let empty = false;
      for (let to = 0; to < state.length; to++) {
        const n = pourAmount(state, from, to); if (!n) continue;
        if (!state[to].length) { if (empty || uniform(state[from])) continue; empty = true; }
        const next = poured(state, from, to);
        moves.push({ from, to, next, priority: (bottleDone(next[to]) ? 12 : 0) + (state[to].length ? 5 : 0) + (!next[from].length ? 4 : 0) + n });
      }
    }
    moves.sort((a, b) => b.priority - a.priority);
    for (const move of moves) { const path = search(move.next, depth + 1); if (path) return [[move.from, move.to], ...path]; if (visited >= limit) break; }
    return null;
  }
  return { path: search(initial, 0), cutoff, visited };
}
export function createWater(difficulty = 0, level = 0): WaterState {
  return { id: sessionId(), difficulty, level, bottles: levels[difficulty][level % levels[difficulty].length].map(b => b.slice()), moves: 0, selected: -1, history: [] };
}
function readPosition(raw: unknown, colors: number): WaterPosition | null {
  const v = object(raw), counts = Array<number>(colors).fill(0);
  if (!Array.isArray(v.bottles) || v.bottles.length !== colors + 2) return null;
  for (const b of v.bottles) {
    if (!Array.isArray(b) || b.length > 4) return null;
    for (const c of b) { if (!Number.isInteger(c) || c < 0 || c >= colors) return null; counts[c]++; }
  }
  if (!counts.every(n => n === 4)) return null;
  return { bottles: (v.bottles as number[][]).map(b => b.slice()), moves: integer(v.moves) };
}
export function normalizeWater(raw: unknown): WaterState {
  const v = object(raw), difficulty = integer(v.difficulty, 2), level = integer(v.level, 9999), p = readPosition(v, difficulty + 3);
  if (!p) return createWater(difficulty, level);
  return { ...p, id: readId(v.id), difficulty, level, selected: -1, history: (Array.isArray(v.history) ? v.history.slice(-100) : []).map(h => readPosition(h, difficulty + 3)).filter((h): h is WaterPosition => Boolean(h)) };
}
