import assert from 'node:assert/strict';
import { getReleaseBuildPlan, releaseArtifactNames } from './release-policy.mjs';

const validationOnly = { publishRelease: false, releaseBuild: false, fullBuild: false };
for (const version of ['1.6.1', '1.8.0', '1.8.1', '1.8.2', '2.0.0']) {
  const ref = `refs/tags/v${version}`;
  const plan = getReleaseBuildPlan({ eventName: 'push', ref });
  assert.deepEqual(plan, { publishRelease: true, releaseBuild: true, fullBuild: true }, `${version} must publish every platform`);
  assert.deepEqual(releaseArtifactNames(version, plan.fullBuild).sort(), [
    `pocket${version}.exe`, `pocket${version}-win32.exe`,
    `pocket${version}.apk`, `pocket${version}-32bit.apk`,
    `pocket${version}-web.zip`, `pocket${version}-mac.dmg`,
    `pocket${version}-ubuntu.AppImage`, `pocket${version}-ubuntu.deb`,
  ].sort());
  assert.equal(releaseArtifactNames(version).length, 8, 'Release validation defaults to the complete artifact set');
  assert.deepEqual(getReleaseBuildPlan({ eventName: 'push', ref: `refs/heads/release/${version}` }), validationOnly);
  assert.deepEqual(getReleaseBuildPlan({ eventName: 'pull_request', ref }), validationOnly);
  for (const manualFullBuild of [false, true]) {
    const manual = getReleaseBuildPlan({ eventName: 'workflow_dispatch', ref, manualFullBuild });
    assert.deepEqual(manual, { publishRelease: false, releaseBuild: true, fullBuild: manualFullBuild });
    assert.equal(releaseArtifactNames(version, manual.fullBuild).length, manualFullBuild ? 8 : 2);
  }
}
assert.deepEqual(getReleaseBuildPlan({}), validationOnly, 'Local checks never publish');
assert.deepEqual(getReleaseBuildPlan({ eventName: 'push', ref: 'refs/heads/main', manualFullBuild: true }), validationOnly);
assert.deepEqual(getReleaseBuildPlan({ eventName: 'push', ref: 'refs/tags/v1.8.1-beta' }), validationOnly);
console.log('Release policy passed: all stable tags publish eight artifacts; branch/PR checks and manual test builds stay separate.');
