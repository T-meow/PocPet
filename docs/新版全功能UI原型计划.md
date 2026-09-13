# 新版全功能 UI 原型

## 本地提交与四架构测试包（2026-09-13，进行中）

- 目标／授权：用户要求先提交本地 Git，再打包 EXE 和 APK，并明确包含 32 位版本；交付 Windows x64／x86 与 Android arm64／ARMv7 共 4 包，版本保持 1.8.0。单助手，沿用代码／数据检查，体验由用户测试。
- 现场／决定：已核对 status、版本及相关 diff；提交当前功能修复、发布规则和已完成的道具／厨房／园艺调整，以及所需新源码、检查脚本和数值记录。output/ 与两份美术试稿记录保留在本地，不纳入游戏提交；不推送远端、不发布。
- 打包前验证：check:release、道具数值、伙伴活动、园艺、扭蛋、存档恢复、UI v2 和 TypeScript 通过。修正旧 UI 检查的普通树营养剂入口数量、施肥轮次状态和分类清理费断言，游戏逻辑未额外调整。所需 Rust 四架构目标、JDK 17、SDK、NDK 27.2 和既有 debug keystore 已就绪。
- 进度／待办：提交源码；备份同名包、校验清单及构建输入；按项目脚本依次生成 Windows x64、Android arm64、Windows x86、Android ARMv7，核对版本／架构／内嵌资源／APK 签名并记录大小与 SHA-256。
- 路径／禁动：release/pocket1.8.0.exe、release/pocket1.8.0.apk、release/pocket1.8.0-win32.exe、release/pocket1.8.0-32bit.apk；保留既有备份、美术草稿和未提交的其他任务文件，不读写实际玩家存档，不改变系统或签名配置。

## 发布规则调整（2026-09-13，已完成）

- 目标／授权：用户要求以后按明确指令推送、发布和更新，小版本同样发布，取消大版本号规则。本阶段修改规则和相关 CI 判断；尚无本次实际推送／发布指令。
- 现场／决定：核对 status 与相关 diff，保留全部已有改动及未跟踪文件；移除版本尾号／白名单判断，所有正式版本标签均全平台发布并生成更新清单，分支推送仅检查，手动构建范围由 full_build 决定。
- 实现：同步 AGENTS.md、README.md、package.json、scripts/release-policy.mjs、发布校验脚本及 .github/workflows/release.yml；所有公开 Release 必须等全部平台成功并校验 8 个包，默认附件校验不再依赖版本号。发布规则检查已接入 CI。
- 验证：check:release-policy、check:updates、check:release 通过，覆盖 1.6.1、1.8.0、1.8.1、1.8.2、2.0.0 标签，以及分支／PR／两种手动构建；6 个客户端目标可从 1.7.0 升级到 1.7.1。真实 metadata 命令的 4 种事件输出正确；工作流由已安装 PyYAML 解析并核对发布依赖，未安装新依赖。旧版本门槛搜索无残留，UTF-8 读回完成。
- 路径／收尾：上述规则、脚本和本记录；当前版本仍为 1.8.0。本次未修改包、签名或玩家存档，未提交／推送／运行远程 CI／发布；保留其他任务新增的厨房数值改动。

## 超窄屏顶部修复（2026-09-13，已修复／EXE 待实测）

- 目标／授权：页内标题改为 PocPet；窄屏隐藏品牌区，超窄屏仅显示金币、心心、扭蛋券和设置，顶部保持单行。沿用代码／数据检查及 Windows EXE 测试包授权，单助手，不使用 Computer Use。
- 现场／决定：核对 status 与相关 diff，保留此前修复和全部未跟踪文件；复用 820px 单列断点隐藏品牌，480px 以下隐藏顶部次要入口，禁止按钮换行；扭蛋券采用已有数字简写，完整数值保留在提示和无障碍标签。
- 验证：src/ui/App.tsx、src/styles/ui-v2.css 的 UTF-8 读回与逻辑复查完成，已有 check-ui-v2、check:release、TypeScript／前端生产构建和 Windows Rust 构建通过；仅代码／数据检查，未进行人工视觉检查。
- 交付：release/pocket1.8.0.exe 已更新，版本 1.8.0、x64、31,555,072 字节（30.09 MiB），SHA-256 396AFB103493A01EC706D293B6AF65B5CB1207B134585E8E094C1A6C30F6C3C2。与新生成的 app.exe 字节一致，入口 JS／CSS 已内嵌，SHA256SUMS.txt 的 EXE 项已更新并读回。
- 备份／收尾：release/backups/before-narrow-header-exe-20260913-010345/ 保留旧 EXE、原校验清单、Cargo.toml 原字节和 332 项源码／配置哈希；仅恢复构建工具改写的 Cargo.toml 换行，332 项输入与构建前一致。用户用新 EXE 缩窄窗口实测；未改真实存档，未打 APK、提交或发布。

## 1.8 自动备份失败修复（2026-09-13，已修复／EXE 待实测）

- 目标／授权：用户反馈“立即备份”提示“备份未完成，已有恢复点已保留”，并确认 App 版同样发生；沿用本轮问题修复授权，单助手，仅代码／数据检查。
- 现场／决定：已核对 git status 和备份相关 diff，保留前面所有改动与未跟踪文件。新导出已切换 JSON v2，但 Rust 备份写入仍只接受旧 POCPET-SAVE-v2: 前缀，原生失败可由代码确定；同时检查网页应用内恢复点路径。
- 根因／修复：使用真实 createSaveFileText 导出的 5,455 字节 JSON v2 作为 Rust 测试输入，修复前稳定报 Invalid backup text。原生边界现同时接受受支持的 JSON v1／v2 和旧转码备份，完整玩法校验仍由前端执行；JSON 不再被旧前缀规则拒绝。网页 IndexedDB 写入不经过该原生判断，本次未改其存储逻辑。
- 验证：Rust 4 项备份测试、check:save-recovery、TypeScript 和 check:release 通过。覆盖实际新格式写入、同日更新、旧格式／Mint 兼容、7 日保留、坏文件隔离、非法／未来格式拒绝、写入失败旧文件不变与可重试；前端串联即时／定时备份、状态读回、失败队列恢复和暂停不写。scripts/fixtures/pocpet-1.8.0-backup.json 为生成的测试数据，非玩家存档。
- 交付计划：沿用用户本轮 Windows EXE 测试包授权重新打包；构建前 release/pocket1.8.0.exe 已不在原路径，未删除或覆盖其他位置的包。release/backups/before-backup-fix-exe-20260913-004907/ 保留当前 SHA256SUMS.txt、Cargo.toml 原字节和 427 项构建输入哈希。
- 交付／校验：npm.cmd run package:win:portable 成功；release/pocket1.8.0.exe，31,555,072 字节（30.09 MiB），SHA-256 6574668EE92F9DF934BBEA696FD8BCA7107378FA42AE6F8FA91145F0DC828E1C。版本 1.8.0、x64、内嵌前端与生成的 app.exe 一致；仅恢复构建工具改写的 Cargo.toml 换行，427 项构建输入与构建前一致。
- 收尾／待办：更新本地 SHA256SUMS.txt 的 EXE 项并核对通过；其余 8 项文件已不在 release/，未补建或改动对应清单内容。最终 UTF-8 读回、源码差异及空白检查通过。用户以新 EXE 复测“立即备份”；Android 共用原生修复代码，APK 尚未重打。本阶段未提交／推送／发布，也未改变真实存档及备份。
- 路径／禁动：src-tauri/src/backup.rs、src/platform/automaticBackup.ts、相关脚本和本记录；不读写真实玩家存档、账号签名或既有恢复点，不提交／发布。

## 本轮修复 Windows 测试包（2026-09-13，已完成／待用户测试）

- 目标／授权：用户要求“打包exe测试”，仅 Windows x64，版本保持 1.8.0，包含本轮背包／商店弹窗、窗口位置、作者奖励及图片保存修复。沿用单助手、代码／数据检查，实际体验由用户测试。
- 现场／决定：已核对 git status、相关 diff、三处版本字段，npm.cmd run check:release 通过；保留当前全部未提交改动和未跟踪文件，不打其他平台、不提交／推送／发布。
- 备份：release/backups/before-win-test-20260913-000455/ 保存旧 pocket1.8.0.exe、SHA256SUMS.txt、update-info.json，逐文件哈希一致；旧 EXE 为 31,342,592 字节，SHA-256 1E218D3B07D61B987285A531C3714F2E43A3E4ECB7A7E6A320D19BC9C0CEDD05。另保留 Cargo.toml 原字节及 427 个构建输入的 SHA-256，供打包后核对。
- 构建／验证：npm.cmd run package:win:portable 成功，TypeScript／前端生产构建及 Windows Rust release 编译通过；核对 EXE 的 ProductVersion／FileVersion 均为 1.8.0、PE x64、全部入口 JS／CSS 引用和窗口状态插件已内嵌，交付文件与 target/release/app.exe 字节一致。仅恢复 Tauri CLI 改写的 Cargo.toml 换行，427 个构建输入均与打包前 SHA-256 一致。
- 交付：release/pocket1.8.0.exe，31,553,024 字节（30.09 MiB），SHA-256 8030B6605CC7D73692BE656D4F99E63137310B337D40AFA6ADE25949CAE4504F。基于 HEAD 9d6d4523347e6682db21d2795c30a36255c49949 加本轮未提交修复，本地测试包。
- 清单：仅更新 release/SHA256SUMS.txt 的 EXE 项，9 项逐文件核对通过；保留既有公开版本 update-info.json 元数据，本测试包不用于自动更新发布。最终差异空白检查通过。
- 待办：用户运行 EXE 检查背包／商店弹窗、退出重开后的窗口位置、作者主页十连奖励及图片系统保存；本轮不使用 Computer Use 或截图。
- 路径／禁动：release/pocket1.8.0.exe、上述备份目录及本记录；真实存档、账号签名、其他平台包和未跟踪 docs/道具数值平衡复核.md 保持原样。

## 背包商店、窗口位置、作者奖励与图片保存修复（2026-09-13，已完成代码检查／待实机验证）

- 目标／授权：用户要求背包和商店点击物品后弹窗操作、Windows 记住窗口位置、非 B 站打开作者主页获得十连奖励，并排查修复图片保存；追加 B 站仅支持图片下载，禁用存档文件下载。用户选择仅代码和数据检查；单助手，不使用 Computer Use。
- 现场／禁动：初始仅 AGENTS.md、README.md、本记录有未提交修改，完整保留；不修改真实玩家存档、账号签名、版本和 release/，不提交／推送／发布。
- 实现：背包／商店复用 DialogShell，点击才打开详情，关闭返回原列表；最后一件用完关闭原物品详情，保留批量、折扣和现有购买／使用规则。非 B 站打开作者主页后发十张扭蛋券，沿用现有领取标记，连续点击、React 更新重放、存档重载不重复发放；B 站仍核验关注。
- 图片根因／修复：writeFile 缺少 fs:allow-write-file 权限，原生写入会被拦截；纪念插画另走网页 a.download，绕过原生保存。已补齐权限并统一插画与海报保存，支持资源 URL／Base64，依据 PNG／JPEG 文件头尾校验并修正 MIME／扩展名，原样写二进制；网页用 Blob 下载，取消与写入失败不报成功。
- B 站限制：移除设置页、历史备份与损坏存档的文件下载入口，底层同时拦截存档下载和系统文件分享，禁用外部备份文件绑定／授权；保留导出／复制文本、导入、应用内恢复点、云存档和图片保存。公告与中英文提示同步。
- Windows：接入 [Tauri window-state](https://v2.tauri.app/plugin/window-state/)，仅 Windows 编译，记录位置、尺寸和最大化状态；插件在退出时保存到 app_config_dir/.window-state.json，恢复时检查显示器相交范围。Rust 调用不需要新增前端命令权限。
- 依赖核对：新增 tauri-plugin-window-state 2.4.1，Cargo.lock 仅增加该包。源码 C:/Users/Ferris/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-plugin-window-state-2.4.1，231,702 字节；缓存 C:/Users/Ferris/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f/tauri-plugin-window-state-2.4.1.crate，95,023 字节，SHA-256 73736611e14142408d15353e21e3cca2f12a3cfb523ad0ce85999b6d2ef1a704，与锁文件一致。
- 验证：TypeScript、Windows cargo check、check:images、check:toy、check-companion-activities、check-ui-v2、check:release、UTF-8 读回与差异空白检查通过。图片检查使用真实 PNG／JPEG，覆盖字节一致性、错误 MIME、截断数据、Windows 路径／Android content URI、取消／写入失败、资源 URL 和 Blob；平台检查覆盖普通版／B 站版中英文页面、作者导航失败、并发点击及状态重放、底层下载禁用。旧静态页面断言已改为“点击前无详情”，操作按钮仍单独验证。
- 路径／待办：主要位于 src/ui/、src/platform/、src/styles/、src-tauri/ 和 scripts/check-image-export.ts；版本保持 1.8.0，未重新打包 EXE／APK、提交或发布，原生实际窗口恢复及系统保存待新包实机验证。复查时另发现未跟踪 docs/道具数值平衡复核.md，非本任务创建，保持原样。

## EXE 与 APK 本地测试包（2026-09-12，已完成／待实机测试）

- 目标／授权：用户要求“打包exe 和apk 我要测试”；本次按明确指定范围生成 Windows x64 EXE 与 Android arm64 APK，版本保持 1.8.0。单助手，不使用 Computer Use。
- 现场／决定：初始工作区干净，HEAD 为 9d6d4523；package.json、Tauri、Cargo 与发布元数据检查一致。沿用项目脚本重编前端和原生代码，APK 使用既有 debug keystore，并校验签名基线。
- 备份：release/backups/before-test-packages-20260912-232946/ 已保存旧 EXE、APK、SHA256SUMS.txt 和 update-info.json，逐文件 SHA-256 与原文件一致。
- 构建：Windows x64 与 Android arm64 前端和原生代码均重新编译完成；Android 符号链接受 Windows 权限限制后，先校验本次新库，再通过 package:android:arm64:reuse 复制并封装成功。仅当前命令使用已安装的 JDK 17、SDK 与 NDK 27.2；Cargo.toml 的工具换行改写已恢复，源码无差异。
- 验证：TypeScript、前端构建、两包版本／架构／内嵌资源检查通过。APK 包名 com.frostforge.pocpet、版本 1.8.0／10800，v2／v3 签名有效，证书与旧包一致：E375653D29A6738BC45B1EF34B6B1B6BD86DDA66C53D751DDEE3683ACECCD285。
- 交付：release/pocket1.8.0.exe，31,342,592 字节（29.89 MiB），SHA-256 1E218D3B07D61B987285A531C3714F2E43A3E4ECB7A7E6A320D19BC9C0CEDD05；release/pocket1.8.0.apk，34,137,667 字节（32.56 MiB），SHA-256 EC7F04CA973E695B9A53D5AB6D815D2BC24BBA7E0C79FFFCAB4F4346498A5B35。
- 清单／收尾：本地 update-info.json 同步两包大小；核对应用源码与其原发布 revision 一致，保留原发布来源字段，本次构建 HEAD 见上。SHA256SUMS.txt 的 9 项已更新，其他平台产物哈希保持原值；git diff --check 通过，仅本记录有受跟踪改动。Android 封装日志为 release/test-package-android.log。
- 待办：用户运行 EXE、安装 APK 进行实机测试。
- 路径／禁动：release/pocket1.8.0.exe、release/pocket1.8.0.apk、release/backups/；保留源码、其他平台包、真实存档、签名与账号设置，不提交／推送／发布。

## GitHub、B 站与全平台发布（2026-09-12，已完成）

- 目标／授权：用户明确要求提交 Git、推送 GitHub 与 bilitoy、部署并构建所有；本阶段覆盖此前不提交／不发布／不构建的限制。单助手，不使用 Computer Use。
- 决定：版本保持 1.8.0；main 上提交当前全部源码、检查脚本、文档及冒险原型，再推送 v1.8.0 标签触发现有全平台流水线和 GitHub Pages。复用 B 站 Toy 23949807352832／pocpet，以 dist-toy 更新既有项目。
- 现场：GitHub main 与本地均为 25913ec；v1.8.0 尚无标签，已有旧构建 Release 草稿未发布。package.json／Tauri／Cargo 版本一致；未跟踪文件共约 1.17 MiB，均为本次 UI／存档模块、检查脚本或需保留的冒险原型。
- 进度／验证：发布元数据与差异空白检查通过；补齐发布说明中的最新交互、经验和隐藏入口，并将新版存档／云端／UI 及种植检查接入发布门禁，产物重新生成 SHA-256 清单。
- 提交／验证：源码提交 72b5b33；首次 CI 发现旧存档检查未纳入新增的可选 skillXp 字段，76830fc 补齐“旧结果不补发经验”的预期。发布流程中的 12 项本地专项及 GitHub CI 全部通过；main 与 v1.8.0 均已推送，发布代码为 76830fc886d84d665b8d459ae78f5e485297bda5。
- 构建：全量流水线 https://github.com/T-meow/PocPet/actions/runs/34698494700 的所有平台构建及 Release 发布已成功，8 个平台包已上线 https://github.com/T-meow/PocPet/releases/tag/v1.8.0。
- Pages：原部署任务在启动前被 github-pages 环境规则拒绝，v1.8.0 标签不在允许范围。a140057 改由已允许的 main 启动部署，核对已公开 Release、版本标签、原始构建运行和提交；环境保护规则保持原设置。部署 https://github.com/T-meow/PocPet/actions/runs/34699771735 成功，https://t-meow.github.io/PocPet/ 线上版本、入口 JS／CSS 与本次标准版产物一致；main 的验证流水线 34699752884 通过。
- Web 封装：下载检查发现 Windows Compress-Archive 将 ZIP 内目录写为反斜杠，部分解压器不能解析网页引用的资源。7c33dde 改用已有 JSZip 生成标准路径，将本次 CI 的 125 个前端文件重新封装并逐文件核对 SHA-256 一致，build-info 仍为 76830fc；GitHub Web 包及校验清单已同步替换。旧 CI ZIP 和提取输入均保留在 release/ 下。
- Toy：构建、元数据与 toy_doctor 检查通过；已按本次发布授权提交更新并审核通过，状态 published。正式地址 https://www.bilibili.com/toy/pocpet/index.html，线上 build-info 为 1.8.0／bilibili／76830fc；已核对实际版本目录 23949807352832-v14121 下的入口 JS／CSS，SHA-256 与本地发布构建一致。
- 备份：release/backups/before-full-release-20260912/ 保存本地旧 APK（SHA-256 0EEB59E9D30EAD1040CD6405ADA3D882A2E6C6FE1E3AE864106720BEDB671C98）及更新前 GitHub 草稿元数据。
- 交付／验证：release/ 已保存 Windows x64／x86、Android arm64／ARMv7、Web、macOS arm64、Linux AppImage／deb 共 8 个包，另有 SHA256SUMS.txt 和 update-info.json；合计 292,692,622 字节（约 279.13 MiB）。10 个附件的大小与 SHA-256 均与公开 Release 一致，9 项清单及 6 个客户端更新目标通过。两个 APK 在 CI 中通过固定测试签名、版本、架构和内嵌前端校验。
- Android arm64：release/pocket1.8.0.apk，35,403,399 字节，SHA-256 41F291006B0B55CDC7BDE84C1ADBDD2BD62688DA09B9F3E09E7B64A11272F14A。
- 收尾：应用源码、Tauri 与依赖清单相对 v1.8.0 无差异，后续提交只修正发布工具并补充记录；全部源码与原型已提交推送。线上发布及本地产物交付完成，平台实际安装体验由用户继续测试。
- 路径／禁动：docs/1.8.0-release.md、.github/workflows/release.yml、release/；既有同名本地包先备份，产物不入 Git；保留真实存档、签名与账号设置，不调整版本，不重建 Toy 项目。

## 点击菜谱弹出制作窗口（2026-09-12，已完成／待体验）

- 目标／授权：用户要求制作区域不再放在菜谱下面，改为点击菜谱打开弹窗；保留此前全部改动，单助手，不使用 Computer Use。
- 决定：菜谱列表独立展示；点击卡片打开材料／份数／奖励与制作按钮，制作过程及结果继续在弹窗中完成，关闭后返回原列表。材料、经验及防重结算规则沿用现有实现。
- 进度：已移出列表中的内嵌制作区，点击菜谱打开独立窗口；材料、口味、份数、心心和经验预览保留，制作／结果窗口覆盖在列表上。关闭保留原列表，缺厨具入口关闭详情后切换厨具页。弹窗复用现有焦点、层级与滚动处理，宽度上限 560px。
- 验证：已核对 git status 和相关 diff、读回关键片段并复查打开／关闭／开始制作／查看结果及厨具跳转；TypeScript、check-companion-activities 和 check-ui-v2 通过，未新增测试。UI 检查首次全部断言通过后遇到 Node/Windows 退出错误，原命令单独复跑正常。
- 路径／待办：src/ui/KitchenModal.tsx、src/styles/ui-v2.css；开发服务沿用 http://127.0.0.1:5173/，刷新后点击菜谱体验；未修改真实存档、核心结算、版本和 APK，未提交／推送。

## 每次下厨增加料理经验（2026-09-12，已完成／待体验）

- 目标／授权：用户追加要求每次料理也获得 1 点料理经验；保留此前全部改动，单助手，不修改真实存档、版本或 APK，不提交／推送。
- 决定：每次成功出炉获得 1 点，首做新食谱保留额外 5 点，批量制作计一次；满级不增加经验或大师次数。沿用 operationId 防重复结算，菜单预告和出炉结果同步显示经验。
- 进度：已接入出炉经验与可选 lastCraft.skillXp 字段，菜单／制作中预告本次经验，出炉页与操作通知显示实际结算奖励；旧结果不会补显示新奖励。批量心心仍按制作前技能等级计算。
- 验证：已核对 git status 与相关 diff 并读回关键片段；TypeScript 和 check-companion-activities 通过，覆盖首做 6 点／复做 1 点／批量一次／失败不发／最终动作才发／满级及大师次数／存档重载防重／中英文现有页面渲染。
- 路径／待办：src/core/{kitchen,companionActivityTypes}.ts、src/ui/KitchenModal.tsx、src/ui/kitchen/KitchenCookingModal.tsx、scripts/check-companion-activities.ts；开发服务沿用 http://127.0.0.1:5173/，刷新后可体验。

## 天气详情、技能经验与背包调整（2026-09-12，已完成／待体验）

- 目标／授权：启动开发服务；小窝天气点击显示详情，提高心心及提示文字对比度；接球、翻牌和浇水／施肥／收获提供少量技能经验；背包默认商品分类，料理按价值优先，每行四格并放大图标、边角显示名称数量。追加隐藏商店搜索及“心心兑换金币”入口。
- 决定：天气与季节详情复用现有数据和弹窗；每次完整接球／翻牌分别获得现有运动／学习技能 1 点经验，每次成功浇水／施肥／收获获得 1 点园艺经验，沿用等级上限且不增加大师次数。失败、放弃、重复领奖不发经验。料理依据食材原价与用量排序；隐藏搜索时忽略并清空旧关键词。
- 现场／禁动：已核对 git status、相关 diff 与上阶段记录，保留全部已有改动和未跟踪文件；新增经验属于用户本次明确授权的核心逻辑变更。不修改真实玩家数据、版本和 APK，不提交／推送。单助手，不使用 Computer Use。
- 进度：开发服务 npm.cmd run serve:local 保持运行于 http://127.0.0.1:5173/（会话 84524）；已接入天气／季节及种植影响弹窗、心心和辅助文案深色、成功动作经验与结果提示、背包四格大图和默认商品、料理排序；两处搜索与心心换金币入口已隐藏。天气弹窗挂在应用根部，避免房间裁切和层级影响。
- 结算：小游戏结果保留可选 skillXp 展示字段；经验在完整游戏结算时发放，关闭结果不补发。日程成就仅对缺少次数记录的旧档按经验推算，正常游玩的技能经验不再误计为日程；现有日程次数与旧档兼容保留。
- 验证：TypeScript、check-garden-care、check-companion-activities、check-partner-schedule、check-save-v2、check-ui-v2、git diff --check 通过。核心检查覆盖成功／失败／重复／放弃／暂停恢复／满级／存档重载及日程成就隔离；中英文真实页面渲染和既有五档 CSS 约束通过。读回关键片段，18 个修改文件 UTF-8 有效；心心、辅助文案、技能经验和金币余额选定配色最低对比度为 5.43:1。首页及五个新改模块 HTTP 均为 200。
- 路径／待办：src/core/{garden,miniGames,partnerSchedule,petState,companionActivityTypes}.ts、src/ui/、src/styles/ui-v2.css、scripts/check-{garden-care,companion-activities,partner-schedule}.ts；页面刷新即可体验，实际触控和图形布局待用户验收。本阶段未重新打包 APK，版本仍为 1.8.0。

## 日程角色与入口精简（2026-09-12，已完成／待实机复测）

- 目标／授权：用户要求日程期间角色保持不透明，去掉未完整实装的小风景／餐盘装饰选择，暂时隐藏背包搜索，并把首页商店／朋友卡／扭蛋整行移到花园入口上方。
- 决定：单独覆盖角色禁用透明度；移除两组装饰选择及相关说明，厨具页名称同步；背包隐藏搜索并忽略旧关键词；调整首页实际 DOM 顺序与间距。
- 现场／禁动：已核对 git status、相关 diff 及实现；保留全部现有改动和未跟踪文件，日程交互限制、核心玩法和存档字段不变，不修改真实玩家数据、版本或现有 APK，不提交／推送。单助手，不使用 Computer Use。
- 进度：角色禁用时单独保持 opacity: 1；已移除小风景、餐盘装饰选项和说明，厨具页改名为“厨具”。背包不渲染搜索栏且忽略旧查询词，商店仍可搜索；首页商店／朋友卡／扭蛋整行已移到花园等四个入口之前。
- 验证：TypeScript、既有 check-companion-activities、check-ui-v2、git diff --check 和修改文件 UTF-8 检查通过；已读回关键片段并复查 CSS 优先级、首页顺序和隐藏查询逻辑。未新增测试或使用 Computer Use。
- 路径／待办：src/ui/{HomePageV2,ItemStorageModal,KitchenModal,PlayModal}.tsx、src/styles/ui-v2.css；手机显示和布局待实机复测，本轮未重新打包 APK。

## 种植园与通知修复 APK 测试包（2026-09-12，已完成）

- 目标／授权：用户要求“重新打包 apk 我测试”，本阶段生成 Android arm64 测试 APK，包含本轮种植园和通知浮层修复，版本保持 1.8.0。
- 现场／决定：已核对 git status、打包输入 diff，package.json／Tauri／Cargo 版本一致。沿用项目脚本重编原生库与前端，使用既有 debug 签名；保留全部源码与未跟踪文件，不提交／推送。
- 旧包备份：release/backups/pocket1.8.0-before-garden-notice-fix-20260912-165653.apk，34,137,667 字节，SHA-256 549399D97707DDD6C8A926BD902E7ED6EDF88CC133C9A5732D545B201E0E7886，与原包一致。
- 进度：前端和 arm64 原生库重新编译完成；遇到已知 Windows 符号链接限制后，校验本次新库与前端匹配，使用 package:android:arm64:reuse 复制新库并完成 Gradle 封装。Cargo.toml 仅恢复构建工具改写的换行，原始字节校验一致。
- 验证：TypeScript／前端构建、发布元数据、原生库与 APK 内嵌资源、arm64 架构、包名 com.frostforge.pocpet、版本 1.8.0／10800 通过。APK v2／v3 签名有效，与备份 APK 的证书一致：E375653D29A6738BC45B1EF34B6B1B6BD86DDA66C53D751DDEE3683ACECCD285。
- 交付／校验：release/pocket1.8.0.apk，34,137,667 字节（32.56 MiB），SHA-256 0EEB59E9D30EAD1040CD6405ADA3D882A2E6C6FE1E3AE864106720BEDB671C98。
- 路径／待办：用户安装 release/pocket1.8.0.apk 实机测试；旧包保留在 release/backups/。未更改系统设置、真实玩家数据或应用版本，未提交／推送。

## 种植园卡片操作与通知浮层修复（2026-09-12，已完成／待实机复测）

- 目标／授权：用户要求在上方土地卡片显示状态并完成种植操作，移除下方重复详情；追加要求顶部通知独立悬浮，不挤占弹窗高度。
- 决定：每块土地直接提供种植／浇水／收获／清理入口，施肥、营养剂和移除在卡片内展开；收获次数、倒计时、成熟奖励和补偿领取保留。通知取消向页面与弹窗注入高度预留，保持顶部浮层和安全区。
- 现场／禁动：已核对 git status 与相关 diff；保留全部现有 UI v2、存档迁移、图片导出和冒险原型改动及未跟踪文件，不修改真实玩家数据、核心种植规则、版本和 release/，不提交／推送。单助手，不使用 Computer Use。
- 进度：移除重复详情，土地卡片直接显示次数、剩余时间／进度、成熟奖励并提供状态对应操作；管理选项原地展开，按地块显示每日照料状态，种苗弹窗固定目标地块。补偿领取和种植工具保留在总览。通知移除高度测量与全局布局变量，普通／全屏弹窗和页头均不再避让，通知层级高于现有弹窗。
- 验证：TypeScript 无输出、check:garden-care、check-ui-v2 和 git diff --check 通过；既有 UI 检查已覆盖五种土地状态、逐地块每日限制、奖励／补偿、普通版／B 站版中英文页面，以及五档 CSS 布局和通知浮层约束。已读回修改片段并复查回调目标和弹窗布局；未使用浏览器视觉自动化。
- 路径／待办：src/ui/GardenPage.tsx、src/ui/App.tsx、src/ui/NoticeCenter.tsx、src/styles/ui-v2.css、scripts/check-ui-v2.ts；手机触控、展开布局和通知覆盖效果待实机复测。本轮未重新打包 APK，版本保持 1.8.0。

## 图片导出修复与 APK 复测（2026-09-12，已完成）

- 目标／授权：用户要求修复复查发现的 PNG／JPEG 保存类型不一致，并本地打包一个 APK 测试；仅 arm64，版本保持 1.8.0。Mint 道具和食谱保持现有替换行为，新 Mod 架构留待下个版本。
- 决定：共用图片保存函数按数据 MIME 选择文件扩展名和原生筛选器；保留 PNG／JPEG 原始图片字节。沿用项目打包脚本和原有 debug 签名，已有同名 APK 先备份。
- 现场／禁动：已核对 git status、相关 diff 和三处版本字段；保留全部现有 UI v2、存档迁移、冒险原型及未跟踪文件，不修改真实玩家数据，不提交／推送。
- 进度／验证：PNG／JPEG 的原生筛选器、默认扩展名、原始字节写入、取消保存及网页下载模拟检查通过；TypeScript、前端构建和发布元数据检查通过。arm64 原生库已重新编译；Tauri 遇到 Windows 符号链接限制后，使用 package:android:arm64:reuse 复制本次刚编译的库，Gradle 封装成功。Cargo.toml 仅恢复构建工具改写的 CRLF，内容无差异。
- 交付／校验：release/pocket1.8.0.apk，34,137,667 字节（32.56 MiB），SHA-256 549399D97707DDD6C8A926BD902E7ED6EDF88CC133C9A5732D545B201E0E7886。APK v2／v3 签名、包名 com.frostforge.pocpet、版本 1.8.0／10800、arm64 架构及当前前端资源校验通过；沿用签名 E375653D29A6738BC45B1EF34B6B1B6BD86DDA66C53D751DDEE3683ACECCD285。
- 旧包已备份：release/backups/pocket1.8.0-before-image-fix-20260912-153924.apk，34,137,667 字节，SHA-256 53374285433DD541B945BDFF428E55D7B282C2A68DC4E356E316F3421D423F71，与原 APK 一致。
- 待办／路径：用户安装 APK 实机复测；src/platform/saveImageFile.ts、release/pocket1.8.0.apk、release/backups/。本轮未提交／推送。

## Android APK 人工测试包（2026-09-12，已完成）

- 授权：用户追加要求“打包 apk 我来测试”，本阶段允许所需前端与 Android 构建，范围为 arm64 测试 APK；覆盖此前不构建／不打包限制，仍不提交、不推送、不调整版本。
- 现场：已核对 git status --short、相关 diff 及 package.json／Tauri／Cargo 版本，均为 1.8.0；保留现有全部 UI v2、存档迁移及未跟踪文件。发布元数据检查通过。
- 决定：执行 npm.cmd run package:android:arm64，重新构建原生库并沿用现有 debug keystore；交付 release/pocket1.8.0.apk，已有同名 APK 先复制到 release/backups/ 留存。
- 进度：前端与 arm64 Rust 库编译成功；Tauri 后续符号链接因 Windows 权限受限，转用 npm.cmd run package:android:arm64:reuse，复制本次刚编译的库后继续 Gradle 封装，未修改系统设置。Tauri 重写的 Cargo.toml 仅恢复项目原有 CRLF，内容和版本不变。
- 验证：Gradle 构建成功，APK v2／v3 签名、包名 com.frostforge.pocpet、versionName 1.8.0／versionCode 10800、arm64 架构及当前前端资源校验通过；TypeScript 和 git diff --check 通过。沿用签名 E375653D29A6738BC45B1EF34B6B1B6BD86DDA66C53D751DDEE3683ACECCD285。
- 交付：release/pocket1.8.0.apk，34,137,667 字节（32.56 MiB），SHA-256 53374285433DD541B945BDFF428E55D7B282C2A68DC4E356E316F3421D423F71。旧包备份 release/backups/pocket1.8.0-before-ui-v2-20260912-104809.apk，复制后校验一致。
- 待办：用户安装 APK 实机验收。本阶段完成 arm64 测试包，未提交、推送或调整应用版本。

## 1.8 存档过渡、云端与补偿（2026-09-12，已接入／待人工验收）

- 授权：按用户确认方案修改存档格式和相关核心接口，覆盖此前 UI 任务的存档禁动限制；完整保留既有 UI v2 改动。单助手，不使用 Computer Use，不构建／打包／提交／推送，应用版本保持 1.8.0。
- 决定：1.8 写 JSON 新格式 v2，1.8／1.9 继续读取旧 JSON、转码、Mint、旧云档；2.0 才停止旧档直读。统一保存必要进度、结算和防重数据，去除扭蛋明细和临时展示数据，本机偏好独立保存。
- 决定：云端保留 ZIP/DEFLATE + Base64 与 A/B 副本，1024 字符分块、60 块上限、容量预检与重复上传判断；未来版本拒读优先于损坏回退。
- 决定：有效旧档首次迁移成功自动补偿 120 块苏打饼干与 10 个草莓牛奶；新建进度无补偿，按存档与本机去重，库存不足保留待到账余量。商店 soda_biscuit_box 售价 500 金币，直接交付 40 块，不生成箱子库存。
- 决定：更新中英文 1.8 公告及发布说明，加入 UI v2、厨房、三种小游戏、格式时间线、补偿和箱装商品；新公告修订标识重新展示。
- 现场：实施前核对 git status --short 与 diff --stat，仅有上一轮 UI v2 改动；核心存档／交易模块尚无改动。真实存档及恢复副本不手工改写或删除。
- 进度：已接入 v2 持久化投影、旧格式纯解析／迁移、独立原始副本、补偿事务与本机偏好；旧 Mint 迁移及同档重复导入的内存模拟通过，新进度导出约 5.1 KiB。已接入箱装交付、云端 1024 分块／容量预检／内容比较，以及公告和设置格式提示。
- 验证：新增 scripts/check-save-v2.ts 与 scripts/check-cloud-save-v2.ts 通过，覆盖旧 JSON／Mint 转码、纯预览、新格式往返、随机序列与保底、进行中奖励／防重凭据、原始副本、偏好、补偿一次性／满库存余量／重复导入／失败回滚，以及箱装交付、批量折扣和容量检查。云端仅用模拟存储，覆盖旧 960／新 1024 分块、61,440 字符边界、大小预检、不变数据跳过、清单与数据块读回、上传中断、损坏回退和未来版本保护。
- 验证：既有存档恢复、Mint、厨房／三种小游戏、交易、双扭蛋、花园、日程／朋友卡、时间保护、离线／睡眠、成就及日期奖励专项通过；旧检查已按新的展示数据边界、商品分类及唯一存档 ID 更新。普通版／B 站版的中英文页面、公告和云容量显示渲染通过，五档 CSS 布局约束通过。
- 大小样例：新进度约 5.1 KiB；含两台扭蛋各十抽的模拟进度，旧全量转码估算约 14.7 KiB，新格式约 5.1 KiB。真实 Mint 1.0.1 测试文件 6,557 字节，转换并补齐当前默认结构后为 5,626 字节。
- 收尾：用户要求仅做简单排查后转人工测试；最终 TypeScript 无输出与 git diff --check 通过。开发服务已重新执行 npm.cmd run serve:local，运行于 http://127.0.0.1:5173/（会话 62160）；首页、App、存档模块、v2 CSS 与箱装图标共六项请求均为 200。已请求在 Codex 打开，应用返回 queued；服务保持运行。
- 待人工验收：实际喂食／购买／收获／领奖、旧档导入和文件下载、手机触控及实际像素布局；真实 Toy 云端未写入。版本仍为 1.8.0，未构建、打包、提交或推送。
- 本轮新增文件须保留：src/core/{saveMetadata,persistedPet,petPreferences}.ts、src/assets/soda-biscuit-box.svg、scripts/check-{save-v2,cloud-save-v2}.ts；公告同步 docs/1.8.0-release.md，既有 UI v2 文件继续保留。

## 正式版 UI v2 移植（2026-09-12，已接入／待体验）

- 目标／授权：用户已确认完整移植方案，覆盖正式版全部页面；版本保持 1.8.0，不构建、不打包、不提交／推送，完成后启动本地开发服务供体验。单助手，不使用 Computer Use。
- 决定：首页原型房间、48px 固定消息栏、五色状态圆环；设置独立页，四主题／自选色独立本地保存，天气季节自动；全局 5 秒通知及最近 20 条记录；花园五地总览；日程保留真实规则；搭子卡改称朋友卡，朋友卡和双扭蛋使用全屏弹窗，抽取加摇晃动画；统一纪念册。商店／背包物品格白底，分类色只用于选中态和分类 Tab。专注保留原设计。
- 基线／禁动：开始时 git status --short 和 git diff --stat 均为空。保留原型、核心玩法与存档格式、所有物品／卡片 ID、Mod／平台限制、release/ 及真实玩家数据，不恢复已移除的研究搭配。
- 进度：已接入主题与通知、正式房间 SVG／状态圆环／48px 信息栏、独立设置页、五地花园、日程筛选、朋友卡和扭蛋全屏布局、机器与图标摇晃、统一纪念册数据及海报。通知按操作 ID 在提交后发送；连续同文通知重播浮出，展开暂停，弹窗与页面避让，记录最多 20 条。手机商店正文可整体滚动，避免详情区挤掉物品格。纪念册注明当前存档累计，年度只展示已有字段；插画封面、详情与下载均检查解锁。
- 验证：TypeScript 无输出检查、厨房／小游戏／物品交易与页面渲染、花园、日程／朋友卡、双扭蛋／梦想、日期奖励、成就结局、旧存档恢复专项已通过。新增 scripts/check-ui-v2.ts 验证主题持久化与异常存储、配色对比、通知与时钟区分、统计范围和插画解锁；普通版／B 站版中英文真实 React 页面渲染通过；五个指定分辨率的 CSS 布局约束通过。同步修正旧检查中的纪念册色块和日程 schemaVersion 5 预期（正式逻辑原本已为 6，本轮未改存档版本）。
- 服务／交付：npm.cmd run serve:local 运行于 http://127.0.0.1:5173/（终端会话 36500），保持运行。首页、主要页面模块、CSS、房间 SVG、角色／物品／花园图片等 12 个 HTTP 请求均为 200；已请求在 Codex 打开该地址，应用返回 queued，回到本会话时显示。最终 TypeScript 与差异检查通过，核对 package.json、package-lock.json、src/core、src-tauri、原型和 release 无改动，未构建、打包、提交或推送。
- 体验待验收：未使用浏览器视觉自动化；五档实际像素效果、触控与文件下载由用户在开发服务中体验。通知展开／关闭、连续喂食、切地与收获、日程领奖、续期、扭蛋确认／取消／跳过的实际手感也可在此检查。
- 路径：src/ui/、src/styles/、src/i18n/、展示偏好与纪念册数据模块、必要 scripts/check-*；本记录按阶段更新。
- 新增文件需一起保留：src/assets/room-v2.svg、src/styles/ui-v2.css、src/ui/{AppearancePanel,CompanionStatus,MemoryAlbum,MemoryCover,NoticeCenter,RoomBackdrop}.tsx、src/ui/{appearance,albumData}.ts、src/ui/app/{useAppearance,petSessionFeedback}.ts、src/platform/albumPoster.ts、scripts/check-ui-v2.ts。

## 原型设计记录（保留）

目标：在 `dev` 分支制作 `docs/prototypes/ui-v2.html`，复用现有素材，保留旧原型和所有已有用户改动。此轮只制作假数据原型，不接入正式存档及平台服务，不自动提交 Git。

1. 建立统一导航、内存状态、浮层和顶部通知，延续小窝风格，补齐手机布局。
2. 完成所有现有页面与主要操作：背包商店、花园、日程、专注、搭子卡、双扭蛋、成就梦想、角色、设置、存档恢复、分享更新及年度回顾。
3. 提供四套主题、自选主色、天气与季节独立切换；跨页面、角色和示例进度保留外观环境设置。
4. 提供示例进度与事件控制，支持中英切换及普通版／B 站版预览，原生和网络功能使用明确的本地模拟流程。
5. 合并为离线单文件，检查脚本、关键数据联动、配色对比度和响应式规则；记录实际验证范围，交付功能覆盖说明。

已确认：通知约 5 秒自动收起；花园展示全部 5 块土地；沿用小窝式入口；预设主题加自选主色；设置内可直接切换环境。

完成记录：已在 `dev` 生成离线单文件 `docs/prototypes/ui-v2.html`，功能与模拟边界见 `docs/prototypes/ui-v2-功能覆盖.md`。脚本、CSS 及主要数据联动检查已通过；浏览器工具限制本地页面预览，实际分辨率与交互视觉验收留给用户打开 HTML 完成。保留旧原型、已有用户改动，未提交 Git。

## 彩色风格调整

按用户提供的旧界面重写视觉：保留浅底、彩色资源胶囊和橙／黄／蓝／紫／绿的五项状态，给照顾、导航及各功能页建立独立配色。主题换色缩小为页面底色、品牌标记和少量强调，不再给全部组件统一染色。首页纪念卡改为插画、彩色纸张与贴纸组成的回忆卡，回顾和分享页同步调整。沿用现有交互与单文件交付，完成后检查脚本报错和主要入口。

已完成彩色风格调整，继续覆盖原有 `ui-v2.html`，刷新即可查看。主题与功能配色在代码中独立，纪念插画及彩色装饰不随主题改变。

## 今日小事与纪念册收尾

今日小事只保留尚待完成或领取的条目，全部处理后隐藏整个模块。纪念插画统一检查解锁记录，未解锁时使用角色贴纸封面，详情与下载同样避免提前展示。回顾图片补充相伴、活跃、照顾、物品使用、花园、日程、专注和成长回忆，预览与导出共用内容，继续保持彩色风格。完成后复查隐藏、解锁、角色切换和图片导出逻辑。

已完成并重新生成 `ui-v2.html`。脚本、CSS、待办隐藏、插画解锁及回顾数据联动检查通过；实际浏览器布局和图片下载效果仍待打开 HTML 验收。未提交 Git。

## 邻居入口与功能补漏

将邻居做客移入主页今日小事，领取后随待办一起隐藏。对照现有游戏页面、设置和操作入口，区分已调整位置的功能与原型遗漏，补齐可交互流程及说明；继续只修改离线原型。完成后检查脚本报错、新增操作与资源联动，再生成 `ui-v2.html`。

已完成原有功能补漏，具体入口与模拟边界记入 `docs/prototypes/ui-v2-功能对照.md`。补齐存档、日程、心愿、分档奖杯、传承投入、批量兑换及照顾确认等操作，复用单个检查脚本验证，未新增测试项目。待用户打开 HTML 验收，未提交 Git。
