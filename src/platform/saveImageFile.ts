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

export const prepareImageFile = async (source: string) => {
  let bytes: Uint8Array<ArrayBuffer>;
  if (/^data:/i.test(source)) {
    const match = /^data:image\/[^;,]+;base64,([\s\S]+)$/i.exec(source);
    if (!match) throw new Error(t('ui.share.invalidImage'));
    try {
      const binary = atob(match[1].replace(/\s+/g, ''));
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch { throw new Error(t('ui.share.invalidImage')); }
  } else {
    const response = await fetch(source);
    if (!response.ok) throw new Error(t('ui.share.imageLoadFailed'));
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  // Trust the encoded file signature, not a caller's filename or MIME label.
  const isPng = bytes.length >= 45
    && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    && [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130].every((value, index) => bytes[bytes.length - 12 + index] === value);
  const isJpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  if (!isPng && !isJpeg) throw new Error(t('ui.share.invalidImage'));
  const mimeType = isPng ? 'image/png' : 'image/jpeg';
  const extension = isPng ? 'png' : 'jpg';
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return { bytes, mimeType, extension, dataUrl: `data:${mimeType};base64,${btoa(chunks.join(''))}` };
};

const downloadImage = (fileName: string, bytes: Uint8Array<ArrayBuffer>, mimeType: string) => {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
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

const isBilibiliAppWebView = () =>
  typeof navigator !== 'undefined' && /BiliApp|bili-universal/i.test(navigator.userAgent);

export const saveShareImage = async (
  fileName: string,
  imageSource: string,
  sdk: ToySdk | undefined = getToySdk(),
): Promise<SaveImageFileResult> => {
  const { bytes, mimeType, extension, dataUrl } = await prepareImageFile(imageSource);
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

  const isPng = extension === 'png';
  const imageFileName = fileName.replace(/\.(?:png|jpe?g)$/i, '') + `.${extension}`;

  if (!('__TAURI_INTERNALS__' in window)) {
    downloadImage(imageFileName, bytes, mimeType);
    return 'downloaded';
  }

  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);
  const destination = await save({
    defaultPath: imageFileName,
    filters: [{ name: isPng ? 'PNG Image' : 'JPEG Image', extensions: isPng ? ['png'] : ['jpg', 'jpeg'] }],
  });
  if (!destination) return 'cancelled';
  await writeFile(destination, bytes);
  return 'saved';
};
