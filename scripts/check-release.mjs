import assert from 'node:assert/strict';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  dist: { type: 'string' }, edition: { type: 'string', default: 'standard' },
  binary: { type: 'string' }, arch: { type: 'string' }, metadata: { type: 'boolean' },
} });
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const project = json('package.json');
const version = project.version;
assert.match(version, /^\d+\.\d+\.\d+$/, 'Release version must be major.minor.patch.');
assert.equal(json('package-lock.json').version, version, 'package-lock version mismatch');
assert.equal(json('package-lock.json').packages[''].version, version, 'package-lock root version mismatch');
assert.equal(json('src-tauri/tauri.conf.json').version, version, 'Tauri version mismatch');
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--manifest-path', 'src-tauri/Cargo.toml', '--no-deps', '--locked', '--format-version', '1'], { encoding: 'utf8' }));
assert.equal(metadata.packages.find((item) => item.name === 'app').version, version, 'Cargo version mismatch');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (process.env.GITHUB_SHA) assert.equal(process.env.GITHUB_SHA, revision, 'Build checkout does not match the triggering commit');
const isTag = (process.env.GITHUB_REF || '').startsWith('refs/tags/');
if (isTag) assert.equal(process.env.GITHUB_REF, `refs/tags/v${version}`, 'Git tag does not match package.json');
if (values.metadata && process.env.GITHUB_OUTPUT) {
  const full = version.endsWith('.0') || project.pocpetRelease?.fullBuildVersions?.includes(version) || process.env.MANUAL_FULL_BUILD === 'true';
  const publish = isTag && process.env.GITHUB_EVENT_NAME === 'push';
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nrevision=${revision}\nfull_build=${full}\nrelease_build=${publish || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'}\npublish_release=${publish}\n`);
}
let assets = [];
if (values.dist) {
  const build = json(join(values.dist, 'build-info.json'));
  assert.equal(build.version, version);
  assert.equal(build.edition, values.edition);
  assert.equal(build.revision, revision);
  const index = readFileSync(join(values.dist, 'index.html'), 'utf8');
  assert.equal(index.includes('toy-sdk.js'), values.edition === 'bilibili', 'Wrong SDK in frontend output');
  const manifest = json(join(values.dist, 'asset-manifest.json'));
  assets = [...new Set(Object.values(manifest).flatMap((entry) => [entry.file, ...(entry.css || []), ...(entry.assets || [])]))];
  for (const asset of assets) assert.ok(existsSync(join(values.dist, asset)), `Missing asset: ${asset}`);
  for (const entry of Object.values(manifest).filter((entry) => entry.isEntry)) assert.ok(index.includes(entry.file), 'Stale index.html');
}
if (values.binary) {
  assert.ok(values.dist && values.edition === 'standard', 'Native binaries must contain the standard edition.');
  let binary = readFileSync(resolve(values.binary));
  if (values.binary.endsWith('.apk')) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(binary);
    const abi = values.arch === 'arm64' ? 'arm64-v8a' : 'armeabi-v7a';
    const library = zip.file(`lib/${abi}/libapp_lib.so`);
    assert.ok(library, `APK is missing ${abi}`);
    binary = await library.async('nodebuffer');
  }
  if (binary.subarray(0, 2).toString() === 'MZ') {
    assert.equal(binary.readUInt16LE(binary.readUInt32LE(0x3c) + 4), values.arch === 'x86' ? 0x14c : 0x8664, 'Wrong PE architecture');
  } else if (binary.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    assert.equal(binary.readUInt16LE(18), { arm64: 183, armv7: 40, x64: 62 }[values.arch], 'Wrong ELF architecture');
  } else {
    assert.equal(binary.readUInt32LE(0), 0xfeedfacf, 'Expected a native 64-bit Mach-O binary');
    assert.equal(binary.readUInt32LE(4), values.arch === 'arm64' ? 0x0100000c : 0x01000007, 'Wrong Mach-O architecture');
  }
  for (const asset of assets.filter((name) => /\.(js|css)$/.test(name))) {
    assert.ok(binary.includes(Buffer.from(asset)), `Native binary contains stale frontend assets: ${asset}`);
  }
}
console.log(`Release check passed: ${version}, ${values.edition}, ${revision.slice(0, 8)}`);
