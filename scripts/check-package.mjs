import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { backupArtifact, canCreateAndroidSymlink, createPlan, selectTypes, versionUpdates } from './package.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const metadataFiles = ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
const cli = (...args) => spawnSync(process.execPath, [join(root, 'scripts/package.mjs'), ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
const fixture = (t) => {
  const base = resolve(tmpdir());
  const directory = mkdtempSync(join(base, 'pocpet-package-test-'));
  t.after(() => {
    assert.equal(dirname(directory), base, 'Only remove this test-owned temporary directory');
    assert.ok(relative(base, directory).startsWith('pocpet-package-test-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
};

test('default/full never include web, Toy or 32-bit; explicit choices are deduplicated', () => {
  for (const value of ['default', 'full', 'all', '1']) assert.deepEqual(selectTypes([value]), ['windows', 'android']);
  assert.deepEqual(selectTypes(['bilibili，TOY']), ['toy']);
  assert.deepEqual(selectTypes(['android,win', 'windows', 'apk']), ['windows', 'android']);
  assert.deepEqual(selectTypes(['windows-x86,android-armv7']), ['windows-x86', 'android-armv7']);
  for (const value of ['', '0', '8', 'unknown', 'toy;echo hello']) assert.throws(() => selectTypes([value]));
  assert.throws(() => createPlan(['toy'], '../1.9.0'));
});

test('Toy-only plan builds and checks Toy assets without invoking native or standard builds', () => {
  const plan = createPlan(selectTypes(['toy']), '1.9.0');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].artifact, 'release/pocket1.9.0-toy.zip');
  assert.equal(plan[0].edition, 'bilibili');
  assert.equal(plan[0].dist, 'dist-toy');
  assert.ok(plan[0].commands.some((command) => command.npm === 'build:toy'));
  assert.ok(plan[0].commands.some((command) => command.npm === 'check:toy'));
  assert.ok(plan[0].commands.every((command) => !command.npm || ['build:toy', 'check:toy'].includes(command.npm)));
  assert.ok(plan[0].commands.some((command) => command.node?.includes('scripts/check-release.mjs')));
  assert.deepEqual(plan[0].commands.at(-1).node.slice(1), ['dist-toy', 'release/pocket1.9.0-toy.zip']);
});

test('version synchronization preserves dependency versions, comments and CRLF and is read-only until applied', (t) => {
  const directory = fixture(t);
  mkdirSync(join(directory, 'src-tauri'));
  const json = (value) => JSON.stringify(value, null, 2).replace(/\n/g, '\r\n') + '\r\n';
  const input = {
    'package-lock.json': json({ version: '1.8.0', packages: { '': { name: 'pocpet', version: '1.8.0' }, 'node_modules/example': { version: '1.8.0', integrity: 'unchanged' } } }),
    'src-tauri/tauri.conf.json': json({ version: '1.8.0', identifier: 'com.frostforge.pocpet', build: { frontendDist: '../dist' } }),
    'src-tauri/Cargo.toml': '[package]\r\nname = "app"\r\nversion = "1.8.0" # keep comment\r\n\r\n[dependencies]\r\nexample = "1.8.0"\r\n',
    'src-tauri/Cargo.lock': '# Generated lockfile\r\nversion = 3\r\n\r\n[[package]]\r\nname = "app"\r\nversion = "1.8.0"\r\ndependencies = ["example"]\r\n\r\n[[package]]\r\nname = "example"\r\nversion = "1.8.0"\r\nsource = "registry+https://example.invalid"\r\n',
  };
  for (const [file, content] of Object.entries(input)) writeFileSync(join(directory, file), content);
  const updates = versionUpdates(directory, '12.10.3');
  assert.equal(updates.length, 4);
  for (const { file, before, after } of updates) {
    assert.equal(readFileSync(join(directory, file), 'utf8'), input[file]);
    assert.equal(before, input[file]);
    assert.equal(after.replace(/\r\n/g, '').includes('\n'), false);
  }
  const output = Object.fromEntries(updates.map(({ file, after }) => [file, after]));
  const lock = JSON.parse(output['package-lock.json']);
  assert.equal(lock.version, '12.10.3');
  assert.equal(lock.packages[''].version, '12.10.3');
  assert.deepEqual(lock.packages['node_modules/example'], JSON.parse(input['package-lock.json']).packages['node_modules/example']);
  assert.equal(JSON.parse(output['src-tauri/tauri.conf.json']).identifier, 'com.frostforge.pocpet');
  assert.equal(output['src-tauri/Cargo.toml'], input['src-tauri/Cargo.toml'].replace('version = "1.8.0"', 'version = "12.10.3"'));
  assert.equal(output['src-tauri/Cargo.lock'], input['src-tauri/Cargo.lock'].replace('version = "1.8.0"', 'version = "12.10.3"'));
  for (const { file, after } of updates) writeFileSync(join(directory, file), after);
  assert.deepEqual(versionUpdates(directory, '12.10.3'), []);
  writeFileSync(join(directory, 'src-tauri/Cargo.lock'), 'version = 3\n');
  assert.throws(() => versionUpdates(directory, '12.10.3'), /Cargo.lock/);
});

test('backup preserves original bytes and refuses to overwrite an existing backup', (t) => {
  const directory = fixture(t);
  const file = join(directory, 'pocket1.9.0-toy.zip');
  const destination = join(directory, 'backups', 'run');
  assert.equal(backupArtifact(file, destination), undefined);
  assert.equal(existsSync(destination), false);
  const original = Buffer.from([0, 255, 13, 10, 42, 127]);
  writeFileSync(file, original);
  const backup = backupArtifact(file, destination);
  assert.equal(backup.bytes, original.length);
  assert.equal(backup.sha256, createHash('sha256').update(original).digest('hex').toUpperCase());
  assert.deepEqual(readFileSync(backup.path), original);
  assert.deepEqual(readFileSync(file), original);
  writeFileSync(file, 'new output');
  assert.throws(() => backupArtifact(file, destination), { code: 'EEXIST' });
  assert.deepEqual(readFileSync(backup.path), original);
});

test('Android permission errors select native copying; unrelated errors still fail and probes are removed', () => {
  let probe;
  const attempt = (code) => (target, link) => {
    probe = dirname(target);
    assert.equal(readFileSync(target, 'utf8'), 'probe');
    if (code) throw Object.assign(new Error(code), { code });
    copyFileSync(target, link);
  };
  assert.equal(canCreateAndroidSymlink(attempt()), true);
  assert.equal(existsSync(probe), false);
  for (const code of ['EPERM', 'EACCES']) {
    assert.equal(canCreateAndroidSymlink(attempt(code)), false);
    assert.equal(existsSync(probe), false);
  }
  assert.throws(() => canCreateAndroidSymlink(attempt('ENOSPC')), { code: 'ENOSPC' });
  assert.equal(existsSync(probe), false);
});

test('real CLI previews leave version files and release outputs untouched; invalid requests fail', () => {
  const versions = () => metadataFiles.map((file) => readFileSync(join(root, file), 'utf8'));
  const releaseSnapshot = () => existsSync(join(root, 'release')) ? readdirSync(join(root, 'release')).sort().map((name) => {
    const info = statSync(join(root, 'release', name));
    return [name, info.size, info.mtimeMs];
  }) : [];
  const beforeVersions = versions();
  const beforeRelease = releaseSnapshot();
  for (const [type, expected] of [['toy', ['toy']], ['full', ['windows', 'android']], ['web,android-armv7', ['android-armv7', 'web']]]) {
    const result = cli('--type', type, '--dry-run', '--json');
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.deepEqual(plan.targets.map((item) => item.type), expected);
    assert.equal(plan.source, 'current-worktree');
    assert.equal(typeof plan.dirty, 'boolean');
    assert.match(plan.revision, /^[a-f0-9]{40,64}$/);
    if (type === 'toy' && plan.dirty) assert.notEqual(cli('--type', 'toy', '--dry-run', '--require-clean').status, 0);
  }
  for (const args of [[], ['--type', 'typo'], ['--type', 'toy', '--json'], ['--unexpected']]) {
    const result = cli(...args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /打包失败/);
  }
  assert.deepEqual(versions(), beforeVersions);
  assert.deepEqual(releaseSnapshot(), beforeRelease);
});
