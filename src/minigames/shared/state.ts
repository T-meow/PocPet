export const object = (raw: unknown): Record<string, unknown> => raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
export const integer = (raw: unknown, max = 1_000_000_000, fallback = 0) => typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(max, Math.floor(raw))) : fallback;
export const finite = (raw: unknown, min: number, max: number, fallback = 0) => typeof raw === 'number' && Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : fallback;
let serial = 0;
export const sessionId = () => `game-${Date.now().toString(36)}-${(++serial).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const readId = (raw: unknown) => typeof raw === 'string' && raw.length > 0 ? raw.slice(0, 128) : sessionId();
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
