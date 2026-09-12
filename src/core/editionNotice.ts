import { appBuild } from '../platform/edition';

export const editionNoticeRevision = 'save-v2-kitchen-play';
export const editionNoticeKey = `pocpet.edition-notice.${appBuild.version}.${editionNoticeRevision}`;
const launchId = `${Date.now()}-${Math.random()}`;
export const localDateKey = (now = Date.now()) => {
  const date = new Date(now);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
export interface EditionNotice { count: number; lastLaunch: string }
let sessionNotice: EditionNotice = { count: 0, lastLaunch: '' };
export const readEditionNotice = (): EditionNotice => {
  try {
    const value = JSON.parse(localStorage.getItem(editionNoticeKey) || 'null');
    if (value && Number.isInteger(value.count) && value.count >= sessionNotice.count && typeof value.lastLaunch === 'string') return value;
  } catch { /* A disabled store must not block the game. */ }
  return sessionNotice;
};
export const shouldShowEditionNotice = (notice: EditionNotice, currentLaunch = launchId) =>
  notice.count < 3 && notice.lastLaunch !== currentLaunch;
export const recordEditionNoticeShown = (currentLaunch = launchId) => {
  const current = readEditionNotice();
  if (!shouldShowEditionNotice(current, currentLaunch)) return;
  sessionNotice = { count: current.count + 1, lastLaunch: currentLaunch };
  try { localStorage.setItem(editionNoticeKey, JSON.stringify(sessionNotice)); } catch { /* Session fallback. */ }
};
