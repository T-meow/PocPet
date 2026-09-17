# Furo 三视图与角色标准

当前采用全白身体的新版站立三视图；用户已指定用它重生成日常图一。角色动作原图仍未定稿、未替换正式资源，最新进度见 [角色原图进度](Furo全套角色图生成记录.md)。

## 当前造型

- 基准：[全白身体站立三视图原图](../output/imagegen/furo-standing-turnaround-white-20260914/standing-turnaround-white-raw.png)，1536×1024；SHA-256 `aefdb743c5834d3c16f9bdad21b577858aa7d8dca03b324d34880f6e63e32f9f`。
- 躯干、前肢、短腿、脚尖和脚底均为白色，取消棕色填充及脚底色块分界。粉色头发、黑色发饰、红粉眼与原有表情保留；不加尾巴、衣物或其他角色特征。
- 站姿双脚支撑、前肢自然下垂不触地；正面／朝左 90° 侧面／背面保持同尺度、同脚底基线。坐姿要求见最新动作提示词，不能直接照搬站姿。
- 新请求默认 Sunburst / 1K / medium；历史 high 参数按实际记录保留。

## 来源与待办

- [白色三视图清单](art/furo-standing-turnaround-white-20260914.json)、[完整提示词](art/prompts/furo-standing-turnaround-white-20260914.txt)。
- 站姿来源是原坐姿与浇水动作共同约束；历史提示词见 [站姿原稿](art/prompts/furo-standing-turnaround-20260914.txt)，原图与任务保留在 `output/imagegen/furo-standing-turnaround-20260914/`。
- 更早的四组坐姿试稿保留在 `output/imagegen/furo-turnaround-20260913/`，侧背属于推测补全；GPT 侧面带斜侧透视，不能用作精确正交设定，也不覆盖已确认的新标准。
- 后续每批最多三张模型原图，实际数量依本轮指令；展示后等待用户检查，不自动开始下一批。未获动作图加工／替换授权。
- 原图、参考、任务、备份与现役角色保留；旧 HTML 比较页已清理，恢复入口见 [文档维护](README.md#文档维护)。统一流程见 [美术规范](美术规范与作图流程.md)。
