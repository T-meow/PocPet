import type { AdventureChoice } from './adventureData';
import type { AdventureState, AdventureTrip } from './adventureTypes';
import type { FacilityId } from './communityTypes';
import type { Inventory, PetState } from './petTypes';

export const valleyQuestIds = ['valley_gather', 'valley_ridge', 'valley_crossing', 'valley_lookout', 'valley_story', 'valley_encounter', 'valley_camp'] as const;
export type ValleyQuestId = typeof valleyQuestIds[number];
export type ValleyNode = 'gather' | 'ridge' | 'crossing' | 'lookout' | 'story' | 'encounter' | 'camp';
interface ValleyStep { title: string; story: string; choices: AdventureChoice[] }
interface ValleyQuest {
  node: ValleyNode; name: string; summary: string; outcome: string;
  requires: ValleyQuestId[]; coins: number; hearts: number; items: Inventory;
  facilities?: FacilityId[]; steps: ValleyStep[];
}
const choice = (id: string, label: string, detail: string, hunger = 8, energy = 4, extra: Partial<AdventureChoice> = {}): AdventureChoice => ({ id, label, detail, hunger, energy, ...extra });

export const valleyQuests: Record<ValleyQuestId, ValleyQuest> = {
  valley_gather: {
    node: 'gather', name: '水渠的第一滴水', summary: '顺着溪谷水渠辨认香草，把种子与暖粥配方带回家。', outcome: '带回香草种子 ×2，在已经开放的菜地种植，再给邻居送一碗暖粥。',
    requires: [], coins: 20, hearts: 3, items: { creek_herb_seed: 2, creek_herb: 2, community_wood: 2, community_stone: 1 },
    steps: [
      { title: '溪边的旧刻痕', story: '石头上刻着一片叶子。旧水渠在这里分成两道，一道通往社区，一道没入草丛。', choices: [choice('trace', '沿水渠寻找', '记下水流通往农场的方向。')] },
      { title: '石缝里的香气', story: '几株香草仍守着浅浅的水洼。取种时留下根，明年这里还会绿起来。', choices: [choice('roots', '留下根，仔细收种', '普通路线，不需要工具。', 8, 5), choice('reach', '用绳索稳住身体', '探路绳保留；轻松够到石缝。', 6, 2, { tool: true })] },
      { title: '让水流回去', story: '浅浅的水流绕过石缝，旧手册里写着香草暖粥的做法。回到社区，就能把这份香气种进自己的菜地。', choices: [choice('water', '记下香草配方，收好种子', '带回香草种子 ×2、木料与石料。', 8, 3, { mood: 4 })] },
    ],
  },
  valley_ridge: {
    node: 'ridge', name: '坡道上的旧农舍', summary: '穿过青苔坡，找回农舍留下的饲喂与饮水装置。', outcome: '保存鸡舍、牛棚的建设线索。菜地建成后可以修鸡舍，再开放牛棚。',
    requires: [], coins: 25, hearts: 3, items: { community_wood: 3, community_stone: 2 }, facilities: ['coop', 'barn'],
    steps: [
      { title: '青苔下的石阶', story: '坡道的木牌歪在一边，远处露出农舍的屋顶。小路有些长，但每一步都踩得稳。', choices: [choice('stairs', '沿旧石阶慢慢上坡', '安全绕行，不损失健康。', 10, 5), choice('rope', '借助绳索登坡', '需要探路绳，工具不会消耗。', 7, 3, { tool: true })] },
      { title: '空着的饲喂槽', story: '谷仓里还留着能转动的饲喂装置。把结构画下来，比搬走整座木架更有用。', choices: [choice('feeder', '描下装置结构', '找到鸡舍的修复线索。', 8, 4)] },
      { title: '牧道边的水桶', story: '门后的图纸画着一套饮水设备。伙伴说，等菜地和鸡舍热闹起来，也许这里能有新邻居。', choices: [choice('farm', '收好图纸与可用建材', '永久保留两处线索；带回木料 ×3、石料 ×2。', 8, 3, { mood: 3 })] },
    ],
  },
  valley_crossing: {
    node: 'crossing', name: '旧桥那边的来信', summary: '带着两条支路的记录，与旧桥守望者确认通往水边小屋的路。', outcome: '获得钓鱼小屋的修复图纸；旧桥也是寻物、采集和送餐委托的交会点。',
    requires: ['valley_gather', 'valley_ridge'], coins: 30, hearts: 3, items: { community_wood: 3, community_stone: 2 }, facilities: ['fishing_hut'],
    steps: [
      { title: '桥头的两份记录', story: '水渠与农舍的笔记终于接到了一起。守望者招招手，邀请你看看桥后的栈桥。', choices: [choice('meet', '与守望者核对路线', '抵达旧桥后可以交付已接的送餐委托。')] },
      { title: '松动的木板', story: '中间一块木板晃了晃。沿岸有条浅浅的小径，带了绳索也能从结实的桥柱旁通过。', choices: [choice('bank', '沿岸边安全绕行', '不需要工具或额外物资。', 10, 5), choice('rope', '系好探路绳通过', '探路绳不消耗。', 7, 2, { tool: true })] },
      { title: '给小屋留一扇窗', story: '守望者递来一张栈桥修复图纸：“那间小屋很久没有亮灯了。修好后，欢迎随时来坐坐。”', choices: [choice('letter', '收下图纸，记下旧桥发现', '稳定完成已接寻物／采集；带回小屋建材。', 8, 3, { mood: 5 })] },
    ],
  },
  valley_lookout: {
    node: 'lookout', name: '风声里的上游', summary: '从观景台辨认溪流分岔，为小屋寻找第二处水域。', outcome: '保存上游步道的勘测记录；钓鱼小屋建成后即可修步道。',
    requires: ['valley_crossing'], coins: 30, hearts: 3, items: { community_wood: 1, community_stone: 3 }, facilities: ['upstream'],
    steps: [
      { title: '风声观景台', story: '远处的水面亮成一条细线。沿路标走，便能看清溪流分岔。', choices: [choice('view', '走到稳固的观景台', '标记溪流与社区的方向。', 8, 4)] },
      { title: '水流的两种声音', story: '近处的池塘安静，上游却有清亮的流水声。石阶和岸线都可以慢慢勘测。', choices: [choice('survey', '沿石阶逐段记录', '普通路线，保留全部健康。', 10, 5), choice('listen', '静下心辨认水声', '心情至少 30%；更省体力。', 8, 3, { minMoodRatio: 0.3, mood: 2 })] },
      { title: '第二个钓点', story: '手账上多出一段清楚的岸线。伙伴在旁边画了一条小鱼：等步道修好，再来这里试试。', choices: [choice('upstream', '收好水域勘测记录', '获得上游建设线索与石料。', 8, 3, { mood: 4 })] },
    ],
  },
  valley_story: {
    node: 'story', name: '温室里未完的约定', summary: '推开旧温室的门，读完守园人留下的手账。', outcome: '找回溪畔小摊的图纸，让种养与鱼获有去处；温室的约定写入溪谷故事。',
    requires: ['valley_crossing'], coins: 35, hearts: 4, items: { community_wood: 2, community_stone: 1, carrot_seed: 2 }, facilities: ['stall'],
    steps: [
      { title: '被藤蔓遮住的门', story: '温室门口结着细细的藤。没有锁，只有风里轻轻摇动的木牌：请记得给邻居留一点收获。', choices: [choice('door', '仔细拨开藤蔓', '慢慢清理，不消耗工具。', 10, 5)] },
      { title: '守园人的手账', story: '“菜地长出的、溪水送来的，都可以摆上那张小木桌。遇见需要的人，就一起做顿饭。”书页里夹着摊位图纸。', choices: [choice('journal', '读完旧日的约定', '永久保存温室故事与小摊图纸。', 8, 3, { mood: 5 })] },
      { title: '把种子带回日常', story: '抽屉里剩下两包胡萝卜种子。你与伙伴约好：修好菜地，做一碗热饭，把这份心意继续传下去。', choices: [choice('promise', '收好种子，留下新的一页', '带回胡萝卜种子与建材。', 8, 3)] },
    ],
  },
  valley_encounter: {
    node: 'encounter', name: '石芽与迷路的小客人', summary: '跟随观景台看见的足迹，为温室旁的小动物找回安全的路。', outcome: '记下与石芽的相遇，辨认通往休息间的最后一段路。',
    requires: ['valley_lookout', 'valley_story'], coins: 35, hearts: 4, items: { creek_herb: 2, community_wood: 2 },
    steps: [
      { title: '会动的石头', story: '长着嫩芽的石块后面，有一双小眼睛。小客人被散落的树枝困住，紧张地缩成一团。', choices: [choice('wait', '蹲下来，给它一点时间', '不需要礼物，也能友善靠近。', 8, 4, { mood: 2 })] },
      { title: '给彼此留条路', story: '它还不肯走。可以放一点食物，也可以安静地把旁边的树枝挪开。', choices: [choice('clear', '慢慢挪开树枝', '普通方式，不消耗物品。', 10, 6), choice('lure', '用野果诱饵引路', '消耗行囊诱饵 ×1，作为交付使用。', 6, 2, { item: 'berry_bait' }), choice('apple', '留下一颗苹果', '消耗行囊苹果 ×1，不触发喂食。', 7, 3, { item: 'apple' })] },
      { title: '石芽后的小径', story: '小客人钻进树荫，又回头望了望。它走过的地方正连着温室休息间，脚边还有一丛香草。', choices: [choice('friend', '记下足迹与新的路', '带回香草 ×2、木料 ×2；没有战斗或随机门槛。', 8, 3, { mood: 6 })] },
    ],
  },
  valley_camp: {
    node: 'camp', name: '溪谷第一盏灯', summary: '沿着新发现的小径，和伙伴把休息间整理成可以回访的落脚点。', outcome: '溪谷七处故事全部完成。回到农场，把暖粥、鱼汤和邻里委托接进每天的生活。',
    requires: ['valley_encounter'], coins: 50, hearts: 5, items: { community_wood: 2, community_stone: 2, rice: 2 },
    steps: [
      { title: '休息间的门牌', story: '门上还挂着旧温室的号码。现在你知道每条小路通往哪里，连回家的方向都变得亲切。', choices: [choice('arrive', '推开休息间的门', '确认新的落脚点。', 8, 3)] },
      { title: '擦亮一扇窗', story: '伙伴擦去窗上的灰，你把散落的长凳放好。溪水声从窗外传来，像第一次出发时一样。', choices: [choice('tidy', '一起整理长凳和窗台', '这次整理作为故事行动，不另收建材。', 10, 5)] },
      { title: '第一盏灯', story: '灯亮了。手账里有菜地的水、桥边的信、上游的鱼和温室的约定。下一次出发，也会从这样的小小日常开始。', choices: [choice('light', '点亮灯，把溪谷写进手账', '领取一次性章节成果；日常委托与生产继续开放。', 8, 3, { mood: 8 })] },
    ],
  },
};

export const isValleyQuest = (id: unknown): id is ValleyQuestId => typeof id === 'string' && (valleyQuestIds as readonly string[]).includes(id);
export const valleyQuestForNode = (node: string) => valleyQuestIds.find(id => valleyQuests[id].node === node);
export const getAdventureRouteNode = (purpose?: string): ValleyNode | 'entrance' => isValleyQuest(purpose) ? valleyQuests[purpose].node
  : purpose === 'irrigation' || purpose === 'seeds' ? 'gather' : purpose === 'coop' || purpose === 'barn' ? 'ridge'
    : purpose === 'upstream' ? 'lookout' : purpose === 'stall' ? 'story' : purpose ? 'crossing' : 'entrance';
export const getValleyQuestReason = (state: AdventureState, id: ValleyQuestId) => {
  if (!(state.completed.tutorial ?? 0)) return '先完成踩点探索，展开溪谷地图。';
  if (state.valleyCompleted?.includes(id)) return '这段故事已完成，首次成果不会重复发放。';
  if (!(state.completed.valley ?? 0)) return '先完成一次溪谷入口探查并收好行囊。';
  const missing = valleyQuests[id].requires.filter(required => !state.valleyCompleted?.includes(required));
  return missing.length ? `先完成「${missing.map(required => valleyQuests[required].name).join('」「')}」。` : '';
};
export const getValleyQuestCosts = (id: ValleyQuestId, multiplier = 1) => {
  const steps = valleyQuests[id].steps;
  const total = (stat: 'hunger' | 'energy', pick: typeof Math.min) => steps.reduce((sum, step) => sum + pick(...step.choices.map(option => Math.ceil(option[stat] * multiplier))), 0);
  return { hunger: [total('hunger', Math.min), total('hunger', Math.max)], energy: [total('energy', Math.min), total('energy', Math.max)] };
};
export const completeValleyQuest = (pet: PetState, id: ValleyQuestId): PetState => {
  if (pet.adventure.valleyCompleted.includes(id)) return pet;
  const facilities = { ...pet.community.facilities };
  for (const facility of valleyQuests[id].facilities ?? []) facilities[facility] = { ...facilities[facility], found: true };
  return { ...pet, adventure: { ...pet.adventure, valleyCompleted: [...pet.adventure.valleyCompleted, id] },
    community: { ...pet.community, facilities, ...(id === 'valley_gather' ? { irrigationFound: true, herbDiscovered: true } : {}),
      ...(id === 'valley_camp' ? { expedition: { ...pet.community.expedition, regions: { ...pet.community.expedition.regions, valley: { ...pet.community.expedition.regions.valley, surveyed: true, storyAt: pet.lastUpdatedAt, actorId: pet.adventure.active?.actorId, actorName: pet.adventure.active?.actorName } } } } : {}) } };
};
// A parcel is handed over at an actual bridge stop, never from another story's final screen.
export const isAtCommunityBridge = (trip: AdventureTrip) => trip.region === 'valley' && (isValleyQuest(trip.purpose)
  ? trip.purpose === 'valley_crossing' && trip.choices.length >= 1
  : trip.choices.length >= (trip.purpose ? 3 : 4));
