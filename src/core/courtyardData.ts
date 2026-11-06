import type { FoodRarity } from './foodCatalog';
import type { CourtyardAction } from './courtyardTypes';
import type { BuiltinItemId } from './petTypes';

export const courtyardRefreshHours = 4;
export const courtyardVisitorLimit = 3;
export const courtyardHistoryLimit = 200;
export const courtyardActions: readonly CourtyardAction[] = ['chat', 'play', 'share', 'help'];
export const courtyardActionBits: Record<CourtyardAction, number> = { chat: 1, play: 2, share: 4, help: 8 };
export const courtyardActionNames: Record<CourtyardAction, string> = { chat: '聊天', play: '玩耍', share: '分享料理', help: '帮忙' };
export const courtyardEnergyCosts: Record<CourtyardAction, number> = { chat: 0, play: 10, share: 0, help: 5 };
export const courtyardGiftChances: Record<FoodRarity, number> = { common: 2, fine: 5, rare: 10, epic: 20, legendary: 35 };
export const courtyardSharePoints: Record<FoodRarity, number> = { common: 3, fine: 4, rare: 6, epic: 8, legendary: 12 };
export const courtyardPremiumGifts = ['creek_aquamarine', 'hill_sunstone', 'forest_emerald', 'tidal_pearl', 'star_sapphire', 'golden_apple'] as const;
export const courtyardOrdinaryItems = ['reinforced_rod', 'harvest_nutrient', 'care_tree_sapling', 'gift_tree_sapling',
  'eggshell_sticker_roly_poly', 'shell_hand_rattle', 'sticker_pinwheel', 'flower_bell_wand'] as const satisfies readonly BuiltinItemId[];

export const courtyardFamiliarityTier = (points: number) => points >= 150 ? 3 : points >= 60 ? 2 : points >= 20 ? 1 : 0;
export const courtyardGreetings = [
  ['「这里的风很舒服，要坐一会儿吗？」', '「刚到小院就碰见了，一起歇歇脚吧。」', '「今天的小院很安静，正适合说说话。」'],
  ['「又碰面了。今天有什么想分享的事吗？」', '「刚才看见门口的花开了，想告诉你一声。」', '「这边还有位置，过来坐坐吧。」'],
  ['「看到你过来，今天的小院好像更热闹了。」', '「上次一起玩的事还记得，今天也待一会儿吧。」', '「给你留了个舒服的位置，慢慢聊。」'],
  ['「不用急着找话题，像平时那样待一会儿就很好。」', '「和你一起坐在这里，总觉得时间过得很轻。」', '「今天也见到了，真好。有空就一起做点什么吧。」'],
] as const;
export const courtyardResponses = [
  ['你们又多了解了彼此一点。', '小院里多了一段轻松的相处。', '下一次见面，应该会更自在些。'],
  ['熟悉的笑声又在小院里响起来。', '你们聊起上次相处的小事，气氛很自然。', '这次相处比上回又轻松了一些。'],
  ['你们已经很有默契，一个眼神就明白了意思。', '普通的小事，因为一起做而变得值得记住。', '离开前，你们约好有空再来小院坐坐。'],
  ['不用多说，彼此就懂得这一份心意。', '像很多次相处一样，今天也留下了温暖的记忆。', '这份陪伴已经成为日常里很安心的一部分。'],
] as const;

export const courtyardEvents: Record<CourtyardAction, readonly { title: string; text: string }[]> = {
  chat: [
    { title: '树荫下的闲聊', text: '{neighbor}指了指地上的树影。你们聊起最近遇到的小事，听着风吹过叶子的声音。' },
    { title: '猜猜云的形状', text: '一朵云慢慢飘过屋顶。{neighbor}说它像一块点心，你们又找出了好几种不同的形状。' },
    { title: '今日的小发现', text: '{neighbor}发现墙边冒出一朵小花。你们蹲下来仔细看了看，约好下次再来看看它。' },
    { title: '厨房里的香气', text: '{neighbor}聊起最近闻到的料理香气。你们交换了各自想尝的味道，话题越聊越多。' },
    { title: '沿路的风景', text: '你们坐在长椅上，聊起走来小院时看到的景色。{neighbor}认真听完，也分享了一段见闻。' },
    { title: '留一会儿空闲', text: '茶杯边冒着一点热气。{neighbor}和你聊了聊今天的安排，最后决定先享受这一会儿空闲。' },
  ],
  play: [
    { title: '抛接小球', text: '你和{neighbor}在草地上抛接小球。球偶尔落进花边，你们捡回来，又试着多接了几次。' },
    { title: '树下猜谜', text: '{neighbor}想了几个轻松的谜语。你们轮流猜答案，猜错的时候也一起笑了出来。' },
    { title: '追着泡泡跑', text: '一串泡泡在阳光下亮了起来。你和{neighbor}追着它们跑了一小圈，看最后一个泡泡飘过树梢。' },
    { title: '落叶小赛道', text: '你们各选了一片落叶，轻轻吹着它沿石缝前进。{neighbor}的叶子绕了个弯，比赛又多了点悬念。' },
    { title: '拍手接节奏', text: '{neighbor}先拍出一个简单节奏，你跟着接上。你们慢慢加快速度，最后默契地一起停了下来。' },
    { title: '寻找小颜色', text: '你和{neighbor}轮流说出一种颜色，再在小院里寻找它。最后找到的那抹亮色，藏在一朵小花中间。' },
  ],
  share: [
    { title: '茶桌上的分享', text: '你把{food}放到茶桌上。{neighbor}认真尝了一口，又拿出一份准备好的心意回赠给你。' },
    { title: '刚好想起的味道', text: '{neighbor}接过你带来的{food}，聊起它的香气。离开茶桌前，一份回礼被轻轻递到你手里。' },
    { title: '树荫下尝一口', text: '树影落在餐盘旁。{neighbor}尝了尝{food}，把今天带来的小礼物分享给了你。' },
    { title: '留给小院的香气', text: '打开餐盒，{food}的香气散开。{neighbor}道了谢，也送来一份心意，让这次分享有了回应。' },
    { title: '一份好好准备的心意', text: '你把{food}交给{neighbor}。你们聊了几句这道料理，随后交换了彼此准备的小心意。' },
    { title: '今天也有好味道', text: '{neighbor}在长椅边腾出位置，收下了{food}。尝过后，一份回礼也送到了你的面前。' },
  ],
  help: [
    { title: '给花草浇水', text: '{neighbor}正准备给花草浇水。你帮着提来水壶，让每一小片泥土都喝到了水。' },
    { title: '整理小茶桌', text: '你和{neighbor}把茶杯摆好，擦净桌面。小茶桌重新变得整整齐齐，等着下一位来客。' },
    { title: '收拢落叶', text: '风吹来了几片落叶。你帮{neighbor}把它们收进小篮子，留出一条干净的石板路。' },
    { title: '摆好小花盆', text: '{neighbor}想给花盆换个更有阳光的位置。你帮忙挪了挪，让叶片都能舒展开。' },
    { title: '挂好小风铃', text: '你帮{neighbor}把松开的风铃挂回门边。轻轻一阵风吹来，清脆的声音又响了起来。' },
    { title: '收拾长椅', text: '{neighbor}正在整理长椅上的坐垫。你搭了把手，又顺便把旁边的小物件收好了。' },
  ],
};
