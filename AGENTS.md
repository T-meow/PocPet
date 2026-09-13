# PocPet Agent Rules

## 发布规则

- 发布依据用户的明确指令，不按“大版本／小版本”、版本尾号或版本白名单限制发布。
- 用户明确要求推送、发布或更新时，按指定范围直接完成；已有授权不重复确认，小版本同样可以发布。仅要求修改代码或本地测试时，不自动推送或发布。
- 正式发布使用与 `package.json` 一致的 `v<version>` 标签；所有正式版本标签均触发 CI 全平台构建、GitHub Release、客户端更新清单和对应网页部署，小版本与其他版本使用同一流程。
- 推送 GitHub 远端时，确认推送成功后即可反馈结果，无需等待远端 CI 打包完成，也不自动轮询等待；只有用户明确要求跟进构建结果或获取产物时，才继续处理对应远端任务。
- 单独要求部署 GitHub Pages 时，使用 `pages.yml` 的 `source=main` 并指定推送后的版本和提交；网页构建／部署独立执行，无需等待原生打包。正式 Release 的网页部署继续使用默认 `source=release`。

## 打包规则

- 当前版本来源以 `package.json` 为准；打包前同步确认 Tauri 和 Cargo 版本字段。
- 本地打包仅限 Windows 和 Android，默认只生成以下简名测试包：
  - Windows x64：`release/pocket<version>.exe`
  - Android arm64：`release/pocket<version>.apk`
- 本地不生成 Web、macOS 或 Linux 产物；本地“全量打包”“完整包”仍限上述两个平台，构建范围与版本号无关。Windows 32 位、Android 32 位仅在用户明确指定时生成。
- 本地流程：核对版本并运行 `npm.cmd run check:release`；已有同名产物先备份，再依次运行 `npm.cmd run package:win:portable` 和 `npm.cmd run package:android:arm64`；完成后核对版本、架构、内嵌资源与 APK 签名，记录文件大小和 SHA-256。
- CI 按 `.github/workflows/release.yml` 执行；正式版本标签一律全量构建。手动运行默认生成 Windows x64 和 Android arm64 测试包，明确选择 `full_build` 时全量构建；手动构建本身不公开 Release。本地打包不自动启动 CI。
- CI 全量构建及明确指定的额外架构产物命名：
  - Windows x64：`release/pocket<version>.exe`
  - Windows 32 位 x86：`release/pocket<version>-win32.exe`
  - Android arm64：`release/pocket<version>.apk`
  - Android 32 位 ARMv7 / `armeabi-v7a`：`release/pocket<version>-32bit.apk`
  - Web 部署包：`release/pocket<version>-web.zip`
  - macOS 图形桌面包：`release/pocket<version>-mac.dmg`
  - Ubuntu/Linux 图形桌面包：优先 `release/pocket<version>-ubuntu.AppImage`，如 CI/runner 支持也保留 `release/pocket<version>-ubuntu.deb`
- Android 测试包默认使用 debug keystore 签名；正式商店签名必须由用户明确要求。
- macOS/Linux 包需要在对应系统或 CI runner 上构建；Windows 本机不要强行生成这些平台产物。
- `release/` 是本地交付产物目录，打包产物不提交到 git。
