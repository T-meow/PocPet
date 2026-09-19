import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = (script) => ({ npm: script });
const node = (...args) => ({ node: args });
export const packageTypes = {
  windows: { label: 'Windows x64 便携版', suffix: '.exe', windowsOnly: true, commands: [npm('package:win:portable')] },
  android: { label: 'Android arm64 测试签名 APK', suffix: '.apk', windowsOnly: true, commands: [npm('package:android:arm64')] },
  'windows-x86': { label: 'Windows 32 位便携版', suffix: '-win32.exe', windowsOnly: true, commands: [npm('package:win:portable:x86')] },
  'android-armv7': { label: 'Android ARMv7 测试签名 APK', suffix: '-32bit.apk', windowsOnly: true, commands: [npm('package:android:armv7')] },
  toy: { label: 'B 站 Toy ZIP', suffix: '-toy.zip', dist: 'dist-toy', edition: 'bilibili', commands: [npm('build:toy'), npm('check:toy'), node('scripts/check-release.mjs', '--dist', 'dist-toy', '--edition', 'bilibili')] },
  web: { label: '普通网页版 ZIP', suffix: '-web.zip', dist: 'dist', edition: 'standard', commands: [npm('build'), node('scripts/check-release.mjs', '--dist', 'dist')] },
};
const aliases = { default: ['windows', 'android'], full: ['windows', 'android'], all: ['windows', 'android'], win: ['windows'], apk: ['android'], bilibili: ['toy'] };
const menu = ['default', ...Object.keys(packageTypes)];

export const selectTypes = (values) => {
  const selected = new Set();
  for (const token of values.flatMap((value) => value.toLowerCase().split(/[\s,，]+/)).filter(Boolean)) {
    const key = /^\d+$/.test(token) ? menu[Number(token) - 1] : token;
    for (const type of aliases[key] ?? [key]) {
      if (!packageTypes[type]) throw new Error(`未知打包类型：${token}。使用 --help 查看选项。`);
      selected.add(type);
    }
  }
  if (!selected.size) throw new Error('请选择至少一种打包类型。');
  return Object.keys(packageTypes).filter((type) => selected.has(type));
};

export const createPlan = (types, version) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('package.json 版本必须是 major.minor.patch。');
  return types.map((type) => {
    const definition = packageTypes[type];
    if (!definition) throw new Error(`未知打包类型：${type}`);
    const artifact = `release/pocket${version}${definition.suffix}`;
    return { type, ...definition, artifact, commands: [...definition.commands, ...(definition.dist ? [node('scripts/package-web.mjs', definition.dist, artifact)] : [])] };
  });
};

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const jsonText = (value, original) => {
  const indent = original.match(/\n([ \t]+)"/)?.[1] ?? '  ';
  const text = JSON.stringify(value, null, indent) + '\n';
  return (original.startsWith('\uFEFF') ? '\uFEFF' : '') + (original.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text);
};
export const versionUpdates = (directory, version) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('版本必须是 major.minor.patch。');
  const updates = [];
  const record = (file, before, after) => { if (before !== after) updates.push({ file, before, after }); };
  for (const file of ['package-lock.json', 'src-tauri/tauri.conf.json']) {
    const before = readFileSync(join(directory, file), 'utf8');
    const value = JSON.parse(before.replace(/^\uFEFF/, ''));
    const changed = value.version !== version || (file === 'package-lock.json' && value.packages?.['']?.version !== version);
    value.version = version;
    if (file === 'package-lock.json') {
      if (!value.packages?.['']) throw new Error('package-lock.json 缺少根包信息。');
      value.packages[''].version = version;
    }
    if (changed) record(file, before, jsonText(value, before));
  }
  const cargo = readFileSync(join(directory, 'src-tauri/Cargo.toml'), 'utf8');
  const section = cargo.match(/^\[package\][\s\S]*?(?=^\[|$(?![\s\S]))/m)?.[0];
  const name = section?.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
  if (!name || !/^version\s*=\s*"[^"]+"/m.test(section)) throw new Error('Cargo.toml 缺少 package name/version。');
  const replaceVersion = (text) => text.replace(/^(version\s*=\s*")[^"]+(".*)$/m, (_, prefix, suffix) => prefix + version + suffix);
  const updated = replaceVersion(section);
  record('src-tauri/Cargo.toml', cargo, cargo.replace(section, updated));
  const lock = readFileSync(join(directory, 'src-tauri/Cargo.lock'), 'utf8');
  const blocks = lock.match(/^\[\[package\]\][\s\S]*?(?=^\[\[package\]\]|$(?![\s\S]))/gm) ?? [];
  const app = blocks.filter((block) => block.match(/^name\s*=\s*"([^"]+)"/m)?.[1] === name && !/^source\s*=/m.test(block));
  if (app.length !== 1 || !/^version\s*=\s*"[^"]+"/m.test(app[0])) throw new Error('Cargo.lock 中无法唯一定位本项目包。');
  record('src-tauri/Cargo.lock', lock, lock.replace(app[0], replaceVersion(app[0])));
  return updates;
};

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').toUpperCase();
export const backupArtifact = (file, backupDirectory) => {
  if (!existsSync(file)) return undefined;
  mkdirSync(backupDirectory, { recursive: true });
  const destination = join(backupDirectory, file.split(/[\\/]/).at(-1));
  copyFileSync(file, destination, constants.COPYFILE_EXCL);
  const hash = sha256(file);
  if (sha256(destination) !== hash) throw new Error(`旧包备份校验失败：${destination}`);
  return { path: destination, bytes: statSync(destination).size, sha256: hash };
};
const formatCommand = (command) => command.npm ? `npm.cmd run ${command.npm}` : `node ${command.node.join(' ')}`;
const run = (executable, args, env, capture = false) => {
  const result = spawnSync(executable, args, { cwd: root, env, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} 失败（${result.status ?? result.signal}）${capture ? `：${result.stderr || result.stdout}` : ''}`);
  return result.stdout?.trim() ?? '';
};
const runCommand = (command, env) => {
  console.log(`\n> ${formatCommand(command)}`);
  if (command.node) return run(process.execPath, command.node, env);
  const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (existsSync(npmCli)) return run(process.execPath, [npmCli, 'run', command.npm], env);
  // Only fixed script names from packageTypes reach cmd.exe; no user text is interpolated.
  return process.platform === 'win32'
    ? run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${command.npm}`], env)
    : run('npm', ['run', command.npm], env);
};

export const canCreateAndroidSymlink = (createLink = symlinkSync) => {
  const probe = mkdtempSync(join(tmpdir(), 'pocpet-package-symlink-'));
  const target = join(probe, 'target');
  const link = join(probe, 'link');
  try {
    writeFileSync(target, 'probe');
    createLink(target, link, 'file');
    return true;
  } catch (error) {
    if (['EPERM', 'EACCES'].includes(error.code)) return false;
    throw error;
  } finally {
    if (existsSync(link)) unlinkSync(link);
    if (existsSync(target)) unlinkSync(target);
    rmdirSync(probe);
  }
};

const preflight = (plan) => {
  if (process.platform !== 'win32' && plan.some((item) => item.windowsOnly)) throw new Error('当前原生打包脚本需要 Windows；macOS/Linux 请使用对应系统或项目 CI。');
  if (!existsSync(join(root, 'node_modules/typescript/package.json'))) throw new Error('缺少项目依赖，请先执行 npm.cmd ci --registry=https://registry.npmmirror.com/');
  const env = { ...process.env, npm_config_registry: 'https://registry.npmmirror.com/' };
  if (process.platform === 'win32') {
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'Path';
    const cargoBin = join(env.USERPROFILE || '', '.cargo/bin');
    env[pathKey] = `${cargoBin};${env[pathKey] || ''}`;
    if (plan.some((item) => item.type.startsWith('android'))) {
      const java = [env.JAVA_HOME, join(env.ProgramFiles || 'C:/Program Files', 'Android/Android Studio/jbr')].find((file) => file && existsSync(join(file, 'bin/java.exe')));
      const sdk = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Android/Sdk')].find((file) => file && existsSync(join(file, 'build-tools')));
      if (!java || !sdk) throw new Error('Android 需要 JDK 和 SDK build-tools；请设置 JAVA_HOME、ANDROID_HOME。');
      env.JAVA_HOME = java;
      env.ANDROID_HOME = env.ANDROID_SDK_ROOT = sdk;
      env[pathKey] = `${join(java, 'bin')};${env[pathKey]}`;
      if (!canCreateAndroidSymlink()) {
        env.POCPET_ANDROID_COPY_NATIVE = '1';
        console.log('Android：无符号链接权限，将通过 NDK/Cargo 重编译当前源码并复制原生库。');
      }
    }
  }
  run('cargo', ['--version'], env, true);
  return env;
};

const verifyArchive = async (item, version, revision) => {
  if (!item.dist) return;
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(readFileSync(join(root, item.artifact)), { checkCRC32: true });
  const info = JSON.parse(await zip.file('build-info.json')?.async('string') ?? 'null');
  if (info?.version !== version || info?.revision !== revision || info?.edition !== item.edition) throw new Error('ZIP 内构建信息不匹配。');
  const index = await zip.file('index.html')?.async('string');
  if (!index || index.includes('toy-sdk.js') !== (item.edition === 'bilibili')) throw new Error('ZIP 入口或 Toy SDK 不匹配。');
  const assets = JSON.parse(await zip.file('asset-manifest.json')?.async('string') ?? 'null');
  if (!assets) throw new Error('ZIP 缺少资源清单。');
  for (const entry of Object.values(assets)) {
    for (const file of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
      if (!zip.file(file)) throw new Error(`ZIP 缺少资源：${file}`);
    }
  }
};

const help = () => console.log(`PocPet 统一打包（不提交 Git，不发布）
  npm.cmd run package                             交互选择，支持逗号分隔多选
  npm.cmd run package -- --type toy                仅 B 站 Toy
  npm.cmd run package -- --type windows,android    Windows x64 + Android arm64
  npm.cmd run package -- --type full               同上；不包含 Web 或 32 位
  npm.cmd run package -- --type web                仅普通 Web
  npm.cmd run package -- --type windows-x86,android-armv7
  npm.cmd run package -- --type toy --dry-run      预览计划，不写文件、不构建
  npm.cmd run package -- --type toy --dry-run --json
  npm.cmd run package -- --type toy --require-clean 拒绝含未提交文件的工作区
  --list 列出类型；--help 显示帮助。可重复 --type。
默认按当前工作区打包，包含未提交代码；版本以 package.json 为准。`);

export const main = async (argv = process.argv.slice(2)) => {
  const { values } = parseArgs({ args: argv, options: {
    type: { type: 'string', multiple: true }, 'dry-run': { type: 'boolean' }, json: { type: 'boolean' },
    'require-clean': { type: 'boolean' }, list: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) return help();
  if (values.list) return console.log(menu.map((key, index) => `${index + 1}. ${key}: ${key === 'default' ? '完整测试包（Windows x64 + Android arm64）' : packageTypes[key].label}`).join('\n'));
  if (values.json && !values['dry-run']) throw new Error('--json 仅用于 --dry-run。');
  let requested = values.type;
  if (!requested) {
    if (!process.stdin.isTTY) throw new Error('非交互环境请使用 --type 明确选择类型；--dry-run 可预览。');
    await main(['--list']);
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    try { requested = [await reader.question('输入编号或类型，逗号多选（回车=1，q=退出）：') || 'default']; }
    finally { reader.close(); }
    if (requested[0].trim().toLowerCase() === 'q') return;
  }
  const types = selectTypes(requested);
  const { version } = readJson(join(root, 'package.json'));
  const plan = createPlan(types, version);
  const updates = versionUpdates(root, version);
  const revision = run('git', ['rev-parse', 'HEAD'], process.env, true);
  const status = run('git', ['status', '--porcelain', '--untracked-files=all'], process.env, true);
  if (values['require-clean'] && status) throw new Error('工作区有未提交改动；--require-clean 已阻止打包。');
  const preview = { version, revision, dirty: Boolean(status), source: 'current-worktree', versionUpdates: updates.map((item) => item.file), checks: ['npm.cmd run check:release'], targets: plan };
  if (values.json) return console.log(JSON.stringify(preview, null, 2));
  console.log(`版本：${version}；源码：${revision.slice(0, 8)}${status ? ' + 当前未提交改动' : '（干净工作区）'}`);
  console.log(`选择：${plan.map((item) => item.label).join('、')}`);
  console.log(`版本同步：${updates.length ? updates.map((item) => item.file).join('、') : '已一致'}`);
  console.log('流程：环境检查 → 版本同步 → check:release → 备份旧包 → 顺序构建并校验 → 大小/SHA-256/构建记录');
  for (const item of plan) console.log(`\n${item.artifact}\n${item.commands.map((command) => `  ${formatCommand(command)}`).join('\n')}`);
  if (values['dry-run']) return;

  const env = preflight(plan);
  for (const item of updates) writeFileSync(join(root, item.file), item.after);
  runCommand(npm('check:release'), env);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + `-${process.pid}`;
  const backupDirectory = join(root, 'release/backups', stamp);
  const reportFile = join(root, `release/package-${version}-${stamp}.json`);
  const report = { ...preview, startedAt: new Date().toISOString(), workspaceStatus: status, versionUpdates: updates.map((item) => item.file), status: 'running', artifacts: [] };
  mkdirSync(join(root, 'release'), { recursive: true });
  const writeReport = () => writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  try {
    writeReport();
    for (const item of plan) {
      report.currentType = item.type;
      const file = join(root, item.artifact);
      const previous = backupArtifact(file, backupDirectory);
      report.artifacts.push({ type: item.type, file, previous, status: 'building' });
      writeReport();
      for (const command of item.commands) runCommand(command, env);
      await verifyArchive(item, version, revision);
      const bytes = statSync(file).size;
      if (!bytes) throw new Error(`产物为空：${file}`);
      const artifact = { type: item.type, file, previous, status: 'verified', bytes, sha256: sha256(file) };
      report.artifacts[report.artifacts.length - 1] = artifact;
      writeReport();
      console.log(`\n完成：${file}\n大小：${bytes} 字节\nSHA-256：${artifact.sha256}`);
    }
    report.status = 'complete';
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    const artifact = report.artifacts.at(-1);
    if (artifact?.status === 'building') {
      artifact.status = 'failed';
      artifact.error = error.message;
    }
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    writeReport();
    console.log(`构建记录：${reportFile}`);
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`打包失败：${error.message}`); process.exitCode = 1; });
}
