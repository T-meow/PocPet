import { t } from '../i18n';
import { isBilibiliAppWebView } from './edition';

export type SaveTextFileResult = 'saved' | 'cancelled' | 'downloaded' | 'shared';

export const saveFileResultMessage = (result: SaveTextFileResult) => t({
  saved: 'ui.settings.save.saved',
  downloaded: isBilibiliAppWebView() ? 'ui.settings.save.phoneDownloadRequested' : 'ui.settings.save.downloadStarted',
  cancelled: 'ui.settings.save.saveCancelled',
  shared: 'ui.settings.save.fileShared',
}[result]);

const invalidFileNameCharacters = /[<>:"/\\|?*\u0000-\u001f]/g;

export const createSaveFileName = (petName: string, now = Date.now()) => {
  const date = new Date(now);
  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const safePetName = petName
    .normalize('NFKC')
    .replace(invalidFileNameCharacters, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48) || 'PocPet';
  return `${safePetName}-${dateKey}-pocpet-save.pocpet`;
};

const downloadTextFile = (fileName: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
};

const getShareableTextFile = (fileName: string, text: string) => {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return;
  // Android share targets may reject an unknown extension even for plain text.
  for (const name of [fileName, `${fileName}.txt`]) {
    try {
      const file = new File([text], name, { type: 'text/plain' });
      if (navigator.canShare({ files: [file] })) return file;
    } catch { /* Try the portable text extension or leave download available. */ }
  }
};

export const canShareTextFile = (fileName: string, text: string) => Boolean(getShareableTextFile(fileName, text));

export const shareTextFile = async (fileName: string, text: string): Promise<SaveTextFileResult> => {
  const file = getShareableTextFile(fileName, text);
  if (!file) throw new Error('File sharing is unavailable.');
  try {
    // Keep this call in the original click event, before any asynchronous work.
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
};

export const saveTextFile = async (fileName: string, text: string): Promise<SaveTextFileResult> => {
  if (!('__TAURI_INTERNALS__' in window)) {
    downloadTextFile(fileName, text);
    return 'downloaded';
  }

  const [{ save }, { writeTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);
  const destination = await save({
    defaultPath: fileName,
    filters: [{ name: 'PocPet Save', extensions: ['pocpet'] }],
  });

  if (!destination) return 'cancelled';

  await writeTextFile(destination, text);
  return 'saved';
};
