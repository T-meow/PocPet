# PocPet

[English](README.en.md)

PocPet 是一个桌面与移动端虚拟宠物应用，围绕陪伴、日常照顾、番茄钟、花园、伙伴日程和可替换宠物 Mod 展开。项目基于 Tauri、React、TypeScript 与 Rust 构建，目标是提供轻量、可定制、可跨平台分发的个人桌宠体验。

希望虚拟的陪伴可以抚平孤独的灵魂。

当前项目仍处在早期阶段，接口、存档格式和 Mod 规范会继续演进。欢迎提交问题、建议和改造。

## 开源与 AI 参与说明

PocPet 是一个个人实验性质项目。项目中的大部分代码由 AI 编程助手生成或在 AI 辅助下完成，再由维护者人工筛选、整合、调试和发布。代码结构、玩法数值和界面细节仍会随着个人需求持续变化，不承诺稳定路线图或长期兼容全部二次开发方向。

本仓库的协作流程也会保持 AI 优先：如果提交 PR，代码审查和合并判断大概率也会由 AI 辅助完成，维护者只做有限的方向确认和发布把关。因此更建议通过 issue 提交问题、复现步骤、需求建议或设计讨论；如果你希望长期维护自己的改造、玩法分支、商业包装或发布节奏，推荐直接 fork 本仓库，在自己的分支中替换素材、调整规则和整理发布流程。和 PocPet 当前设计方向差异较大的改造，也更适合在 fork 中独立推进。

## 素材声明

项目代码采用 GPL-3.0-or-later 授权。宠物图片素材由 AI 生成或 AI 辅助生成，不属于 GPL 授权范围，禁止商用。

## 功能概览

- 宠物照顾与成长：饱腹、清洁、心情、体力和健康会随时间与行动变化，小心心可用于升级和购买增益卡。
- 道具、背包与商店：支持食物、礼物、护理和花园道具，每日折扣、免费苏打饼干及小心心兑换金币。
- 番茄钟与日常：专注/休息循环、每日愿望、回归任务、离线事件、天气和季节共同影响陪伴过程。
- 花园：解锁地块、种植多类树木、浇水施肥、升级工具，并收获道具、金币和金苹果。
- 伙伴日程与邻居：每日选择活动，培养四类 Lv.10 技能和大师次数；本地 Mod 库中的其他宠物会作为邻居出现。
- 增益卡与金苹果扭蛋：好友证/挚友证提供限时加成；扭蛋支持金币或扭蛋券，包含保底、最近结果与一次性初始赠礼。
- 成就与伙伴梦想：成就覆盖照顾、商店、花园、日程等系统；长期玩家可完成伙伴梦想、收集奖杯和提升纪念等级。
- 日期奖励：生日、相遇纪念日、节日和月初礼物按本地自然日结算，并支持 3 天补领。
- 作者与反馈：每个存档首次在玩法说明中点击作者链接，可领取 10 张扭蛋券。
- Mod 与存档：Mod v1/v2 可替换外观与文本并扩展安全道具；带版本文本存档支持导入、导出和旧档迁移。
- 跨平台与多语言：支持 Windows、Android 和 Web，当前包含中文与英文文案。

## 技术栈

- Tauri 2
- React 18
- TypeScript
- Vite
- Rust
- Android Gradle 项目由 Tauri 生成并纳入仓库

## 本地开发

环境要求：

- Node.js 18 或更新版本
- npm
- Rust stable
- Tauri 2 所需系统依赖
- Android 构建需要 Android SDK、NDK 与 Java/Gradle 环境

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

启动 Tauri 开发模式：

```bash
npm run tauri:dev
```

前端构建检查：

```bash
npm run build
```

## 本地打包

本地只打包 Windows 和 Android，默认生成 Windows x64 EXE 与 Android arm64 APK。本地“全量打包”“完整包”仍使用这两个平台，构建范围与版本号无关；32 位架构仅在明确指定时生成。Web、macOS、Linux 产物由 CI 发布流程处理。

先核对 `package.json`、Tauri 和 Cargo 版本，运行发布元数据检查，并备份 `release/` 中已有的同名产物：

```powershell
npm.cmd run check:release
```

然后依次打包 Windows x64 便携 EXE 和 Android arm64 APK：

```powershell
npm.cmd run package:win:portable
npm.cmd run package:android:arm64
```

交付路径：

- Windows x64：`release/pocket<version>.exe`
- Android arm64：`release/pocket<version>.apk`

Android 脚本会重建原生库和内嵌前端资源，再生成、对齐并使用既有 debug keystore 签名。交付前确认两包版本、架构、内嵌资源及 APK 签名校验通过，记录大小与 SHA-256，并同步已有的本地校验清单。`release/` 中的产物不提交到 Git。

## GitHub Actions 自动构建与发行版

推送、发布和更新按用户明确指定的范围执行，不区分“大版本”和“小版本”。例如 `1.8.1` 可以正常发布，并向 `1.8.0` 客户端提供更新；已有明确授权时直接完成相应流程。

仓库包含 `.github/workflows/release.yml`，不再使用版本尾号或白名单决定构建范围：

- pull request 和普通分支推送：运行版本、存档、玩法等检查，并构建标准版和 B 站版前端。
- 推送与项目版本一致的 `v<version>` tag：所有正式版本均全量构建，生成客户端更新清单，校验附件后公开 GitHub Release、设为最新版本，并部署对应标准版网页。
- 手动运行 workflow：默认构建日常测试包；勾选 `full_build` 时构建全平台产物。手动构建本身不公开 Release。
- 本地打包范围遵循上节约定，不因版本号或 CI 规则自动扩展。

日常测试包：

- Windows x64：`pocket<version>.exe`
- Android arm64 debug-signed APK：`pocket<version>.apk`

全量构建会额外产出：

- Windows 32 位：`pocket<version>-win32.exe`
- Android ARMv7：`pocket<version>-32bit.apk`
- Web 部署包：`pocket<version>-web.zip`
- macOS：`pocket<version>-mac.dmg`
- Ubuntu/Linux：`pocket<version>-ubuntu.AppImage`，如 runner 生成 deb，也会保留 `pocket<version>-ubuntu.deb`

Android 包默认使用 CI runner 上临时生成的 debug keystore 签名，只适合测试分发；正式商店签名需要另行配置签名密钥和发布流程。

## Gitee 自动构建模板

仓库同时保留 `.gitee/workflows/release.yml` 作为 Gitee 自动构建模板。设计目标是推送或打 tag 时构建：

- Windows：exe
- Android：APK
- macOS：dmg/app
- Linux：AppImage/deb，优先 Ubuntu 兼容，也便于国产 Linux 发行版测试

要启用自动发布到 Gitee Release，需要在 Gitee 仓库的流水线/Actions 密钥中配置：

- `GITEE_TOKEN`：拥有创建 Release 和上传附件权限的私人令牌
- `GITEE_OWNER`：仓库所属用户名或组织名，例如 `ferrisM`
- `GITEE_REPO`：仓库名，例如 `poc-pet`

macOS 构建需要 macOS runner。Gitee 如果没有提供对应托管 runner，需要使用自托管 runner。Linux 构建建议使用 Ubuntu 22.04 或更新版本。Android 构建需要 runner 预装 Android SDK/NDK，或在流水线中补齐安装步骤。

Gitee 的流水线能力、runner 标签和 Release API 可能因账号/企业版配置不同而不同；如果平台语法或 runner 标签与当前模板不一致，请按 Gitee 当前流水线界面生成的 YAML 调整 `.gitee/workflows/release.yml`。

## Mod 制作

制作指南：

- `docs/mod制作指南.md`
- `docs/mod-guide.md`

推荐新 Mod 使用 `schemaVersion: 2`，可以替换宠物图片、道具图片、默认姓名、默认生日、展示文本、喜欢食物、好结局 CG，并可添加带命名空间的安全自定义道具。Mod 不开放节日奖励池、核心玩法数值、存档规则或番茄钟规则。

## 开发者文档

项目架构、状态流、存档迁移、功能入口与低版本 WebView 弹窗兼容约定见 [CodeWiki](docs/CODEWIKI.md)。

## 存档兼容

项目保留内部旧存档 `pocpet.pet.v1` 兼容。外部导入导出使用带版本号的文本格式，并在导入时重置时间基线，避免旧备份恢复后立即触发离线衰减或番茄钟自动结算。

## 许可

本项目代码采用 GNU General Public License v3.0 or later（GPL-3.0-or-later）授权，详见 `LICENSE.md`。

你可以按照 GPLv3 的条款使用、复制、修改和分发本项目代码。分发修改版或衍生作品时，需要同样以 GPLv3 兼容方式开放相应源代码，并保留版权与许可证声明。宠物图片素材不属于 GPL 授权范围，禁止商用。

## 贡献

提交贡献前请确认：

- 你的贡献可在 GPLv3 许可下发布。
- 不提交未授权素材、字体、音频或第三方资源。
- 不破坏旧存档兼容和当前支持的 Mod v1/v2 格式。
- 涉及用户数据、存档和 Mod 解析的改动需要考虑向后兼容。


