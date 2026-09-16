import type { RecipeId } from './companionActivityTypes';
import type { SeasonalFestivalId } from './festivalCalendar';

export interface SeasonalRun {
  id: string;
  festival: SeasonalFestivalId;
  scriptVersion: 1;
  year: number;
  actorId: string;
  actorName: string;
  startedAt: number;
  completedAt: number;
  rewardClaimedAt: number;
  stage: string;
  choices: Record<string, string>;
}
export interface SeasonalOption { id: string; label: string; recipe?: RecipeId }
export interface SeasonalStep { id: string; title: string; paragraphs: string[]; options?: SeasonalOption[]; recipe?: RecipeId }
const options = (labels: Record<string, string>): SeasonalOption[] => Object.entries(labels).map(([id, label]) => ({ id, label }));
const step = (id: string, title: string, paragraphs: string[], choices?: SeasonalOption[], recipe?: RecipeId): SeasonalStep => ({ id, title, paragraphs, options: choices, recipe });

// Script text stays in the application. New English translations are deferred to a major release.
export const seasonalScripts: Record<SeasonalFestivalId, { title: string; summary: string; steps: (run: SeasonalRun) => SeasonalStep[] }> = {
  'national-day': {
    title: '地图外的一小段', summary: '选一条路出门走走，把风景和小插曲带回来。',
    steps: ({ actorName: name, choices: c }) => [
      step('route', '空出来的一天', [
        `街边挂起了小旗，窗外比平时热闹。你把附近的地图铺在桌上，${name}把水杯放在一旁，正好压住翘起来的一角。`,
        '“这次能不能在计划里写上吃饭？”', '你在地图边上补了一个圆。“这看起来比较像一个饼。”', '第一处想去哪里？',
      ], options({ street: '去老街，沿着店铺和小巷慢慢走', river: '去河堤，顺着水边找个能坐下的地方' })),
      step('discovery', '路上的发现', c.route === 'street' ? [
        '你们在一家小店外停住，橱窗里摆着旧风车。其中一只一直不转，刚准备走，它忽然动了起来。', `${name}又停下来，看着它转了好几圈：“它是不是刚才也在放假？”`,
      ] : [
        '桥洞把脚步声放大了一点。你们试着发出一声很轻的招呼，回声从另一头慢吞吞地回来。', `${name}认真听完：“听到了。这里回消息比较慢。”`,
      ]),
      step('detour', '地图上没有的小展览', [
        '路口多了一块临时指示牌：一间旧屋正在展出附近居民画的街景。按照原计划，你们这时该往观景处走。', `${name}把地图展开，又看向那块小牌子：“接下来呢？”`,
      ], options({ view: '按原计划去看风景', exhibit: '拐进去看看小展览' })),
      step('postcard', '给今天取个名字', [
        c.detour === 'view' ? `你们提早找到了好位置，看着光线一点点移动。${name}把地图折成小扇子：“提前到达的奖励，是可以坐着等。”` : `展览里的一幅画把刚才走过的路画得特别弯。${name}来回比了比：“怪不得我们走了这么久。”你们在留言纸上画了一张更弯的路线。`,
        '傍晚回去的路上，你们在公园长椅坐了一会儿。地图折痕比早上多了几道，一张明信片摊在旁边，等着留下一句话。',
      ], options({ scenery: '原来附近还有这样的风景', moments: '今天最值得记住的是这些小插曲' })),
      step('ending', '地图外的一小段', [
        c.postcard === 'scenery' ? `${name}指着地图，把今天停过的地方逐一圈出来。你们在明信片上记下了那段一起走过的风景。` : `${name}先记下${c.route === 'street' ? '那只突然转起来的风车' : '那段慢半拍的回声'}，又补上${c.detour === 'view' ? '一起坐着等光线变化' : '一起画歪地图'}的插曲。`,
        '远处，街道的灯陆续亮起来。你们把明信片夹进地图，留出一小截边角。', '“下次还带它吗？”', '“带。”', '“那下次吃饭的地方，可以画大一点。”',
      ]),
    ],
  },
  'labour-day': {
    title: '这就算收工了', summary: '一起完成一件小工程，再认真地休息一会儿。',
    steps: ({ actorName: name, choices: c }) => [
      step('project', '一张越写越长的清单', [
        `五一假期，你刚写下“整理一下小窝”，后面就多出了好几行。${name}看着清单，慢慢把下面半张折起来。`, '“先做一件吧。剩下的暂时看不见。”',
      ], options({ window: '整理窗边，空出坐下来喝东西的位置', stool: '修好小凳，换上干净坐垫' })),
      step('incident', '越收拾越乱', [
        c.project === 'window' ? '盒子摆好以后，盖子却找不到了。翻了几遍，你们才发现它正被拿来装刚归好的小东西。' : '螺丝逐一摆进小碟，垫布也铺好了。最后缺的工具，原来一直压在刚画的草图下面。',
        `${name}看着比刚才更乱的地面：“现在应该算……已经做到一半了？”`, '你们对看了一会儿，一起笑了出来。好在要用的东西，这下全找齐了。',
      ]),
      step('drawing', '歪了也能认出来', [
        '你们想为今天的小工程画个纪念标记，结果第一笔就歪了。纸还很空，那条歪线却有一点自己的主意。', `${name}把铅笔递过来：“要接着画吗？”`,
      ], options({ keep: '顺着歪线画下去', redraw: '翻过来，重新画一张' })),
      step('rest', '剩下的明天再说', [
        c.drawing === 'keep' ? `歪方框变成了一个打哈欠的表情。${name}很满意：“至少一看就知道，这是拿来休息的。”` : `${name}认真扶住纸，等你画完才小声说：“背面那张也别扔，它努力过。”`,
        c.project === 'window' ? '窗边终于能放下两只杯子了。清单下面还有好几项，工具已经收好，阳光正落在空出来的位置。' : '小凳终于坐稳了，新坐垫也铺好了。清单下面还有好几项，工具已经收好，阳光正落在凳边。',
      ], options({ stop: '现在收工，坐下来歇一会儿', check: '先认真验收，再正式收工' })),
      step('ending', '这就算收工了', [
        c.rest === 'stop' ? `${name}立刻把那半张清单折得更小：“好，这件事我很擅长。”` : `你们${c.project === 'window' ? '摆好杯子' : '试坐了一会儿'}，郑重宣布合格。${name}补充：“验收项目还应该包括，坐着的时候不想马上起来。”`,
        '午后的光落在休息角。工具收进盒子，纸卡夹在一旁，清单被压在最下面。', '“现在还算在一起做事吗？”', '你说，算。', '“那今天最后一件事，就叫一起发会儿呆。”',
      ]),
    ],
  },
  'dragon-boat': {
    title: '粽叶小船', summary: '一起包粽子，再用两片粽叶开一场小小的比赛。',
    steps: ({ actorName: name, choices: c }) => [
      step('flavour', '先选咸甜', [
        `粽叶洗净后铺在盘子里，绳子却滚到桌边。${name}把它拦住，又看了看你准备的馅料。`, '“今天最难的部分，是把它们包起来，还是等它们煮好？”',
      ], [{ id: 'pork', label: '烧肉粽', recipe: 'zongzi_braised_pork' }, { id: 'bean', label: '豆沙粽', recipe: 'zongzi_red_bean' }]),
      step('wrap', '一只包不住的粽子', [
        c.flavour === 'pork' ? `${name}闻到肉香，已经开始认真研究锅盖。` : `${name}把豆沙归拢好，提醒你留一点耐心给糯米慢慢变软。`,
        '第一片叶子刚合上，边角就翘了起来。再试一次，另一边又露出一点米。', '“它可能觉得自己应该再大一点。”',
      ], options({ small: '少放一点馅，重新包紧', leaf: '再加一片叶子，包成大个头' })),
      step('prepare', '给小比赛留一份粽子', [
        c.wrap === 'small' ? `这只粽子明显小了一圈。${name}把它排在最前面：“队长不一定要最大。”` : `粽子终于扎稳了。${name}转着看了看：“它穿得比别的厚。”`,
        '去厨房准备一份选好的粽子吧。回来后留一份在桌上，等小比赛结束再一起吃。',
      ], undefined, c.flavour === 'pork' ? 'zongzi_braised_pork' : 'zongzi_red_bean'),
      step('boats', '水盆里的小小航程', [
        `粽子留好了，桌边还剩两片干净粽叶。窗外远远传来鼓点，${name}试着把叶子两端折起来，放进浅水盆。`, '“大船那边在比赛。我们这边也能开一场。”', '你们在盆边约定一个终点，轻轻拨一下水，小船就顺着波纹动起来。',
      ], options({ straight: '直着往终点去', stone: '绕过中间的小石头' })),
      step('ending', '粽叶小船', [
        c.boats === 'straight' ? '一只船先靠岸，另一只在原地转了一圈才跟上。“第一名负责等第二名。”' : '你的船绕得顺利，另一只转了半圈。拨一下水，两只船终于从同一侧经过。“路线长一点，也还是能到。”',
        c.flavour === 'pork' ? `粽叶剥开，米粒裹着肉香。${name}已经把小盘子挪到最方便分享的位置。` : `糯米间露出细软的豆沙。${name}先放凉了一小块：“这次等得值得。”`,
        '浅水盆旁，两只捞起晾着的叶舟一大一小。窗外又响了一阵鼓点。', '“它们明年还能比赛吗？”', '“明年再折两只。”', '“那今天的船，要记得留在故事里。”',
      ]),
    ],
  },
  'spring-festival': {
    title: '新年的第一碗', summary: '贴一张窗花，吃一顿热饭，拆开一份悄悄准备的祝福。',
    steps: ({ actorName: name, choices: c }) => [
      step('decoration', '红纸先贴在哪里', [
        '街上的灯比平常亮，小窝里多了一叠红纸。你们选好一张窗花，拿着比了好几个位置。', `${name}问：“这里可以吗？”说完，又退远了一点。`,
      ], options({ door: '贴在门边，回来就能看见', window: '贴在窗边，让灯光透过花纹' })),
      step('flavour', '饺子想吃哪一种', [
        c.decoration === 'door' ? '“这样我们出去一趟，就能再过一次进门的新年。”' : '花纹的影子落在一旁。“这下屋里屋外都有一点红了。”',
        `${name}把盘子摆好，等着和你一起准备今年的这一顿饭。`,
      ], [{ id: 'pork', label: '白菜肉饺子', recipe: 'dumplings_pork_cabbage' }, { id: 'vegetable', label: '素馅饺子', recipe: 'dumplings_vegetable' }]),
      step('prepare', '一起准备一顿热饭', [
        c.flavour === 'pork' ? `白菜拌进肉馅，${name}把刚包好的几只轻轻挪开，腾出下一排的位置。` : `香菇、白菜和胡萝卜颜色分明。${name}看了一眼：“这一盘还没下锅，就已经很热闹了。”`,
        '去厨房准备一份选好的饺子吧。回来摆好餐桌，还有一份悄悄准备的祝福等着你。',
      ], undefined, c.flavour === 'pork' ? 'dumplings_pork_cabbage' : 'dumplings_vegetable'),
      step('blessing', '三张偷偷准备的祝福', [
        `饺子端上桌，热气慢慢升起来。${name}拿出三张折好的红纸，每张外面都有一个小记号。`, '“本来想写得很正式，后来觉得还是这几句比较有用。”', '你挑哪一张？',
      ], options({ meal: '小碗记号 · 热饭签', sleep: '云朵记号 · 好觉签', road: '小路记号 · 顺路签' })),
      step('ending', '新年的第一碗', [
        c.blessing === 'meal' ? '“愿你想吃的总能吃到，饭凉之前，总有时间坐下来。”旁边又添了一句：“饺子已经好了，这条今天就能实现。”' : c.blessing === 'sleep' ? '“愿你困的时候安心睡，醒来的时候，有想做的事。”红纸被轻轻折回去：“这张也可以放在枕边。”' : '“愿你想去的地方慢慢走到，绕了路，也遇到一点好事。”“今年从这里出发。”',
        '你们数了一遍饺子，又数一遍，发现刚才一直把同一只圆鼓鼓的当成了两只。“看来它确实很有分量。”',
        `你把祝福放在碗旁，${name}先送来一句新年好。隔着热气，你也回了一句。`, '“新年第一件好事，应该已经有了。”', '“是什么？”', '“这碗饺子，有人陪我吃。”',
      ]),
    ],
  },
};

export const getSeasonalSteps = (run: SeasonalRun) => seasonalScripts[run.festival].steps(run);
