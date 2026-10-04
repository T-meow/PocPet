import { puzzles, type NonogramPuzzle } from './levels';
import { integer, object, readId, sessionId } from '../shared/state';
export type Mark = -1 | 0 | 1;
export type PaintTool = 'fill' | 'empty' | 'erase';
export interface NonogramState { id: string; puzzleId: string; marks: Mark[]; history: Mark[][]; moves: number; tool: PaintTool; solvedIds: string[]; }
export function runs(values: readonly number[]) {
  const result: number[] = []; let count = 0;
  for (const value of [...values, 0]) { if (value === 1) count++; else if (count) { result.push(count); count = 0; } }
  return result;
}
export const solution = (puzzle: NonogramPuzzle) => puzzle.pixels.join('').split('').map(Number);
export function clues(puzzle: NonogramPuzzle) {
  const grid = solution(puzzle), n = puzzle.size;
  return { rows: puzzle.pixels.map(row => runs(row.split('').map(Number))), cols: Array.from({ length: n }, (_, c) => runs(Array.from({ length: n }, (_, r) => grid[r * n + c]))) };
}
const patternCache = new Map<string, number[][]>();
export function linePatterns(size: number, groups: number[]) {
  const key = `${size}:${groups.join(',')}`, cached = patternCache.get(key); if (cached) return cached;
  const patterns: number[][] = [];
  function fill(index: number, start: number, line: number[]) {
    if (index === groups.length) { patterns.push(line); return; }
    const tail = groups.slice(index + 1).reduce((sum, n) => sum + n, 0) + groups.length - index - 1;
    for (let pos = start; pos <= size - groups[index] - tail; pos++) {
      const next = line.slice(); next.fill(1, pos, pos + groups[index]); fill(index + 1, pos + groups[index] + 1, next);
    }
  }
  fill(0, 0, Array<number>(size).fill(0)); patternCache.set(key, patterns); return patterns;
}
export interface Deduction { index: number; mark: 0 | 1; axis: 'row' | 'col'; line: number; groups: number[]; }
export function analyze(puzzle: NonogramPuzzle, marks: readonly Mark[]) {
  const numbers = clues(puzzle), deductions: Deduction[] = [];
  for (const axis of ['row', 'col'] as const) for (let line = 0; line < puzzle.size; line++) {
    const indices = Array.from({ length: puzzle.size }, (_, i) => axis === 'row' ? line * puzzle.size + i : i * puzzle.size + line);
    const groups = axis === 'row' ? numbers.rows[line] : numbers.cols[line];
    const patterns = linePatterns(puzzle.size, groups).filter(p => indices.every((index, i) => marks[index] === -1 || marks[index] === p[i]));
    if (!patterns.length) return { deductions: [], conflict: { axis, line } };
    indices.forEach((index, i) => { if (marks[index] === -1 && patterns.every(p => p[i] === patterns[0][i])) deductions.push({ index, mark: patterns[0][i] as 0 | 1, axis, line, groups }); });
  }
  return { deductions, conflict: undefined };
}
export function logicalSolve(puzzle: NonogramPuzzle, start?: readonly Mark[]) {
  const marks: Mark[] = start ? [...start] : Array<Mark>(puzzle.size ** 2).fill(-1);
  for (let pass = 0; pass < puzzle.size ** 2; pass++) {
    const result = analyze(puzzle, marks);
    if (result.conflict) return { marks, conflict: true, complete: false, source: result.conflict };
    if (!result.deductions.length) return { marks, conflict: false, complete: !marks.includes(-1) };
    for (const d of result.deductions) {
      if (marks[d.index] !== -1 && marks[d.index] !== d.mark) return { marks, conflict: true, complete: false, source: { axis: d.axis, line: d.line } };
      marks[d.index] = d.mark;
    }
  }
  return { marks, conflict: false, complete: !marks.includes(-1) };
}
export function countSolutions(puzzle: NonogramPuzzle, start?: Mark[], limit = 2) {
  let count = 0, visited = 0;
  function search(marks: Mark[]) {
    if (count >= limit || ++visited > 20000) return;
    const solved = logicalSolve(puzzle, marks); if (solved.conflict) return;
    if (solved.complete) { count++; return; }
    const i = solved.marks.indexOf(-1);
    for (const value of [1, 0] as const) { const next = solved.marks.slice(); next[i] = value; search(next); }
  }
  search(start || Array<Mark>(puzzle.size ** 2).fill(-1)); return { count, exhausted: visited <= 20000 };
}
export const getPuzzle = (id: string) => puzzles.find(p => p.id === id) || puzzles[0];
export const nonogramSolved = (state: NonogramState) => solution(getPuzzle(state.puzzleId)).every((v, i) => (state.marks[i] === 1 ? 1 : 0) === v);
export function createNonogram(puzzleId = puzzles[0].id, solvedIds: string[] = []): NonogramState {
  const puzzle = getPuzzle(puzzleId);
  return { id: sessionId(), puzzleId: puzzle.id, marks: Array<Mark>(puzzle.size ** 2).fill(-1), history: [], moves: 0, tool: 'fill', solvedIds };
}
export function normalizeNonogram(raw: unknown): NonogramState {
  const v = object(raw), puzzle = getPuzzle(String(v.puzzleId)), readMarks = (m: unknown): m is Mark[] => Array.isArray(m) && m.length === puzzle.size ** 2 && m.every(c => c === -1 || c === 0 || c === 1);
  const solvedIds = Array.isArray(v.solvedIds) ? [...new Set(v.solvedIds.filter((id): id is string => typeof id === 'string' && puzzles.some(p => p.id === id)))] : [];
  if (!readMarks(v.marks)) return createNonogram(puzzle.id, solvedIds);
  return { id: readId(v.id), puzzleId: puzzle.id, marks: v.marks.slice(), history: (Array.isArray(v.history) ? v.history.slice(-50) : []).filter(readMarks).map(m => m.slice()), moves: integer(v.moves), tool: v.tool === 'empty' || v.tool === 'erase' ? v.tool : 'fill', solvedIds };
}
