import { finite, integer, object, readId, sessionId } from '../shared/state';
import { fruits, FRUIT_HEIGHT, FRUIT_WIDTH } from './catalog';
export interface FruitBody { id: number; tier: number; x: number; y: number; vx: number; vy: number; angle: number; angularVelocity: number; landed: boolean; }
export interface FruitState { id: string; bodies: FruitBody[]; score: number; best: number; current: number; next: number; seed: number; nextId: number; aim: number; over: boolean; dangerMs: number; celebrated: boolean; dropCooldownMs: number; }
export function nextFruit(seed: number) { const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return { seed: next, tier: next % 3 }; }
export function createFruit(best = 0): FruitState {
  const first = nextFruit(Math.floor(Math.random() * 0xffffffff)), second = nextFruit(first.seed);
  return { id: sessionId(), bodies: [], score: 0, best, current: first.tier, next: second.tier, seed: second.seed, nextId: 1, aim: FRUIT_WIDTH / 2, over: false, dangerMs: 0, celebrated: false, dropCooldownMs: 0 };
}
export function normalizeFruit(raw: unknown): FruitState {
  const v = object(raw), fallback = createFruit(integer(v.best));
  if (!Array.isArray(v.bodies) || v.bodies.length > 180) return fallback;
  const ids = new Set<number>(), bodies: FruitBody[] = [];
  for (const entry of v.bodies) {
    const b = object(entry), tier = b.tier, id = b.id;
    if (!Number.isInteger(tier) || Number(tier) < 0 || Number(tier) >= fruits.length || !Number.isInteger(id) || Number(id) < 1 || Number(id) > 1_000_000 || ids.has(Number(id)) || ![b.x, b.y, b.vx, b.vy].every(n => typeof n === 'number' && Number.isFinite(n))) return fallback;
    const radius = fruits[Number(tier)].radius; ids.add(Number(id));
    bodies.push({ id: Number(id), tier: Number(tier), x: finite(b.x, radius + 4, FRUIT_WIDTH - radius - 4), y: finite(b.y, -radius, FRUIT_HEIGHT - radius - 4), vx: finite(b.vx, -15, 15), vy: finite(b.vy, -15, 15), angle: finite(b.angle, -10000, 10000), angularVelocity: finite(b.angularVelocity, -1, 1), landed: b.landed === true });
  }
  const score = integer(v.score);
  return { ...fallback, id: readId(v.id), bodies, score, best: Math.max(score, integer(v.best)), current: integer(v.current, 2), next: integer(v.next, 2), seed: integer(v.seed, 0xffffffff, fallback.seed), nextId: Math.max(integer(v.nextId, 1_000_001, 1), ...bodies.map(b => b.id + 1)), aim: finite(v.aim, 0, FRUIT_WIDTH, 160), over: v.over === true, dangerMs: finite(v.dangerMs, 0, 3000), celebrated: v.celebrated === true, dropCooldownMs: finite(v.dropCooldownMs, 0, 800) };
}
