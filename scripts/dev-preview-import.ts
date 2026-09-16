import { createMidautumnPreview } from './fixtures/midautumn-preview';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { getStoredSaveIdentity, loadPet, replacePetFromImport } from '../src/core/storage';
import { getMidautumnRun } from '../src/core/festivalStories';

// Loaded only by the generated, token-protected local development import page.
const config = JSON.parse(document.getElementById('preview-config')!.textContent!) as { origin: string; endpoint: string; token: string };
const message = document.getElementById('preview-message')!;
const send = async (payload: object) => {
  const response = await fetch(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Preview-Token': config.token }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`备份服务返回 ${response.status}`);
  return response.json() as Promise<{ backupId: string }>;
};

async function importPreview() {
  if (!import.meta.env.DEV || location.origin !== config.origin || location.hostname !== '127.0.0.1') throw new Error('仅可在指定本地开发服务器导入。');
  const marker = `pocpet.dev-preview.${config.token}`;
  if (localStorage.getItem(marker)) { location.replace('/#midautumn'); return; }
  const primaryKey = 'pocpet.pet.v1';
  const keys = [primaryKey, `${primaryKey}.identity`, `${primaryKey}.backup`, `${primaryKey}.backup.identity`, `${primaryKey}.import-backup`];
  const before = Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  const identity = getStoredSaveIdentity();
  const old = before[primaryKey] ? parseSaveFileText(before[primaryKey]!) : undefined;
  const now = Date.now();
  const preview = createMidautumnPreview(now, identity?.id ?? 'official.furo', old?.pet.name ?? identity?.defaultPetName);
  const previewText = createSaveFileText(preview, identity, now);
  // Do not mutate storage until the original bytes have reached a separate local file.
  message.textContent = '正在备份当前开发存档…';
  const { backupId } = await send({ kind: 'backup', before, identity: identity ?? null });
  if (keys.some((key) => localStorage.getItem(key) !== before[key])) throw new Error('其他游戏页面刚刚更新了存档，未执行导入。备份已保留；请关闭其他游戏页面，再重新生成导入链接。');
  const committed = replacePetFromImport(preview, old ? createSaveFileText(old.pet, identity, now) : '', identity ?? null, previewText, now);
  const loaded = loadPet(now);
  const year = new Date(now).getFullYear();
  if (loaded.status !== 'ok' || loaded.pet.saveMetadata.id !== committed.saveMetadata.id || getMidautumnRun(loaded.pet, year)?.stage !== 'flavour') throw new Error('预览存档写入后核验失败，原存档备份已保留。');
  localStorage.setItem(marker, committed.saveMetadata.id);
  await send({ kind: 'imported', backupId, saveText: localStorage.getItem(primaryKey) });
  message.textContent = '中秋故事已开启，正在进入游戏…';
  location.replace('/#midautumn');
}

void importPreview().catch((error) => { message.textContent = `未能完成导入：${error instanceof Error ? error.message : String(error)}`; });
