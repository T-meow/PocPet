import { t } from '../i18n';
import { getToySdk, supportsToyAbility, withToySdkTimeout, type ToySdk } from './toySdk';

export type SaveImageFileResult = 'album' | 'saved' | 'downloaded' | 'cancelled';

const invalidFileNameCharacters = /[<>:"/\\|?*\u0000-\u001f]/g;
const toyAlbumSaveTimeoutMs = 15_000;

export const createShareImageFileName = (label: string, now = Date.now()) => {
  const date = new Date(now);
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join('');
  const safeLabel = label.normalize('NFKC').replace(invalidFileNameCharacters, '_').trim().slice(0, 48) || 'PocPet';
  return `${safeLabel}-${stamp}.jpg`;
};

const dataUrlToBytes = (dataUrl: string) => {
  const separator = dataUrl.indexOf(',');
  if (separator < 0) throw new Error('Invalid image data.');
  const binary = atob(dataUrl.slice(separator + 1).replace(/\s+/g, ''));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const downloadImage = (fileName: string, dataUrl: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const isBilibiliAppWebView = () =>
  typeof navigator !== 'undefined' && /BiliApp|bili-universal/i.test(navigator.userAgent);

export const saveShareImage = async (
  fileName: string,
  dataUrl: string,
  sdk: ToySdk | undefined = getToySdk(),
): Promise<SaveImageFileResult> => {
  const supportsAlbumSave = sdk ? await supportsToyAbility('saveImageToAlbum', sdk) : false;
  if (sdk && supportsAlbumSave) {
    if (dataUrl.length > 5 * 1024 * 1024) throw new Error('Image exceeds the Toy album limit.');
    await withToySdkTimeout(
      sdk.saveImageToAlbum({
        base64Data: dataUrl,
        hintMsg: t('ui.share.albumPermissionHint'),
      }),
      toyAlbumSaveTimeoutMs,
      t('ui.share.albumTimeout'),
    );
    return 'album';
  }

  if (sdk) {
    const hasAppOnlyAbility = isBilibiliAppWebView() || (await Promise.all([
      supportsToyAbility('share', sdk),
      supportsToyAbility('closeBrowser', sdk),
    ])).some(Boolean);
    if (hasAppOnlyAbility) throw new Error(t('ui.share.albumUnsupported'));
  }

  if (!('__TAURI_INTERNALS__' in window)) {
    downloadImage(fileName, dataUrl);
    return 'downloaded';
  }

  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);
  const destination = await save({
    defaultPath: fileName,
    filters: [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }],
  });
  if (!destination) return 'cancelled';
  await writeFile(destination, dataUrlToBytes(dataUrl));
  return 'saved';
};
