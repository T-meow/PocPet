import { Lunar } from 'lunar-typescript';

export const festivalIds = ['spring-festival', 'labour-day', 'dragon-boat', 'midautumn', 'national-day'] as const;
export type FestivalId = typeof festivalIds[number];
export type SeasonalFestivalId = Exclude<FestivalId, 'midautumn'>;
export const festivalNames: Record<FestivalId, string> = { 'spring-festival': '春节', 'labour-day': '五一', 'dragon-boat': '端午', midautumn: '中秋', 'national-day': '国庆' };
export const isFestivalId = (id: unknown): id is FestivalId => typeof id === 'string' && (festivalIds as readonly string[]).includes(id);
const dates = new Map<string, string>();
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Offline dates; fixed game windows use local midnight, independent of statutory make-up workdays. */
export const getFestivalWindow = (festival: FestivalId, year: number) => {
  if (!isFestivalId(festival) || !Number.isInteger(year) || year < 1900 || year > 2199) return undefined;
  const key = `${festival}:${year}`;
  let date = dates.get(key);
  if (!date) {
    if (festival === 'national-day') date = `${year}-10-01`;
    else if (festival === 'labour-day') date = `${year}-05-01`;
    else {
      const [month, day] = festival === 'spring-festival' ? [1, 1] : festival === 'dragon-boat' ? [5, 5] : [8, 15];
      date = Lunar.fromYmd(year, month, day).getSolar().toYmd();
    }
    dates.set(key, date);
  }
  const [y, m, d] = date.split('-').map(Number);
  const fixed = festival === 'national-day' || festival === 'labour-day';
  const start = new Date(y, m - 1, d - (fixed ? 0 : 3));
  const end = new Date(y, m - 1, d + (festival === 'national-day' ? 6 : festival === 'labour-day' ? 4 : 3));
  return { festival, year, date, startDate: dayKey(start), endDate: dayKey(end), startsAt: start.getTime(), endsAt: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime() };
};

export const isFestivalOpen = (festival: FestivalId, now: number) => {
  const window = getFestivalWindow(festival, new Date(now).getFullYear());
  return Boolean(window && now >= window.startsAt && now < window.endsAt);
};

export const getNextFestivalWindow = (festival: FestivalId, now: number) => {
  const year = new Date(now).getFullYear();
  const window = getFestivalWindow(festival, year);
  return window && now < window.endsAt ? window : getFestivalWindow(festival, year + 1);
};
export const getMidautumnWindow = (year: number) => getFestivalWindow('midautumn', year);
export const isMidautumnOpen = (now: number) => isFestivalOpen('midautumn', now);
