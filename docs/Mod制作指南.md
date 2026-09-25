# 角色 Mod 制作指南

本指南面向当前角色 Mod 格式，新包使用 `schemaVersion: 2`。制作顺序为：确定角色资料 → 准备并确认动作图 → 处理透明背景与对齐 → 填写清单 → 打包 → 在游戏中人工验收。字段和文件校验以 [mod.ts](../src/core/mod.ts) 为准。

## 1. 角色如何接入玩法

角色 Mod 使用游戏已有的照料、喂食、工作、阅读、运动和互动逻辑，通过图片与少量资料表现角色差异。

| 内容 | 当前接入方式 |
|---|---|
| 外观与动作 | `pet/` 下的 7 张状态图、11 张动作图 |
| 名称与简介 | `name`、`defaultPetName`、`description` |
| 生日 | `birthday`，启用角色时应用到伙伴生日 |
| 喜欢的食物 | `favoriteFoodIds`，实际喂食命中时获得偏好加成 |
| 简短台词 | `texts.recentEvent`、`texts.favoriteFood`、`texts.status` |
| 道具外观与文案 | 可选的 `items.overrides` |
| 自定义道具 | 可选的 `items.custom`，受游戏既有规则限制 |
| 一周年纪念图 | 可选的 `cg/good_ending_year_1.png` |

当前清单没有可配置的性格、兴趣、愿望或角色专属剧情字段。在简介中写这些设定不会自动产生玩法效果，也不能通过 Mod 执行脚本或改变公共玩法规则。

开始制作前确定角色参考图、临时或正式名称、生日、食物偏好，以及希望表现的动作。未提供的角色设定不擅自补成事实。

## 2. 交付目录与资源限制

一个完整角色包至少准备以下 19 个文件；ZIP 根目录直接放 `manifest.json`，不要再套一层角色文件夹。

```text
manifest.json
pet/
  content.png
  hungry.png
  sad.png
  dirty.png
  tired.png
  sick.png
  sleeping.png
  happy.png
  bath.png
  eat_cookie.png
  eat_noodles.png
  eat_meat.png
  give_heart.png
  level_up.png
  reading_books.png
  workout.png
  work_food.png
  work_plants.png
```

- 图片必须是真正的 PNG，不能把 JPEG、WebP 改后缀使用。角色图使用透明背景。
- 角色与道具图片每张不超过 `3 × 1024 × 1024` 字节，结局 CG 不超过 `8 × 1024 × 1024` 字节，ZIP 不超过 `25 × 1024 × 1024` 字节。
- 解析器不要求图片统一为 256px，也不要求所有画布尺寸相同；游戏显示时按容器等比适配。
- 缺少角色图会警告并回退到内置角色图片。完整角色包应补齐 18 个文件，避免切换动作时出现其他角色。
- ZIP 只放受支持的清单和素材。参考图、图集、预览图、制作脚本、处理报告、PSD 和说明文档都放在包外，否则可能被判为不支持的文件。
- 原图和中间文件保存在 `output/imagegen/<主题>/`；工作目录与待打包目录分开。

## 3. 动作图清单

文件名是游戏识别用的固定名称，图片内容可以按角色重新设计。

| 文件 | 画面用途 |
|---|---|
| `content.png` | 平静、日常状态，也是 Mod 列表缩略图 |
| `hungry.png` | 饥饿，想吃东西 |
| `sad.png` | 低落、难过 |
| `dirty.png` | 需要清洁 |
| `tired.png` | 疲倦、困倦 |
| `sick.png` | 生病、不舒服 |
| `sleeping.png` | 睡觉 |
| `happy.png` | 开心、玩耍等正向反馈 |
| `bath.png` | 洗澡、清洁和部分照料操作 |
| `eat_cookie.png` | 通用食物与多数厨房料理的进食反馈 |
| `eat_noodles.png` | 便当等指定食物的进食反馈 |
| `eat_meat.png` | 营养餐、猪蹄等指定食物的进食反馈 |
| `give_heart.png` | 抚摸产心、送礼等互动反馈，可设计为飞吻送心 |
| `level_up.png` | 升级庆祝 |
| `reading_books.png` | 阅读 |
| `workout.png` | 运动 |
| `work_food.png` | 工作动作：制作食物 |
| `work_plants.png` | 工作动作：照料植物 |

三个进食槽可以使用同一张图片，但必须分别保存为三个文件。画面并不随实际喂食物品逐一变化；例如全部画成吃米饭后，其他使用这些槽位的食物也会显示吃米饭动作。动作触发映射见 [petActions.ts](../src/core/petActions.ts)。

采用 4×4 图集时，三个进食槽共用一格即可用 16 格覆盖全部 18 个文件：

| 行 | 第 1 格 | 第 2 格 | 第 3 格 | 第 4 格 |
|---|---|---|---|---|
| 1 | 日常 | 饥饿 | 难过 | 脏了 |
| 2 | 疲倦 | 生病 | 睡觉 | 开心 |
| 3 | 洗澡 | 进食，共用三个槽 | 给心心 | 升级 |
| 4 | 阅读 | 运动 | 食物工作 | 植物工作 |

## 4. 生图、透明处理与清晰度

### 生图与确认

沿用[美术规范与作图流程](美术规范与作图流程.md)中的生成方法。默认模型为 `gpt-image-2.5-sunburst`、`quality: "medium"`，用户明确指定时按其要求；dry_run 与正式请求参数保持一致。角色图需要附上已确认的参考图，统一脸型、发色、衣服、配饰、尾巴和画风。

先展示生成原图，由用户确认角色造型和动作，再切图或接入。给心心等重点动作可以单独生成候选图，确认选项后仅替换对应槽位。

图集实际尺寸可能与请求尺寸不同，切图前必须读取真实宽高，并检查格间空白，不能直接假定分界线安全。1280px 的 4×4 图集，每格只有约 320px；需要更多细节时应单独生成较大的动作图，放大已有小图不会增加真实细节。

### 透明背景

需要人工去背景时，先提供保留背景色的原尺寸单格图，等待用户处理。已有手工透明图时，以它为素材源，不重复去白或阈值抠图，不覆盖用户源文件。

透明处理必须保留眼睛高光、白衣、围裙、发饰以及半透明描边。不要把所有接近白色的像素直接删除。交付前由用户在浅色、深色背景中检查残留底色、白边和误删区域。

### 原始像素与对齐

角色图保留源分辨率，使用无损 RGBA PNG，不套用道具图标的 256px／128px 缩小流程，不做调色板量化或反复有损转换。PNG 和 ZIP 的无损压缩不会改变解码后的图像像素。

处理现成透明图时优先只调整透明画布和整数像素位置：

1. 用 `alpha > 0` 取得整幅可见图案的边界，包含爱心、尾巴、发梢和装饰；发现孤立残点时先交给用户检查，不擅自擦除。
2. 设画布为 `W × H`，可见边界宽高为 `w × h`，目标左上角为 `floor((W-w)/2)`、`floor((H-h)/2)`。
3. 平移完整图案，左右、上下透明留白之差各不超过 1px。空间不足时扩展透明画布，不截断描边或特效。
4. 校验平移前后可见像素的 RGBA 值和数量一致，保留半透明边缘；确认没有重采样。
5. 不同动作在同一显示尺寸下检查角色大小和落点。长尾巴或侧面的爱心可能让几何中心与视觉重心不同，最终由用户判断是否还需要调整留白。

总览图可以生成缩略预览，必须与 Mod 素材分开，不能把总览里的缩略图当作正式资源。数值上的居中只验证边界，不能代替画面验收。

## 5. 填写 manifest.json

以下是内置 DeepSeek 的清单示例，初始昵称为小肥鱼。创建其他角色时必须换成自己的唯一 `id`；DeepSeek 本身已内置，无需重复导入。使用 UTF-8 JSON，不加注释或末尾逗号：

```json
{
  "schemaVersion": 2,
  "id": "local.blue-whale-maid",
  "name": "DeepSeek",
  "version": "0.1.4",
  "defaultPetName": "小肥鱼",
  "description": "蓝发鲸尾女仆，喜欢白米饭和米饭料理。",
  "birthday": { "month": 4, "day": 24 },
  "favoriteFoodIds": [
    "dish_plain_rice", "dish_mushroom_rice", "dish_kelp_rice",
    "dish_carp_rice", "dish_egg_rice", "dish_carrot_rice",
    "dish_tomato_egg_bowl", "dish_pork_rice_bowl", "dish_pumpkin_rice",
    "dish_pepper_pork_bowl", "dish_chestnut_rice", "dish_honey_eel_rice",
    "dish_sardine_rice_ball", "dish_lemon_bream_rice", "dish_seafood_rice",
    "dish_valley_travel_bento", "bento"
  ],
  "texts": {
    "recentEvent": "小肥鱼来到小窝了。",
    "favoriteFood": "米饭的香气最喜欢了！心情额外 +{amount}。",
    "status": {
      "content": "心情不错",
      "hungry": "想吃米饭了",
      "sad": "有点失落",
      "dirty": "需要清洁",
      "tired": "有点困了",
      "sick": "不太舒服",
      "sleeping": "睡得正香"
    }
  }
}
```

| 字段 | 填写规则 |
|---|---|
| `schemaVersion` | 新包填写数字 `2` |
| `id` | 稳定且唯一，2–64 字符，小写字母或数字开头，其余可含 `.`、`-`、`_`；不要占用内置角色 ID |
| `name` | Mod 展示名，最多 48 字符 |
| `version` | Mod 自己的版本，例如 `0.1.4`；同一角色更新保持 `id` 不变并更新版本 |
| `defaultPetName` | 角色默认昵称，最多 16 字符；玩家自定义昵称通常会保留 |
| `author` | 可选，最多 48 字符 |
| `description` | 可选，最多 160 字符 |
| `birthday` | 可选，合法的整数月份、日期，如 `{"month":4,"day":24}` |
| `favoriteFoodIds` | 可选，填写已支持的实际物品 ID；重复项会去重 |
| `texts.recentEvent` | 可选，启用时的简短文字，最多 240 字符 |
| `texts.favoriteFood` | 可选，偏好提示，最多 160 字符；`{amount}` 替换为偏好加成值 |
| `texts.status` | 可选，键为 7 个状态名，每条最多 24 字符 |

食物偏好使用固定 ID 列表，不支持“所有含米饭的料理”这类自动匹配条件。厨房料理 ID 来自 [kitchenRecipes.ts](../src/core/kitchenRecipes.ts) 的 `allDishes`，基础物品白名单来自 `mod.ts` 的 `itemImageKeys`。`dish_plain_rice` 是成品白米饭，`plain_rice` 是食谱 ID，`rice` 是原材料，不能混用。

示例选取米饭、盖饭、焖饭、饭团和便当；没有把生米、粥、米香煎饼或糯米甜点自动算进去。具体范围按角色设定确认，新增食谱后需要更新清单。菜名与配方可查询[食材与料理数值表](食材与料理数值表.md)。

当前源码允许厨房成品进入 `favoriteFoodIds`。如果目标安装版导入时报 `Unknown item id in favoriteFoodIds: dish_...`，需要使用包含料理偏好支持的游戏版本；更改 Mod 自己的 `version` 无法让旧安装版自动获得支持。

## 6. 可选道具与纪念图

只做角色外观时可以省略整个 `items`。需要覆盖某个基础物品时，在 `items.overrides` 中填写允许覆盖的物品 ID，可修改 `name`、`summary`、`image`。例如：

```json
{
  "items": {
    "overrides": {
      "bento": {
        "name": "米饭便当",
        "summary": "装着热乎米饭的便当。",
        "image": "items/rice_bento.png"
      }
    }
  }
}
```

上面的字段合并进主清单，并把图片放在 ZIP 的 `items/rice_bento.png`。schema 2 的物品图片必须由清单引用；仅放入文件不会自动覆盖。厨房成品可以作为偏好，但不因此自动获得 `items.overrides` 或 `texts.items` 的覆盖权限。

自定义物品放在 `items.custom`，ID 必须为 `{modId}:{localId}`，不能只写本地名。每项必填 `id`、`name`、`summary`、`kind`、`price`：`kind` 为 `food`、`item`、`care` 或 `garden`，价格为 0–99999 的整数。可选 `effect` 仅支持 `hunger`、`mood`、`cleanliness`、`energy`、`health`，每项 -100 至 100；`image` 指向 `items/` 下的 PNG，`shop` 控制是否售卖，`tags` 为标签数组。完整约束见 `mod.ts`，当前 `favoriteFoodIds` 不支持自定义命名空间物品。

纪念图只识别 `cg/good_ending_year_1.png`，使用 PNG 格式，单图上限为 8MiB，可以保留较高分辨率的原图。没有制作角色纪念图时可以省略，但应检查游戏默认纪念内容是否符合预期；其他场景 CG 不会因为替换了角色动作图就自动变成该角色。

## 7. 打包与验证

先将最终素材复制到干净目录，如 `output/mods/blue-whale-maid/`，里面只有 `manifest.json`、`pet/` 和需要的可选素材目录。不要直接压缩包含原图和预览的制作工作目录。

Windows PowerShell 示例，在项目根目录运行：

```powershell
Compress-Archive -Path '.\output\mods\blue-whale-maid\*' -DestinationPath '.\output\mods\deepseek-0.1.4.zip'
```

选择文件夹里面的内容进行打包，确保打开 ZIP 第一层就能看见 `manifest.json`。同名产物先保留副本或使用新的 Mod 版本号。ZIP 压缩不应重新编码图片；解包后的 PNG 应与最终素材逐字节一致。

交付前完成以下检查：

- 清单能通过 `validatePetModManifest`，整包能通过 `parsePetModZip`；完整角色包没有缺少动作图的警告。
- 18 张图片齐全，格式和体积符合限制，解包后哈希与最终素材一致。
- 生日和食物 ID 正确，实际喂食时喜欢的料理能获得偏好反馈。
- ZIP 不混入预览图、脚本、额外目录层级或未引用的物品图。

代码有改动时按项目约定运行 `npm.cmd test`；只制作素材时以包解析、文件校验和用户的画面验收为主，不因此构建或发布游戏客户端。

## 8. 导入、人工验收与删除

在「设置 → Mod 管理 → 导入 Mod」选择 ZIP，导入后确认当前角色。相同 `id` 的再次导入会替换库中对应包，不会另占一个位置；当前 Mod 库最多保存 12 个导入包。

Doro、Mint、DeepSeek 为随游戏提供的内置 Mod，也会出现在 Mod 管理中。Doro 和 DeepSeek 可以从本机角色列表删除，删除状态在重启后保留，可在同一页面点击「恢复内置角色」重新加入。Mint 是不可删除的保留角色。内置资源随游戏安装包提供，列表删除不会改写游戏安装文件；同 ID 的外部 ZIP 不覆盖内置角色。DeepSeek 保留原试作包的 `local.blue-whale-maid` ID，以延续按角色 ID 保存的回忆。

画面验收由用户进行：检查正常状态、睡觉、三种进食、阅读、工作、升级和给心心；尤其注意透明边缘、脸部清晰度、尾巴与爱心是否完整，以及动作切换时角色是否明显跳位或忽大忽小。触摸互动可以检查 `give_heart.png`，实际生日和喂食偏好也应在游戏内确认。

源码预览统一使用 `npm.cmd run serve:local` 和 `http://127.0.0.1:5173`；有本项目服务时直接复用，不另起其他端口或独立 HTML 游戏预览。需要完整设施时使用[本地测试与复用存档](本地测试与复用存档.md)中的测试存档，不自动改写玩家进度。

「使用 Furo」只切换当前角色，已导入的包仍保留。外部 Mod 右侧的垃圾桶会删除该包的本机资源；内置可删除角色则按上面的规则移出列表。删除当前角色时切换到 Mint，并同步存档的角色标识和生日，玩家自定义昵称保留。主进度、背包数量和历史回忆保留，缺失 Mod 的自定义物品在重新导入并启用前无法正常使用。

探险主角使用当前角色图。大厅邻居从可用角色库中选择，最多同时显示三位，更多角色按游戏日期和当前伙伴轮换；溪谷途中的补给偶遇从出发时的可用角色中选取，已删除角色不参与新行程的选择。出发后的主角与偶遇 ID 随存档保留，中途切换当前角色不会重新抽取；如果对应 Mod 被删除，已有行程继续保留，缺少的偶遇角色以通用称呼显示。外部 Mod 只需提供已有的 `content.png` 等动作图即可参与，不需要另做大厅图片。

外部存档不包含 Mod 图片，迁移设备时同时保留存档与原始 Mod ZIP。
