# Furo 三视图试稿

当前有效标准：用户已明确要求使用 [新版全白身体站立三视图](../output/imagegen/furo-standing-turnaround-white-20260914/standing-turnaround-white-raw.png) 重生成日常图一，该图为当前 Furo 造型、比例和配色依据；身体、四肢与脚部统一白色，后续沿用较少细节、更可爱的方向。Sunburst请求质量按用户最新项目要求使用 `medium`（中）。当前只生成图一，批量仍每批最多三张原图，尚未授权加工或接入。下文保留各阶段历史记录。

后续制作规范及提示词索引见 [美术规范与作图流程](美术规范与作图流程.md)。当前四组仍待用户选定；商店选择 C 组不改变 Furo 的待确认状态。

## 目标与授权
- 2026-09-13：用户要求 GPT 和 Nano 分别生成 Furo 三视图，比较像素风与原画风；共 4 张，每张正面、侧面、背面。
- 用户明确允许输入 Furo 参考图，并要求人工视觉检查后决定。
- 沿用已授权 mxai 的 gpt-image-2.5-sunburst 与 nano-2.0；单助手，不接入游戏、不发布、不提交。

## 决定
- Furo 身份由 src/i18n/zh-CN.json 和 src/ui/App.tsx 核对：默认内置角色 official.furo；主参考 src/assets/pet/pet_idle_sit.png。
- 已查看 sleep、work_food、work_plants，均以正面为主，且含姿态/道具变化。采用唯一干净坐姿主参考锁定角色，4 张输入完全相同图片。
- 锁定淡粉短发、黑色侧夹和刘海几何发饰、红粉大眼、腮红与小嘴、大头小白身体、深棕后脚。三视图统一自然坐姿：正面、向画面左方的严格侧面、严格背面。
- 侧背面缺少现有明确设定，是依据正面补全的设计草稿；不擅自增加长尾、耳朵、衣服或新饰品。
- 两种风格分别采用同一份提示词供两模型比较；横向 3:2，请求 1K，GPT high/1 张。
- 输出：output/imagegen/furo-turnaround-20260913/；保留原始返回，另做标注和四组对照，视角切分按实际空白处理。

## 进度与验证
- 已核对 Git status 和相关 diff，保留工作区其他任务的所有改动。
- 沿用现有 Python/Node/sharp 和 mxai 请求流程，不安装依赖，不记录密钥。
- 4 张均已轮询至 status=2：GPT 像素 2098964469592887296，Nano 像素 2098964476173750272，GPT 原画 2098964480326111232，Nano 原画 2098964485367664640。
- GPT 两张实际 1536×1024；Nano 两张实际 1264×848。原图全部保留，逐文件尺寸、字节数、SHA-256 和真实任务编号见 verification.json。
- 同一风格的两模型提示词逐字一致，四次均输入同一参考图，参考 SHA-256：85b666e804c0f95b7c2032a81c0e7402782d425bc6bf0d130d16240f1a82a5b1。
- 已裁出 12 个独立白底视角图；每张三视图的预览只整体裁白边和等比缩放，未分别修正视角比例。对照图上排像素、下排原画，左 GPT、右 Nano。
- 画面复核：四张均有正面、侧面候选、背面，角色关键特征保留。Nano 侧面更接近严格 90 度；GPT 两版的侧面仍有斜侧透视，不能直接当精确正交设定使用。侧背结构属于待确认补全方案。
- Nano 原画版自行生成中英标题和落地阴影；已保留原始返回，预览和独立视角裁去顶部标题，保留阴影，未重绘角色。
- comparison.png、compare.html、4 张 review 图已完成；对照图已查看，参考图可在 HTML 中并排核对。
- 素材包 furo-turnaround-comparison.zip：10,839,660 字节，SHA-256：6accc9bceabb445a01bf88e6b24a368696c1665607371b54b0676bc6d820eecc；ZIP 条目核验含 4 张原图、12 个独立视角。

## 待办
- 用户人工比较四张后选方向；后续可按明确指令修正侧面、统一背面设定。当前未获得继续生成或替换角色素材的授权。

## 路径与禁动项
- 参考源仅只读：src/assets/pet/；不修改原角色素材与其他业务文件。
- 商店试稿记录保持在 docs/商店图标美术试稿.md；本次是角色设定试稿。

## 2026-09-14：补充思考图的新三视图

- 当前授权：读取现有 Furo 图片和用户提供的 C:/Users/Ferris/Downloads/furo-think.jpg，生成一张三视图。用户明确选择已配置的 image-studio API、gpt-image-2.5-sunburst、1536×1024，并允许上传坐姿图和思考图；不需要人工视觉检查，成品由用户自行查看。
- 已读取：pet_idle_sit.png、pet_sleep.png、pet_work_watering_plants.png、furo-think.jpg。实际输入使用 pet_idle_sit.png 锁定完整比例/坐姿，furo-think.jpg 补充脸型/发饰/表情特征。旧四组试稿未作为已确认设定输入。
- 决定：同一自然坐姿、原画风、纯白背景，左至右正面/严格左侧面/背面；三图同尺度，侧背依据参考最少补全；不添加尾巴、兽耳、服装或道具。
- 路径：output/imagegen/furo-turnaround-20260914-reference/prompt.txt；计划输出同目录 furo-turnaround.png。保留旧试稿和 src/assets/pet/ 全部原图，不接入游戏、不提交或发布。
- 进度：已通过 image-studio/scripts/image.py 单次发起 Images API 请求；接口返回 HTTP 401: Invalid API key，未生成成品，没有自动重试或切换模型/服务商。离线配置检查显示配置来源 OPENAI，地址 https://sub2apis.ruobin.dev/v1；未读取或记录密钥内容。
- 待办：用户在本机修正当前 API 密钥后继续同一份提示词生成。失败任务记录：output/imagegen/furo-turnaround-20260914-reference/furo-turnaround.job.json。

## 2026-09-14：改用 mxai 生成

- 当前授权：用户明确要求直接使用 mxai 生图，沿用上述角色、原画风三视图与两张参考图；不需要人工视觉检查，不修改本机其他 API 密钥。
- 模型与参考：mxai 实时模型列表确认 gpt-image-2.5-sunburst 可用、max_input_images=1，故将项目坐姿图和用户思考图等比并排合成 mxai-reference.png，一次输入两图信息；原图未修改。提示词按左/右参考板说明调整，保存为 mxai-prompt.txt。
- 请求：3:2、1K、high、count=1。dry_run 校验通过，报价 7 积分。正式任务 2099452883463311360 经 get_task_status 确认 status=2，已完成；只有一次正式生成请求。
- 路径：output/imagegen/furo-turnaround-20260914-reference/，包含参考板、提示词、参考 SHA-256 清单、mxai-upload/quote/submission/status.json；不记录密钥。
- 成品：furo-turnaround-mxai.png，实际 PNG 1536×1024，1,288,030 字节，SHA-256 5584b5dc038cefc2d78f0733a6b610a4be3c7cca01ee4943045b25cf642173db；已下载保存原始返回并校验可完整解码，详情见 mxai-verification.json。
- 验收：按用户选择未做画面检查，成品直接交用户确认；侧背面是根据两张正面参考补全的设定草稿，未替换游戏原角色素材。本次生成完成。

## 2026-09-14：修正站姿的三视图

- 当前授权：用户反馈新一批站立姿势不对，要求先结合坐姿、浇水等图生成站立三视图；明确选择“原有坐姿＋原有浇水图”。沿用 mxai / Sunburst，仅生成一张原稿供用户检查，不继续批量重绘或处理成品。
- 原参考：`src/assets/pet/pet_idle_sit.png` 与 `src/assets/pet/pet_work_watering_plants.png`。坐姿锁定头脸和发饰，浇水图锁定直立躯干、短腿、小而贴地的深棕脚尖；去除浇水动作的帽子、工具和植物。
- 站姿纠正：身体保留直立高度，双脚承担站立支撑，避免大椭圆脚底朝前或坐姿摊腿；前肢自然下垂且不触地。正面／朝左严格90度侧面／严格背面，同尺度、同脚底基线，无道具、无文字、无尾巴。
- mxai 当前只接受一张参考：两张 512×512 原图按原尺寸并排为 1024×512 输入板。只准备必要输入，原文件与模型输出不加工。
- 路径：`output/imagegen/furo-standing-turnaround-20260914/`。完整提示词：[站姿三视图](art/prompts/furo-standing-turnaround-20260914.txt)。复用原有 Furo 备份，不覆盖旧试稿或本轮9张动作原图。
- 当前进度：已核对 Git 状态和既有 diff；两张原参考与备份哈希一致。输入板为 1024×512、658,745 字节，SHA-256：`3a9ad5f30113a56c05c15d344cb578392bcf363a4dc62ef11b50c6b0b07f5e5c`。提示词 SHA-256：`d18f9af7a5d129f622547c8b7f7a18701f9f75c61a512206bf7e0ada89b35dfd`。
- 请求 3:2 / 1K / high / count=1，dry_run 报价 7 积分。正式任务 `2099475813362569216` 已确认 status=2；只提交一次。
- 成品：[站立三视图原图](../output/imagegen/furo-standing-turnaround-20260914/standing-turnaround-raw.png)，实际 PNG 1536×1024、1,287,249 字节，SHA-256：`9fdcc4be89a2942cf127d235d3866f2178dee89ef14a8c9a46c6512d0a714e44`。已原样下载，验证文件结构、压缩像素数据与哈希；未裁切、去底、缩放、合成预览或接入。
- 只读画面检查：三图均为双脚支撑的直立姿态，脚为贴地的小深棕色末端；画面左至右为正面、朝左侧面、背面，未带入帽子、水壶、植物或文字。侧背结构仍是依据原图补全的草稿，不视为用户已确认的正式设定。
- 后续确认：用户明确“按照新的三视图作为标准，重新生成图片”，该原稿已成为当前角色造型标准。后续每次只生成三张模型原图，展示后等待用户检查；本次先处理原动作表第1–3组，见 [全套角色图记录](Furo全套角色图生成记录.md)。

## 2026-09-14：脚部改为白色

- 最新授权：用户要求“修改一下三视图，不要棕色脚底，要全身白色”。沿用 mxai / `gpt-image-2.5-sunburst`，只生成一张三视图原图，再交用户检查。
- 唯一输入为上述已确认的站立三视图；保留原文件，参考SHA-256为 `9fdcc4be89a2942cf127d235d3866f2178dee89ef14a8c9a46c6512d0a714e44`。已只读查看，三个视角脚部均有待去掉的深棕色块。
- 决定：躯干、前肢、短腿、脚尖及脚底全部使用同一白色；取消棕色填充及脚底色块分界，仅保留与身体同粗细的轮廓线。粉色头发、黑色发饰、眼睛与表情沿用原设定，站立高度、小脚外形和正面／朝左侧面／背面排布不变。
- 路径：`output/imagegen/furo-standing-turnaround-white-20260914/`；提示词 `docs/art/prompts/furo-standing-turnaround-white-20260914.txt`；清单 `docs/art/furo-standing-turnaround-white-20260914.json`。
- 进度：仅正式提交一次，任务 `2099514008368320512` 已确认status=2。dry_run校验通过，报价7积分（非核实实扣）。上一轮两张简洁可爱动作原图已生成并保留，不继续批量重绘。
- 成品：[白色脚部站立三视图原图](../output/imagegen/furo-standing-turnaround-white-20260914/standing-turnaround-white-raw.png)，实际PNG 1536×1024，1,283,206字节，SHA-256 `aefdb743c5834d3c16f9bdad21b577858aa7d8dca03b324d34880f6e63e32f9f`。文件结构、压缩像素数据、提示词、参考图和原图哈希均通过；旧参考未改动，详情见 [验证记录](../output/imagegen/furo-standing-turnaround-white-20260914/verification.json)。
- 只读画面检查：三个视角的深棕色脚部填充均已取消，身体与脚部为连续白色，保留轮廓线及小脚站立姿态。只生成这一张原稿，生成已停止，等待用户检查。
- 边界：原图直接落盘展示，不裁切、去底、缩放、合成预览、接入或替换运行素材；新三视图的效果等待用户确认，不自行追加生成。
- 后续确认：用户明确“用新版三视图再生成一下日常的图一”，该全白身体三视图已成为新请求的参考标准；同时指定本项目Sunburst请求质量为 `medium`。本次一张四格动作表的进度见 [全套角色图记录](Furo全套角色图生成记录.md)。
