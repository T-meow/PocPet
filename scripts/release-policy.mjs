export const getReleaseBuildPlan = ({ eventName, ref, manualFullBuild = false }) => {
  const publishRelease = eventName === 'push' && /^refs\/tags\/v\d+\.\d+\.\d+$/.test(ref || '');
  const manual = eventName === 'workflow_dispatch';
  return {
    publishRelease,
    releaseBuild: publishRelease || manual,
    fullBuild: publishRelease || (manual && manualFullBuild),
  };
};

export const releaseArtifactNames = (version, fullBuild = true) => {
  const names = [`pocket${version}.exe`, `pocket${version}.apk`];
  if (fullBuild) names.push(
    `pocket${version}-win32.exe`, `pocket${version}-32bit.apk`, `pocket${version}-web.zip`,
    `pocket${version}-mac.dmg`, `pocket${version}-ubuntu.AppImage`, `pocket${version}-ubuntu.deb`,
  );
  return names;
};
