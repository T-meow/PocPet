# 美术流程附件

制作入口见 [美术规范与作图流程](../美术规范与作图流程.md)。当前使用 mxai，Sunburst请求质量默认 `medium`（中）；商店延续 C / GPT 原画风，Furo采用 [新版全白身体站立三视图](../../output/imagegen/furo-standing-turnaround-white-20260914/standing-turnaround-white-raw.png) 为造型参考并沿用简洁可爱方向。新对话可以使用 [开场提示词](新对话开场提示词.md)。

最新默认流程（2026-09-14）：生成后直接展示原图样式，等待用户明确确认后才切分、去底、修边、缩放或制作派生预览。确认前只保存原图和请求记录、读取真实尺寸与哈希；下方历史切分脚本和加工产物不代表新批次已获后处理授权。

已采用核心共 104 项：原商店 16、A/I1 的 12 道具＋4 厨具、B–E 的 72 项。A 的 [12 道具提示词](prompts/phase-a-items-raw-review.txt)、[4 厨具提示词](prompts/phase-a-equipment-raw-review.txt)、[运行映射](phase-a-items.json) 及 [执行记录](../第一阶段美术执行记录.md) 保留。

用户已确认 B–E 并要求接入，72 张运行图片共 2,738,834 字节，替换 8 张旧园艺图并保留备份。见 [B–E 执行记录](../B-E美术原图执行记录.md)、[完整来源清单](phase-b-e-assets.json) 与 [接入清单](phase-b-e-adoption.json)。实际界面直接打开开发服务器检查，不另生成 HTML 预览页；保存原图、任务和历史请求用于追溯。

最新 C 采用两张 1280×1280 补盘原图：15 款非杯装料理带奶白浅盘，3 款杯装保留原杯，5 款高价值料理带少量星芒。I2/I3 各参考原表重绘一张，现已确认并接入；见 [修订清单与来源](phase-c-plated-assets.json)，提示词为 [I2 补盘](prompts/phase-c-plated-review/c-i2-garden-ingredients.txt) 与 [I3 补盘及闪光](prompts/phase-c-plated-review/c-i3-dishes.txt)。历史无盘版本不再采用；盘沿装饰复用同一只盘，不重复套盘。

## 提示词与清单

近期批次另见：

- 节日料理：[来源](festival-food-20260915.json)、[接入清单](festival-food-adoption-20260915.json)。
- 节日 CG：[四节日来源](festival-cg-20260916.json)、[四节日接入](festival-cg-adoption-20260916.json)、[中秋接入](midautumn-cg-adoption-20260916.json)。
- 冒险：[背景来源](adventure-backgrounds-20260917.json)、[背景接入](adventure-background-adoption.json)、[待选图标](adventure-icons-20260917.json)。
- Furo：[最新略侧转试稿](furo-daily-01-angle-20260915.json)与[完整制作记录](../Furo全套角色图生成记录.md)；尚未替换现役角色。

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
| [furo-pixel-full.txt](prompts/furo-pixel-full.txt) | 历史 GPT / Nano 像素三视图实际使用的完整提示词 |
| [furo-original-full.txt](prompts/furo-original-full.txt) | 历史 GPT / Nano 原画三视图实际使用的完整提示词 |

这些文件为原始归档，不为新批次直接覆盖。新提示词另存本轮目录；仍可复用的最终版本再按任务归档到 `docs/art/`。

## 去重与历史脚本

2026-09-17 已移除早期一次性脚本的 `.cjs.txt` 副本、已合入全文的 Furo 提示词片段；日常图一的 Nano 对照清单复用逐字节相同的 [Sunburst 提示词](prompts/furo-daily-01-white-medium-20260914.txt)。历史模型、质量与任务结果不改。

通用处理步骤保留在总规范第 5–7 节。原脚本仍在对应 `output/imagegen/` 批次；仓库旧副本可用 `git show aa51d17:docs/art/reference/<文件名>` 读取。它们依赖历史路径与参数，不是通用 CLI；复用前核对本轮输入、输出、切线及接入授权。

## 完整性与存放范围

[archive-manifest.json](archive-manifest.json) 保留去重后 5 份原始附件的来源、字节数与 SHA-256；最初 13 份记录可从 Git 历史恢复。本 README、开场提示词和总规范是说明文档，不冒充原始请求。

原始返回、请求、必要母版、最终比较图、视频和 ZIP 保留在 Git 忽略的 `output/`。已清理旧 HTML 预览及重复／被替代的少量加工产物，恢复清单见 [美术文件清理记录](../美术文件清理记录.md)。这里不保存密钥、认证头或参考图 base64；换机器后 `output/` 可能不存在，不伪造缺失的试稿。
