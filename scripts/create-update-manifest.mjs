import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const createUpdateManifest = (version, revision, files, macArch) => {
  const names = {
    'windows-x86_64': `pocket${version}.exe`,
    'windows-x86': `pocket${version}-win32.exe`,
    'android-aarch64': `pocket${version}.apk`,
    'android-arm': `pocket${version}-32bit.apk`,
    'linux-x86_64': `pocket${version}-ubuntu.AppImage`,
  };
  const macName = `pocket${version}-mac.dmg`;
  if (files.some((file) => file.name === macName)) {
    if (!['x64', 'arm64'].includes(macArch)) throw new Error('Missing macOS build architecture');
    names[`macos-${macArch === 'arm64' ? 'aarch64' : 'x86_64'}`] = macName;
  }
  const platforms = {};
  for (const [target, name] of Object.entries(names)) {
    const file = files.find((item) => item.name === name);
    if (file) {
      if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error(`Empty update artifact: ${name}`);
      platforms[target] = { asset: name, size: file.size };
    }
  }
  if (!platforms['windows-x86_64'] || !platforms['android-aarch64']) throw new Error('Required update artifacts are missing');
  return { version, revision, edition: 'standard', platforms };
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const directory = process.argv[2] || 'dist-release';
  const files = readdirSync(directory).map((name) => ({ name, size: statSync(join(directory, name)).size }));
  const manifest = createUpdateManifest(version, process.env.GITHUB_SHA, files, process.env.MAC_ARCH);
  writeFileSync(join(directory, 'update-info.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Generated update manifest for ${Object.keys(manifest.platforms).length} targets.`);
}
