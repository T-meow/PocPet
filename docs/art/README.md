# 美术流程附件

制作入口见 [美术规范与作图流程](../美术规范与作图流程.md)。当前使用 mxai，商店延续 C / GPT 原画风；Furo 尚未选稿。新对话可以使用 [开场提示词](新对话开场提示词.md)。

最新默认流程（2026-09-14）：生成后直接展示原图样式，等待用户明确确认后才切分、去底、修边、缩放或制作派生预览。确认前只保存原图和请求记录、读取真实尺寸与哈希；下方历史切分脚本和加工产物不代表新批次已获后处理授权。

已采用核心共 104 项：原商店 16、A/I1 的 12 道具＋4 厨具、B–E 的 72 项。A 的 [12 道具提示词](prompts/phase-a-items-raw-review.txt)、[4 厨具提示词](prompts/phase-a-equipment-raw-review.txt)、[运行映射](phase-a-items.json) 及 [执行记录](../第一阶段美术执行记录.md) 保留。

用户已确认 B–E 并要求接入，72 张运行图片共 2,738,834 字节，替换 8 张旧园艺图并保留备份。见 [B–E 执行记录](../B-E美术原图执行记录.md)、[完整来源清单](phase-b-e-assets.json) 与 [接入清单](phase-b-e-adoption.json)。实际界面直接打开开发服务器检查，不另生成 HTML 预览页；保存原图、任务和历史请求用于追溯。

最新 C 采用两张 1280×1280 补盘原图：15 款非杯装料理带奶白浅盘，3 款杯装保留原杯，5 款高价值料理带少量星芒。I2/I3 各参考原表重绘一张，现已确认并接入；见 [修订清单与来源](phase-c-plated-assets.json)，提示词为 [I2 补盘](prompts/phase-c-plated-review/c-i2-garden-ingredients.txt) 与 [I3 补盘及闪光](prompts/phase-c-plated-review/c-i3-dishes.txt)。历史无盘版本不再采用；盘沿装饰复用同一只盘，不重复套盘。

## 提示词与清单

下一阶段范围与排期见 [美术素材扩展计划](../美术素材扩展计划.md)，包含厨房摆放、奖杯柜和小游戏。先确定该阶段清单，不能将总目标数量视为已授权的生图订单。

第一阶段的初版提示词为 [12 道具](prompts/phase-a-items-c.txt)及 [4 厨具](prompts/phase-a-equipment-c.txt)。以下各轮保留作历史追溯，当前选定结果以本页顶部为准；旧派生图片和预览页已清理，原图、任务与必要参考保留。

上一轮为 [Flare / Nano 简化可爱版提示词](prompts/phase-a-cute-flare-nano.txt)：两模型各 1 张 1K、4×4 的 16 项画风对照，恢复云朵笑脸与金苹果星芒。

随后为 [Sunburst 适量细节提示词](prompts/phase-a-sunburst-balanced.txt)：按用户纠正恢复未简化前的结构、赛璐璐明暗与轻渐变，已生成 1 张 1K 的同 16 项表，与旧 Flare 简化版比较。

随后为 [Sunburst 参照原细节提示词](prompts/phase-a-sunburst-reference.txt)：使用用户直接提供的原阶段 sheet-light.png 作为唯一参考，生成 1 张 1K 的同 16 项表。云朵保留软垫缝线与布标并增加笑脸，金苹果增加星芒；该版猪肘前端后来被用户否定，由下一轮修订。

单项修订为 [猪肘重绘提示词](prompts/phase-a-pork-knuckle-single.txt)：把肉食改为侧面宽厚、前端完整圆钝的烤肘。最终两张原图继承了这个造型要求，已获确认并接入。

| 文件 | 用途 |
|---|---|
| [shop-icons-c-original.txt](prompts/shop-icons-c-original.txt) | 已采用 C 组的完整原画风提示词；扩展同风格时作为文字基准 |
| [shop-icons-pixel.txt](prompts/shop-icons-pixel.txt) | A/B 像素图标历史完整提示词 |
| [shop-icons-16-items.json](shop-icons-16-items.json) | 16 个道具的行优先顺序、ID、名称、文件名 |
| [furo-common.txt](prompts/furo-common.txt) | Furo 身份、坐姿、三视角与构图约束 |
| [furo-style-pixel.txt](prompts/furo-style-pixel.txt) | Furo 像素风格段 |
| [furo-style-original.txt](prompts/furo-style-original.txt) | Furo 原画风格段 |
| [furo-pixel-full.txt](prompts/furo-pixel-full.txt) | 历史 GPT / Nano 像素三视图实际使用的完整提示词 |
| [furo-original-full.txt](prompts/furo-original-full.txt) | 历史 GPT / Nano 原画三视图实际使用的完整提示词 |

这些文件为原始归档，不为新批次直接覆盖。新提示词另存本轮目录；仍可复用的最终版本再按任务归档到 `docs/art/`。

## 历史脚本文本

| 文件 | 已做过的处理 |
|---|---|
| [shop-icons-original-finish.cjs.txt](reference/shop-icons-original-finish.cjs.txt) | 原画图标安全切线、连通去白、Lanczos3 归一化、透明图与比较页 |
| [shop-icons-pixel-finish.cjs.txt](reference/shop-icons-pixel-finish.cjs.txt) | 像素图标同类处理，使用 nearest |
| [furo-prepare.cjs.txt](reference/furo-prepare.cjs.txt) | 复制唯一参考、记录哈希、拼接两种完整提示词 |
| [furo-finish.cjs.txt](reference/furo-finish.cjs.txt) | 三栏切分、整体比例预览、四组比较 |
| [adopt-c-style.cjs.txt](reference/adopt-c-style.cjs.txt) | 已采用 C 单图从 256 缩到 128，检查映射、输入和写回哈希 |

`.cjs.txt` 是便于阅读的历史归档，不是通用 CLI。执行前必须按新批次调整本机 sharp 路径、`__dirname`、依赖的旧 `items.json` 与输出目录；旧 manifest 会导致复用旧结果。Furo 的 `contentTop: 190` 是特定原图的裁标题参数，不能当作统一规则。接入脚本会写 `src/assets/icon/`，仅在对应素材替换已授权时使用。

## 完整性与存放范围

[archive-manifest.json](archive-manifest.json) 仅列出上述 13 份原始附件，记录来源、字节数与 SHA-256；本 README、开场提示词和总规范是新写的说明，不冒充历史原文。13 份原始附件共 56,692 字节，2026-09-13 已验证与本机来源逐字节一致。

测试图、原始返回、裁切中间图、比较页、视频和 ZIP 保留在 Git 忽略的 `output/`，没有为归档新增追踪图片。这里不保存密钥、认证头或参考图 base64。换机器后 `output/` 可能不存在，按总规范里的文字和受版本控制的正式素材继续，不伪造缺失的试稿。
