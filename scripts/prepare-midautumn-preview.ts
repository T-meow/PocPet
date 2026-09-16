import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createMidautumnPreview } from './fixtures/midautumn-preview';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { getMidautumnRun } from '../src/core/festivalStories';

const origin = 'http://127.0.0.1:5173';
const token = randomUUID();
const directory = resolve('output/dev-previews', `midautumn-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(directory, { recursive: true });
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const fixture = createSaveFileText(createMidautumnPreview());
await writeFile(resolve(directory, 'midautumn-unlocked.pocpet'), fixture, 'utf8');
let backupId = '';
let imported = false;
const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Preview-Token');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.headers.origin !== origin) { response.writeHead(403).end('{}'); return; }
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
  if (request.method !== 'POST' || request.headers['x-preview-token'] !== token || imported) { response.writeHead(403).end('{}'); return; }
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16 * 1024 * 1024) throw new Error('Preview backup exceeds 16 MiB.');
      chunks.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (payload.kind === 'backup' && !backupId) {
      const primary = payload.before?.['pocpet.pet.v1'];
      if (primary !== null && typeof primary !== 'string') throw new Error('Missing original save.');
      const snapshot = JSON.stringify({ origin, capturedAt: new Date().toISOString(), before: payload.before, identity: payload.identity }, null, 2) + '\n';
      backupId = sha256(snapshot);
      await writeFile(resolve(directory, 'before-preview.json'), snapshot, { encoding: 'utf8', flag: 'wx' });
      if (primary !== null) await writeFile(resolve(directory, 'before-preview.pocpet'), primary, { encoding: 'utf8', flag: 'wx' });
      if (sha256(await readFile(resolve(directory, 'before-preview.json'), 'utf8')) !== backupId) throw new Error('Backup verification failed.');
      response.end(JSON.stringify({ backupId }));
      console.log(JSON.stringify({ status: 'backed-up', directory, hasOriginalSave: primary !== null, backupSha256: backupId }));
    } else if (payload.kind === 'imported' && backupId && payload.backupId === backupId) {
      const save = parseSaveFileText(payload.saveText);
      const year = new Date().getFullYear();
      const run = getMidautumnRun(save.pet, year);
      if (run?.stage !== 'flavour' || !save.pet.kitchen.equipment.includes('oven')) throw new Error('Imported fixture does not match the requested preview.');
      await writeFile(resolve(directory, 'imported-preview.pocpet'), payload.saveText, { encoding: 'utf8', flag: 'wx' });
      const status = { status: 'imported', origin, importedAt: new Date().toISOString(), runId: run.id, stage: run.stage, actorName: run.actorName, saveId: save.pet.saveMetadata.id, backupSha256: backupId, importedSha256: sha256(payload.saveText), directory };
      await writeFile(resolve(directory, 'status.json'), JSON.stringify(status, null, 2) + '\n', 'utf8');
      imported = true;
      response.end(JSON.stringify({ backupId }));
      console.log(JSON.stringify(status));
      server.close();
    } else throw new Error('Unexpected preview import request.');
  } catch (error) {
    response.writeHead(400).end(JSON.stringify({ error: String(error) }));
    console.error(String(error));
  }
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const port = (server.address() as { port: number }).port;
const config = { origin, endpoint: `http://127.0.0.1:${port}/`, token };
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>中秋剧情预览</title></head><body><main><h1>中秋剧情预览</h1><p id="preview-message">正在准备存档…</p></main><script id="preview-config" type="application/json">${JSON.stringify(config)}</script><script type="module" src="/scripts/dev-preview-import.ts"></script></body></html>`;
await writeFile(resolve(directory, 'import.html'), html, 'utf8');
const url = `${origin}/${directory.slice(process.cwd().length + 1).replaceAll('\\', '/')}/import.html`;
await writeFile(resolve(directory, 'session.json'), JSON.stringify({ url, directory, token, fixtureSha256: sha256(fixture) }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status: 'ready', url, directory, fixtureBytes: Buffer.byteLength(fixture), fixtureSha256: sha256(fixture) }));
