import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const { version, pocpetRelease } = JSON.parse(readFileSync('package.json', 'utf8'));
const directory = process.argv[2] || 'release';
const expected = [`pocket${version}.exe`, `pocket${version}.apk`];
if (version.endsWith('.0') || pocpetRelease?.fullBuildVersions?.includes(version) || process.env.FULL_BUILD === 'true') expected.push(
  `pocket${version}-win32.exe`, `pocket${version}-32bit.apk`, `pocket${version}-web.zip`,
  `pocket${version}-mac.dmg`, `pocket${version}-ubuntu.AppImage`, `pocket${version}-ubuntu.deb`,
);
const actual = readdirSync(directory).sort();
assert.deepEqual(actual, expected.sort(), 'Release artifacts must match the required platform set.');
for (const file of actual) assert.ok(statSync(join(directory, file)).size > 0, `Empty artifact: ${file}`);
console.log(`Verified ${actual.length} release artifacts for ${version}.`);
