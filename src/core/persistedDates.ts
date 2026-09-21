// Date keys are calendar labels, so encode them in UTC without applying the
// player's time zone or the game's daily reset hour a second time.
export type PersistedDateKeys = string[] | { first: number; bits: string };
const dayMs = 86400000;
const maxSpan = 4096;
const maxDates = 370;
const firstDay = Date.parse('0000-01-01T00:00:00Z') / dayMs;
const lastDay = Date.parse('9999-12-31T00:00:00Z') / dayMs;
const dayKey = (day: number) => new Date(day * dayMs).toISOString().slice(0, 10);

export const packDateKeys = (keys: string[]): PersistedDateKeys => {
  if (!keys.length || keys.length > maxDates) return keys;
  const days = keys.map(key => Date.parse(`${key}T00:00:00Z`) / dayMs);
  // Retain unusual legacy dates and their order verbatim. A bitmap is only
  // lossless for canonical, strictly increasing calendar dates.
  if (days.some((day, index) => !Number.isInteger(day) || day < firstDay || day > lastDay
    || dayKey(day) !== keys[index] || index > 0 && day <= days[index - 1])) return keys;
  const span = days[days.length - 1] - days[0] + 1;
  if (span > maxSpan) return keys;
  const bytes = new Uint8Array(Math.ceil(span / 8));
  for (const day of days) {
    const offset = day - days[0];
    bytes[offset >> 3] |= 1 << (offset & 7);
  }
  const packed = { first: days[0], bits: btoa(String.fromCharCode(...bytes)) };
  return JSON.stringify(packed).length < JSON.stringify(keys).length ? packed : keys;
};

export const unpackDateKeys = (raw: unknown): unknown => {
  if (raw === undefined || Array.isArray(raw)) return raw;
  const invalid = () => { throw new Error('Save file has invalid compact activity dates.'); };
  if (!raw || typeof raw !== 'object') return invalid();
  const { first, bits } = raw as Record<string, unknown>;
  if (typeof first !== 'number' || !Number.isInteger(first) || first < firstDay || first > lastDay
    || typeof bits !== 'string' || !bits.length || bits.length > Math.ceil(maxSpan / 8 / 3) * 4) return invalid();
  let binary: string;
  try { binary = atob(bits); } catch { return invalid(); }
  if (!binary.length || binary.length > maxSpan / 8 || btoa(binary) !== bits
    || !(binary.charCodeAt(0) & 1) || !binary.charCodeAt(binary.length - 1)) return invalid();
  const keys: string[] = [];
  for (let index = 0; index < binary.length * 8; index++) {
    if (!(binary.charCodeAt(index >> 3) & (1 << (index & 7)))) continue;
    if (first + index > lastDay || keys.length >= maxDates) return invalid();
    keys.push(dayKey(first + index));
  }
  return keys;
};
