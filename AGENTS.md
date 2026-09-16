# PocPet Agent Rules

## 语言与生图

- 日常功能先接中文，英文界面可回退中文并保留已有翻译；英文 i18n 仅随 1.9.0 这类大版本统一补充，不为翻译升版本。
- `gpt-image-2.5-sunburst` 生图／编辑默认 `quality: "medium"`，用户指定优先；正式请求与 dry_run 参数一致，历史质量记录不改。流程见 `docs/美术规范与作图流程.md`。

## 发布规则

- 明确要求推送、发布或更新时，按授权范围直接完成，不重复确认，不按版本大小、尾号或白名单设限；仅改代码／本地测试不自动推送或发布。
- 正式标签为与 `package.json` 一致的 `v<version>`；所有正式标签均触发 CI 全平台构建、GitHub Release、客户端更新清单及网页部署。
- GitHub 推送成功即反馈；仅在用户明确要求跟进构建或获取产物时等待／轮询 CI。
- 单独部署 GitHub Pages：`pages.yml` 使用 `source=main`，指定推送后的版本与提交，独立执行、不等原生打包；正式 Release 网页使用默认 `source=release`。

## 打包规则

- 版本以 `package.json` 为准，打包前核对并同步 Tauri、Cargo 版本。
- 本地默认仅 Windows x64、Android arm64 测试包；“全量／完整包”同此范围，不随版本变化。32 位仅按明确要求生成；本地不构建 Web、macOS、Linux，也不自动启动 CI。
- 本地顺序：核对版本 → `npm.cmd run check:release` → 备份同名产物 → `npm.cmd run package:win:portable` → `npm.cmd run package:android:arm64` → 核验版本、架构、内嵌资源、APK 签名，记录大小及 SHA-256。
- CI 遵循 `.github/workflows/release.yml`；手动构建默认 Windows x64、Android arm64，显式 `full_build` 才全量，手动构建不公开 Release。macOS／Linux 在对应系统或 CI runner 构建。
- Android 测试包默认 debug keystore 签名；正式商店签名须用户明确要求。
- 产物不提交 Git，统一命名为 `release/pocket<version><后缀>`；本地及 CI 使用下表：

| 平台／架构 | 后缀 |
|---|---|
| Windows x64／x86（32 位） | `.exe`／`-win32.exe` |
| Android arm64／ARMv7（`armeabi-v7a`） | `.apk`／`-32bit.apk` |
| Web | `-web.zip` |
| macOS 图形桌面包 | `-mac.dmg` |
| Ubuntu／Linux 图形桌面包 | 优先 `-ubuntu.AppImage`，CI/runner 支持时也保留 `-ubuntu.deb` |
