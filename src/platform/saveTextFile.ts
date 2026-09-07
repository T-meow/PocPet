import { isBilibiliAppWebView } from './edition';
export type SaveTextFileResult = 'saved' | 'cancelled' | 'downloaded' | 'text';

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
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const saveTextFile = async (fileName: string, text: string): Promise<SaveTextFileResult> => {
  if (!('__TAURI_INTERNALS__' in window)) {
    if (isBilibiliAppWebView()) return 'text';
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
