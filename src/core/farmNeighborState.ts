import type { FarmNeighborHelp } from './communityTypes';

export const farmNeighborCost = 600;
export const farmNeighborDays = 7;
const dayMs = 86400000;

const readDay = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const time = Date.parse(`${value}T12:00:00Z`);
  if (Number.isFinite(time) && value >= '1970-01-01' && new Date(time).toISOString().slice(0, 10) === value) return value;
};
export const shiftFarmNeighborDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * dayMs).toISOString().slice(0, 10);
export const farmNeighborDayDifference = (later: string, earlier: string) =>
  Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / dayMs);

export const normalizeFarmNeighborHelp = (value: unknown): FarmNeighborHelp | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const raw = value as Partial<FarmNeighborHelp>;
  const hiredDay = readDay(raw.hiredDay), expiresDay = readDay(raw.expiresDay);
  if (!hiredDay || !expiresDay || farmNeighborDayDifference(expiresDay, hiredDay) !== farmNeighborDays) return;
  const neighbor = raw.neighbor?.kind === 'mod' && typeof raw.neighbor.modId === 'string' && raw.neighbor.modId.length > 0 && raw.neighbor.modId.length <= 128
    ? { kind: 'mod' as const, modId: raw.neighbor.modId } : { kind: 'generic' as const };
  return { hiredDay, expiresDay, neighbor, sequence: Number.isSafeInteger(raw.sequence) && raw.sequence! >= 0 ? raw.sequence! : 0 };
};

// Rebase the whole interval: expired help stays expired, and a partially used
// week never becomes a fresh seven days when the system clock moves backwards.
export const rebaseFarmNeighborHelp = (value: FarmNeighborHelp | undefined, previousDay: string, currentDay: string) => {
  const help = normalizeFarmNeighborHelp(value);
  if (!help || previousDay <= currentDay) return help;
  const offset = farmNeighborDayDifference(currentDay, previousDay);
  return normalizeFarmNeighborHelp({ ...help, hiredDay: shiftFarmNeighborDay(help.hiredDay, offset), expiresDay: shiftFarmNeighborDay(help.expiresDay, offset) });
};
