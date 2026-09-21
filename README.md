# PocPet

[English](README.en.md)

PocPet 是基于 Tauri、React、TypeScript 与 Rust 的离线优先虚拟宠物应用，支持桌面、移动端与网页。

希望虚拟的陪伴可以抚平孤独的灵魂。

## 玩法

- 照顾宠物的饱食、清洁、心情、体力与健康，陪伴成长。
- 使用番茄钟，完成日常愿望、伙伴日程、节日故事和成就。
- 培养学习、园艺、运动、烹饪四种技能。
- 种植、养殖、钓鱼、做饭、摆摊，建设农场设施与装饰。
- 从前哨出发探索五个地区，采集物资、发现线索与珍宝。
- 收集金苹果、奖杯与纪念物，通过 Mod 替换宠物外观和文本。

## 本地开发与人工试玩

前端需要 Node.js 与 npm；原生开发另需 Rust 和 Tauri 系统依赖，Android 打包还需 JDK、SDK、NDK。

```bash
npm ci
npm run serve:local
```

本地试玩固定使用 **http://127.0.0.1:5173**。`npm run dev` 使用同一入口；端口占用时直接报错，已有本项目服务可直接复用。不要另开端口或用 localhost 创建另一份测试存档。

日常代码检查只有一个入口：

```bash
npm test
```

它执行 TypeScript、存档兼容与恢复、异常处理及入口模块加载检查。玩法节奏和界面效果由人工试玩确认；纯文档、文案、样式调整不要求例行构建。

生成可重复导入的全设施存档：

```bash
npm run save:test:facilities
```

在「设置 → 存档与恢复」导入 `output/test-saves/full-facilities.pocpet.json`。完整说明见[本地测试与复用存档](docs/本地测试与复用存档.md)。原生开发入口为 `npm run tauri:dev`。

## 打包与发布

```bash
npm run package
```

交互入口默认生成 Windows x64 EXE 与 Android arm64 测试签名 APK，保存到 `release/`；也可用 `--type windows,android --dry-run` 查看执行计划。本地“完整包”仍指这两个目标，32 位及其他平台需明确选择。流程会同步版本、备份同名产物并校验结果，详见[打包参考](docs/打包流程与统一脚本.md)。

[GitHub Actions](.github/workflows/release.yml) 在普通推送和 PR 中执行统一检查及两种前端构建；正式 `v<version>` 标签触发全平台构建、GitHub Release、更新清单与网页部署。手动构建默认两平台，显式 `full_build` 才全量。独立网页部署使用 [pages.yml](.github/workflows/pages.yml) 的 `source=main`，指定已推送的版本与提交。

## 存档与 Mod

设置中可导出与导入 JSON v2 存档，并读取支持的旧格式。导入会重置时间基线，避免旧备份恢复后立即触发离线结算；高版本存档会拒绝覆盖。存档包含当前 Mod 摘要，不包含 Mod 图片，请另行保留 Mod 文件。

Mod v1/v2 可替换外观、文本并扩展带命名空间的安全道具。格式、白名单和兼容约束见 [CodeWiki](docs/CODEWIKI.md) 与 [mod.ts](src/core/mod.ts)。全部参考文档见 [docs](docs/README.md)。

## 许可与贡献

项目代码采用 [GPL-3.0-or-later](LICENSE.md)。宠物图片由 AI 生成或辅助生成，不属于 GPL 授权范围，禁止商用；其他素材来源见对应清单。

本项目的大部分代码在 AI 辅助下完成，由维护者筛选、整合、调试和发布。欢迎通过 issue 提交问题和复现步骤，也可 fork 维护自己的改造。贡献需兼容项目许可、保留旧档与 Mod 兼容性，并避免提交未经授权的素材。
