import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareImageFile, saveShareImage } from '../src/platform/saveImageFile';

const png = readFileSync(new URL('../src-tauri/icons/32x32.png', import.meta.url));
// A real 2 × 2 JPEG encoded by Windows GDI+, including its image data and EOI.
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8rZ55LmaSaaRpZZGLvI7EszE5JJPUmiiis6fwL0OvF/7xU/xP8z//2Q==', 'base64');
const dataUrl = (bytes: Buffer, mime = 'image/png') => `data:${mime};base64,${bytes.toString('base64')}`;
const permissions = JSON.parse(readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8')).permissions;
const originals = new Map(['window', 'document', 'fetch'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const setGlobal = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
let destination: string | null = 'D:\\图片\\test.png';
let writes = 0;
let dialogs = 0;
let saved: Uint8Array | undefined;
let selectedOptions: any;
let failWrite = false;
const invoke = async (command: string, payload: any, options: any) => {
  if (command === 'plugin:dialog|save') {
    assert.ok(permissions.includes('dialog:allow-save'));
    dialogs++;
    selectedOptions = payload.options;
    return destination;
  }
  assert.equal(command, 'plugin:fs|write_file');
  assert.ok(permissions.includes('fs:allow-write-file'), 'native binary writes must have their own capability');
  assert.equal(decodeURIComponent(options.headers.path), destination, 'preserve Windows paths and Android content URIs');
  if (failWrite) throw new Error('disk full');
  writes++;
  saved = payload;
};

try {
  setGlobal('window', { __TAURI_INTERNALS__: { invoke } });
  for (const [bytes, extension, mime] of [[png, 'png', 'image/png'], [jpeg, 'jpg', 'image/jpeg']] as const) {
    // Both caller metadata fields deliberately disagree with the actual bytes.
    const source = dataUrl(bytes, extension === 'png' ? 'image/jpeg' : 'image/png');
    const prepared = await prepareImageFile(source);
    assert.equal(prepared.mimeType, mime);
    assert.equal(prepared.extension, extension);
    assert.deepEqual(Buffer.from(prepared.bytes), bytes);
    for (const path of [`D:\\图片\\test.${extension}`, 'content://com.android.providers.downloads.documents/document/123']) {
      destination = path;
      assert.equal(await saveShareImage('test.jpeg', source), 'saved');
      assert.equal(selectedOptions.defaultPath, `test.${extension}`);
      assert.ok(selectedOptions.filters[0].extensions.includes(extension));
      assert.deepEqual(Buffer.from(saved!), bytes, 'write image bytes, never base64 or UTF-8 text');
    }
  }
  const writesBeforeCancel = writes;
  destination = null;
  assert.equal(await saveShareImage('cancel.png', dataUrl(png)), 'cancelled');
  assert.equal(writes, writesBeforeCancel);
  destination = 'D:\\test.png';
  failWrite = true;
  await assert.rejects(saveShareImage('failure.png', dataUrl(png)), /disk full/);
  failWrite = false;

  const dialogsBeforeInvalid = dialogs;
  for (const invalid of ['data:,', 'data:image/png;base64,AA==', 'data:image/jpeg;base64,??', dataUrl(png.subarray(0, -8)), dataUrl(jpeg.subarray(0, -2), 'image/jpeg')]) {
    await assert.rejects(saveShareImage('invalid.png', invalid), /图片数据|image data/);
  }
  assert.equal(dialogs, dialogsBeforeInvalid, 'reject malformed or truncated images before creating a destination file');

  setGlobal('fetch', async (url: string) => {
    assert.equal(url, '/assets/CG1.png');
    return new Response(png, { headers: { 'Content-Type': 'application/octet-stream' } });
  });
  assert.equal(await saveShareImage('achievement.jpg', '/assets/CG1.png'), 'saved');
  assert.deepEqual(Buffer.from(saved!), png);
  setGlobal('fetch', async () => new Response('not found', { status: 404 }));
  await assert.rejects(saveShareImage('missing.png', '/missing.png'), /读取图片|load the image/);
  setGlobal('fetch', originals.get('fetch')!.value);

  let revoke: (() => void) | undefined;
  let clicked = false;
  const link = { href: '', download: '', click() { clicked = true; }, remove() {} };
  setGlobal('window', { setTimeout: (callback: () => void) => { revoke = callback; } });
  setGlobal('document', { createElement: () => link, body: { appendChild() {} } });
  assert.equal(await saveShareImage('web.jpg', dataUrl(png)), 'downloaded');
  assert.equal(link.download, 'web.png');
  assert.equal(clicked, true);
  const blobResponse = await fetch(link.href);
  assert.equal(blobResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await blobResponse.arrayBuffer()), png);
  revoke?.();
} finally {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
}
console.log('Image exports passed: real PNG/JPEG bytes, MIME correction, native permissions/paths, cancellation, failures, asset URLs and browser Blob download.');
