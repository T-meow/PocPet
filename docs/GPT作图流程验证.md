# GPT 作图流程验证

## 目标与当前授权

- 最新决定（2026-09-13，重新配置排查之后）：用户要求「继续制作文档，这次先用 mxai」。当前生图渠道改用 mxai，不继续让本机 GPT 认证问题阻塞制作；总规范见 [美术规范与作图流程](美术规范与作图流程.md)。以下为此前诊断范围与证据。
- 2026-09-13：用户要求先暂停完整美术文档整理，优先跑通本机 GPT 作图流程，实在不可用才使用 mxai。
- 当时优先入口：image-studio 的 scripts/image.py，模型 gpt-image-2.5-sunburst；该优先级已由上方最新决定更新。
- 本轮用已有 C 组提示词尝试 1 张 1K / high 道具表，纯文字输入；不替换已接入的 16 张图标，不改系统环境或账户配置，不提交、不发布。

## 已验证的事实
- Python：C:/Users/Ferris/AppData/Local/Programs/Python/Python311/python.exe；Pillow 12.3.0，依赖可用。
- 工具：C:/Users/Ferris/.codex/skills/image-studio/scripts/image.py。
- 离线检查通过：读取完整的 OPENAI_BASE_URL / OPENAI_API_KEY 配置对，地址为 https://sub2apis.ruobin.dev/v1；并非直接访问 api.openai.com，也未经过 mxai。
- 只比较环境变量是否存在与是否一致，未输出密钥。进程与 Windows User 的 OPENAI 地址、密钥均一致；SUB2API 配置对在这两处都未设置。当前失败不能归因为进程未继承新的用户环境。
- GET /v1/models：HTTP 401，Invalid API key。
- POST /v1/images/generations：HTTP 401，Invalid API key；使用 Images、auto 解析出的 sub2api 兼容 profile、gpt-image-2.5-sunburst、high、1024×1024、PNG、1 张、流式请求、无参考图。
- 生图请求记录为 rejected，未产生图片。只提交这一次验证请求，没有自动重复 POST，没有切换模型。
- 此证据定位到当前配置在服务端被拒绝认证；不能据此断言 GPT 模型本身不可用，也不能用修改提示词或切分脚本修复鉴权。

## 重新配置核验（2026-09-13）
- 用户进一步授权「重新配置一遍技能试试」。已核对 image-studio 的 INSTALL.md、agents/openai.yaml 与现有配置来源；该技能通过环境变量读取认证，安装目录与展示配置不保存密钥。
- 在独立 PowerShell 子进程中重新成对载入 Windows User 的 OPENAI_BASE_URL / OPENAI_API_KEY，并清除该子进程中的 SUB2API 配置后执行 check。没有改写持久用户或系统环境，没有重新安装技能或更换模型。
- 只输出检查布尔值：地址和密钥无首尾空白，密钥无空白、控制字符、包裹引号或多余 Bearer 前缀；用户配置与原进程配置完全一致。Machine 层没有 OPENAI 或 SUB2API 配置，其他层也没有备用 SUB2API 配置。
- 技能自带测试：17 项中 16 项通过；可选卡牌抠图测试因缺少 numpy 跳过，不影响图片 API 调用。
- 重新载入配置后的模型查询仍返回 HTTP 401 / Invalid API key。随后使用完全不导入技能的独立 urllib 请求查询同一 /v1/models，换用普通诊断 User-Agent，也返回 HTTP 401。
- 当前证据不支持将问题归因于技能安装、旧进程配置或密钥粘贴格式；认证在接入服务处被拒绝。仍无法仅凭 401 区分密钥已撤销、填错或与服务地址不匹配，需要确认该服务接受的有效配置。
- 本轮仅执行只读模型查询，没有再次提交生图任务，没有调用 mxai，没有写出任何凭据，也没有替换当前素材。

## 待处理
- 需要在本机更新或确认该接入服务接受的 OPENAI_API_KEY，并核对 OPENAI_BASE_URL；不要在聊天中发送密钥。重新安装技能不会替换服务端认证凭据。
- 更新后，若当前 Codex 进程尚未继承，临时在同一个调用 PowerShell 中成对载入 Windows User 的 OPENAI_BASE_URL / OPENAI_API_KEY，再执行；不混用来源，不修改持久环境。
- 先 check，再用新输出路径生成。现有 c-style-raw.job.json 必须保留，脚本会拒绝覆盖已有 job；下一次用 c-style-retry-01.png 等新名字。
- 成功后验证实际尺寸、格式、图片可解码和 SHA-256，再检查道具布局、切分透明图；按已确认的人工验收偏好交付用户查看。
- 用户已明确改用 mxai；恢复 image-studio 的验证留待以后有效配置更新或用户要求，不自动重复旧失败请求。不要把 mxai 的成功写成本机入口成功。
- 完整美术规范已整理为 docs/美术规范与作图流程.md，附 docs/art/README.md 和新对话开场提示词。13 份原始附件及哈希保留；本次只读确认 mxai 真实列表仍包含 gpt-image-2.5-sunburst 和 nano-2.0，没有提交新生图任务。

## 复现命令

从 D:/Projects/PocPet 执行；命令不含凭据。本节是复现说明，不表示已经成功出图。

```powershell
& 'C:/Users/Ferris/AppData/Local/Programs/Python/Python311/python.exe' 'C:/Users/Ferris/.codex/skills/image-studio/scripts/image.py' check --offline
& 'C:/Users/Ferris/AppData/Local/Programs/Python/Python311/python.exe' 'C:/Users/Ferris/.codex/skills/image-studio/scripts/image.py' check --timeout 60
& 'C:/Users/Ferris/AppData/Local/Programs/Python/Python311/python.exe' 'C:/Users/Ferris/.codex/skills/image-studio/scripts/image.py' generate --api images --model gpt-image-2.5-sunburst --quality high --size 1k --format png --prompt-file 'D:/Projects/PocPet/docs/art/prompts/shop-icons-c-original.txt' --out 'D:/Projects/PocPet/output/imagegen/gpt-direct-check-20260913/c-style-retry-01.png' --timeout 600
```

## 路径与禁动项
- 失败任务：output/imagegen/gpt-direct-check-20260913/c-style-raw.job.json。
- 文档附件：docs/art/；原归档文件共 56,692 字节，13 份均与来源逐字节一致。
- 已接入的 C 组图标仍为上轮成果。当前工作区原有的 16 张 PNG 和商店图标记录改动保留。
- 不将密钥、认证头、账户文件写入项目；不在参数、日志或文档里记录密钥；不读取其他工具的无关账户配置。
