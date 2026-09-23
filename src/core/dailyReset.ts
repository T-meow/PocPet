import { getLocalDateKey } from './utils';

export const DAILY_RESET_HOUR = 5;

export const getDailyResetDate = (time: number) => {
  const date = new Date(time);
  if (date.getHours() < DAILY_RESET_HOUR) date.setDate(date.getDate() - 1);
  return date;
};

export const getDailyResetDateKey = (time: number) =>
  getLocalDateKey(getDailyResetDate(time).getTime());

// Calendar arithmetic avoids daylight-saving offsets when finding Monday.
export const getWeekStartDateKey = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  const monday = new Date(Date.UTC(year, month - 1, date));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return monday.toISOString().slice(0, 10);
};

export const isSameDailyResetDay = (left: number, right: number) =>
  getDailyResetDateKey(left) === getDailyResetDateKey(right);

export const normalizeLegacyDailyDateKey = (value: unknown, now: number) => {
  const dateKey = typeof value === 'string' ? value.trim().slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';

  const currentDateKey = getDailyResetDateKey(now);
  const localDateKey = getLocalDateKey(now);
  return new Date(now).getHours() < DAILY_RESET_HOUR && dateKey === localDateKey
    ? currentDateKey
    : dateKey;
};
