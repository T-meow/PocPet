export const editionNoticeKey = 'pocpet.edition-notice.1.6';
export const localDateKey = (now = Date.now()) => {
  const date = new Date(now);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
export interface EditionNotice { count: number; lastDate: string }
let sessionNotice: EditionNotice = { count: 0, lastDate: '' };
export const readEditionNotice = (): EditionNotice => {
  try {
    const value = JSON.parse(localStorage.getItem(editionNoticeKey) || 'null');
    if (value && Number.isInteger(value.count) && value.count >= 0 && typeof value.lastDate === 'string') return value;
  } catch { /* A disabled store must not block the game. */ }
  return sessionNotice;
};
export const shouldShowEditionNotice = (notice: EditionNotice, now = Date.now()) =>
  notice.count < 3 && notice.lastDate < localDateKey(now);
export const acknowledgeEditionNotice = (now = Date.now()) => {
  const current = readEditionNotice();
  if (!shouldShowEditionNotice(current, now)) return;
  sessionNotice = { count: current.count + 1, lastDate: localDateKey(now) };
  try { localStorage.setItem(editionNoticeKey, JSON.stringify(sessionNotice)); } catch { /* Session fallback. */ }
};
