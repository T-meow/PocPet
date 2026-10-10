import type { AdventureRegionId } from './adventureTypes';
import type { LandmarkNode } from './landmarkProgress';
import type { ItemId } from './petTypes';

export const campaignTitle = '去山上吃顿饭';
export const campaignChapterIds = ['valley', 'windmill', 'forest', 'coast', 'observatory'] as const;
export type CampaignChapterId = typeof campaignChapterIds[number];
export const campaignVisitIds = ['valley_bridge', 'valley_chairs', 'hill_honey', 'hill_sign', 'hill_lamps', 'forest_basket', 'forest_cloth', 'forest_meet', 'coast_boxes', 'coast_glass', 'station_room', 'station_path', 'station_dinner'] as const;
export type CampaignVisitId = typeof campaignVisitIds[number];
export interface CampaignDelivery { items: ItemId[]; amount: number }
export interface CampaignOption { id: string; label: string; result: string }
export interface CampaignStep {
  title: string; story: string; options: CampaignOption[]; task?: number; delivery?: CampaignDelivery;
}
export interface CampaignVisit {
  region: AdventureRegionId; node: LandmarkNode; requires: number[]; steps: CampaignStep[];
}
export interface CampaignTask { id: number; chapter: CampaignChapterId; title: string; goal: string; outcome: string; hearts: number; apples: number }
export const campaignChapters: Record<CampaignChapterId, { title: string; requires: number[]; keepsake: string }> = {
  valley: { title: '先把凳子准备好', requires: [], keepsake: '修好的凳子' },
  windmill: { title: '灯和蜂蜜一起带', requires: [6], keepsake: '蜂蜜和包好的灯具' },
  forest: { title: '顺路去拿块桌布', requires: [12], keepsake: '叠好的桌布' },
  coast: { title: '海边还有几样东西', requires: [12], keepsake: '装好灯片的箱子' },
  observatory: { title: '人到齐就开饭', requires: [18, 24], keepsake: '大家一起吃的这顿饭' },
};
const taskRows: [string, string, string, number, number][] = [
  ['去旧桥碰个面', '到旧木桥和伙伴商量聚餐需要准备什么。', '和{neighbor}约好了，先去找几张能用的凳子。', 300, 1],
  ['饭盒落在桥下', '沿桥墩旁的小路找回空饭盒。', '沿桥边小路找回了饭盒，盒盖也没丢。', 300, 1],
  ['午饭别放凉', '在旧木桥交付便当或香草暖粥 ×1。', '一起吃过午饭，{neighbor}想起温室里有几张闲置的凳子。', 400, 2],
  ['温室里有几张凳子', '到温室休息间挑出能带走的凳子。', '挑好了几张凳子，其中一条腿需要再固定一下。', 400, 2],
  ['修好那条凳腿', '在温室休息间交付木料 ×2，修好凳腿。', '松动的凳腿修好了，坐上去也不会晃。', 500, 3],
  ['凳子有人帮忙搬', '和伙伴确认集合地点与搬运安排。', '大家在旧桥集合，凳子由参加聚餐的邻居一起搬。', 1100, 6],
  ['蜂蜜也带一罐', '在香草花田交付蜂蜜 ×3。', '{neighbor}把蜂蜜装好了，聚餐时可以加在水里喝。', 400, 1],
  ['上山别走岔路', '在金色瞭望台确认上山的外侧石路。', '认清了转弯处，大家约好沿外侧石路上山。', 400, 2],
  ['路牌朝错了', '在金色瞭望台交付木料 ×1，固定集合路牌。', '路牌重新固定好了，箭头指向约定的石路。', 500, 2],
  ['营地里的旧灯', '到避风小营地检查借来的灯罩和提手。', '灯罩和提手都还结实，这几盏灯可以借来用。', 500, 2],
  ['山上风会更大', '和伙伴试放灯具，找好挡风的位置。', '试过门边和窗边，知道灯该放在哪里了。', 700, 3],
  ['灯就这样带过去', '包好灯具，和伙伴确认由谁带上山。', '{neighbor}答应把灯和蜂蜜一起带上山。', 2000, 10],
  ['路边翻倒的篮子', '在林莓丛沿掉落的果子找到篮子。', '找到了翻倒的篮子，旁边还有个不肯走的小家伙。', 500, 2],
  ['别追那只小家伙', '给篮子旁的小动物留一条可以离开的路。', '小家伙自己离开了，篮子也拿回来了。', 500, 2],
  ['给篮子补一点', '在林莓丛交付雾松林莓 ×3。', '把准备分享的果子补齐，重新装进了篮子。', 700, 3],
  ['古树里那块桌布', '到空心古树找到以前野餐留下的桌布。', '在古树里的旧布包中找到了桌布。', 700, 3],
  ['抖干净再收', '展开桌布，抖掉松针，再叠好带走。', '桌布收拾干净了，放在聚餐桌上正合适。', 900, 4],
  ['给晚到的伙伴留个位', '到林间守望小屋和伙伴确认出发安排。', '{neighbor}还想顺路采点东西，大家答应留个位置。', 2700, 11],
  ['问清楚回程的路', '到旧栈桥确认回程时走高处通路。', '和{neighbor}说好了，回程沿高处通路走。', 600, 2],
  ['栈桥上绊脚的绳子', '收好散落绳头，腾出搬东西的地方。', '绳头卷好放到一边，搬箱子时不用再绕着走。', 600, 2],
  ['箱子先搬上去', '把备用灯罩箱搬到高处，检查箱盖。', '灯罩箱搬到了干燥的地方，箱盖也扣好了。', 800, 3],
  ['挑两片厚实的', '在海边旧船屋交付潮汐海玻璃 ×2。', '挑好了两片适合做灯片的海玻璃。', 800, 3],
  ['把边角包好', '用旧船屋里的布条包好玻璃边沿。', '灯片的边角包好了，装箱后也不会相互磕碰。', 1000, 4],
  ['到时候一起走', '和伙伴约好在船屋碰头，再一起出发。', '{neighbor}会在船屋等大家，箱子也由这边带上山。', 2700, 11],
  ['先收拾窗边', '到旧观测穹顶清理窗边，腾出座位。', '窗边收拾好了，借来的凳子有地方摆了。', 800, 3],
  ['小灯还差几个零件', '在旧观测穹顶交付观测零件 ×2。', '聚餐用的小灯修好了，可以放在座位旁。', 1000, 3],
  ['把回去的路看一遍', '检查星空观景台的返程路牌、扶手和灯位。', '回去的路线已经看过，转弯处也留好了灯位。', 1200, 4],
  ['饭还差两份', '在观测站值班室交付便当或香草暖粥，共 2 份。', '饭菜都摆上桌了，蜂蜜也兑好了水。', 1500, 5],
  ['看看还有谁没到', '迎接来聚餐的伙伴，留好晚到的座位。', '来帮忙的伙伴陆续到了，晚到的那位也赶上了饭点。', 1500, 5],
  ['开饭吧', '一起吃饭，收拾好桌子后去穹顶看看星星。', '凳子、灯和桌布都派上了用场。饭后大家去看了一会儿星星，再结伴回家。', 4000, 20],
];
export const campaignTasks: CampaignTask[] = taskRows.map(([title, goal, outcome, hearts, apples], i) => ({ id: i + 1, chapter: campaignChapterIds[Math.floor(i / 6)], title, goal, outcome, hearts, apples }));
export const getCampaignTask = (id: number) => campaignTasks.find(task => task.id === id);
const quarterlyHearts = [100, 100, 150, 150, 150, 350, 150, 150, 150, 150, 250, 650, 150, 150, 250, 250, 300, 900, 200, 200, 250, 250, 350, 900, 250, 350, 400, 500, 500, 1350];
export const getCampaignReward = (id: number, version: 1 | 2) => version === 1
  ? { hearts: getCampaignTask(id)?.hearts ?? 0, apples: getCampaignTask(id)?.apples ?? 0 }
  : { hearts: quarterlyHearts[id - 1] ?? 0, apples: id < 1 || id > 30 ? 0 : ({ 6: 2, 12: 2, 18: 3, 24: 3, 30: 5 } as Record<number, number>)[id] ?? 1 };
const step = (title: string, story: string, label: string, result: string, task?: number, delivery?: CampaignDelivery): CampaignStep => ({ title, story, options: [{ id: 'continue', label, result }], task, delivery });
const meal = (amount: number): CampaignDelivery => ({ items: ['bento', 'dish_herb_porridge'], amount });
const give = (item: ItemId, amount: number): CampaignDelivery => ({ items: [item], amount });
export const campaignVisits: Record<CampaignVisitId, CampaignVisit> = {
  valley_bridge: { region: 'valley', node: 'crossing', requires: [], steps: [
    step('去旧桥碰个面', '{neighbor}在桥边等你：“地方就选观测站吧。吃的大家各带一点，先看看哪里能借到凳子。”', '坐下来商量一会儿', '先把要借的东西记了下来。', 1),
    step('饭盒落在桥下', '刚准备走，{neighbor}发现饭盒不见了。桥墩旁的小路上露着一个盒角，沿岸边走过去就能拿到。', '沿小路捡回饭盒', '盒盖卡在草里，捡起来擦干净就能用。', 2),
    step('午饭别放凉', '饭盒还是空的。{neighbor}有点不好意思：“出门光顾着找东西，忘了带午饭。吃完我带你去温室，那边有几张闲置的凳子。”', '把准备好的饭递过去', '一起吃过饭，约好接着去温室看看。', 3, meal(1)),
  ] },
  valley_chairs: { region: 'valley', node: 'camp', requires: [3], steps: [
    step('温室里有几张凳子', '{neighbor}指了指窗边：“这几张都能借。左边那张先别坐，腿有点晃。”', '逐张检查一下', '挑出了几张结实的，只剩一条凳腿需要固定。', 4),
    step('修好那条凳腿', '旧凳腿的连接处松了。垫好木料，再让伙伴扶住凳面，就能把它固定稳。', '一起固定凳腿', '试着坐了坐，这次没有再晃。', 5, give('community_wood', 2)),
    step('凳子有人帮忙搬', '{neighbor}掂了掂凳子：“一个人搬太费劲了。到时候大家在旧桥碰头，一人搭把手。”', '约好集合地点', '凳子留在干燥处，搬运也安排好了。', 6),
  ] },
  hill_honey: { region: 'windmill', node: 'gather', requires: [], steps: [
    step('花田边碰个头', '{neighbor}听说要聚餐，已经找来了一个带盖的罐子：“我想带点蜂蜜，喝水的时候加一点。”', '帮忙把罐子洗干净', '罐口擦干了，盖子也能拧紧。'),
    step('蜂蜜也带一罐', '把要带的蜂蜜装好，罐子外面再擦一遍，放进行李时就不会黏得到处都是。', '装好这罐蜂蜜', '{neighbor}收好了蜂蜜，准备聚餐时和大家分享。', 7, give('hill_honey', 3)),
  ] },
  hill_sign: { region: 'windmill', node: 'lookout', requires: [], steps: [
    step('岔路口先停一下', '瞭望台旁有两条小路。{neighbor}拿着路线笔记，想先把上山的转弯处认清。', '对照笔记看看两条路', '外侧的石路更平缓，搬着东西走也方便。'),
    step('上山别走岔路', '从平台能看清下一个转弯。大家约好沿外侧石路走，到大石头旁再转向山上。', '把转弯处记清楚', '路线对上了，路边的集合牌却朝着另一边。', 8),
    step('路牌朝错了', '临时集合牌的支架歪了。{neighbor}扶住牌子，你把下面松动的地方重新固定。', '固定集合路牌', '箭头转回了约定的方向。', 9, give('community_wood', 1)),
  ] },
  hill_lamps: { region: 'windmill', node: 'camp', requires: [7, 9], steps: [
    step('营地里的旧灯', '{neighbor}把借来的灯放在桌上：“提手还结实。你帮我看看灯罩有没有裂口。”', '检查灯罩和提手', '灯罩没有裂口，提手也固定得很牢。', 10),
    step('山上风会更大', '门边的风让灯晃了晃。把它移到窗边，再试着用箱子挡住一侧，就稳当多了。', '试好挡风的位置', '上山以后，灯可以靠着窗边或箱子放。', 11),
    step('灯就这样带过去', '旧布铺在桌上，正好能把灯具分开包住。{neighbor}把蜂蜜也拎了过来：“这些我一起带。”', '包好灯具再装箱', '灯和蜂蜜都准备好了。', 12),
  ] },
  forest_basket: { region: 'forest', node: 'gather', requires: [], steps: [
    step('路边翻倒的篮子', '{neighbor}刚才在这里歇过脚，篮子却不见了。几颗掉落的林莓一直延伸到草丛边。', '顺着果子找过去', '篮子翻在草边，一只小家伙正蹲在旁边。', 13),
    { title: '先别靠得太近', story: '小家伙听见脚步就缩了缩身子。给它一点空间，它应该会自己走开。', options: [
      { id: 'wait', label: '安静等它自己离开', result: '你们退后几步，安静地等着。' },
      { id: 'detour', label: '绕到另一侧，给它留条路', result: '你们绕到篮子的另一侧，把草边的小路空出来。' },
    ] },
    step('别追那只小家伙', '它探头看了看，沿草边慢慢跑远了。{neighbor}松了口气：“好了，拿篮子吧。”', '拿起篮子，拍拍灰', '小家伙走了，篮子也拿回来了。', 14),
    step('给篮子补一点', '几颗果子压坏了，得重新补一点。{neighbor}把篮子扶好，想起古树里还放着以前野餐用过的桌布。', '把准备分享的果子装好', '果子装好了，接着去古树拿桌布。', 15, give('forest_berry', 3)),
  ] },
  forest_cloth: { region: 'forest', node: 'story', requires: [15], steps: [
    step('古树里那块桌布', '{neighbor}翻了翻旧布包：“就是这块，上回野餐用的。还好没受潮。”', '把桌布展开', '桌布完整，只夹了几根松针。', 16),
    step('松针得先挑掉', '把桌布的一角交给伙伴，两个人慢慢抖开。缝线边还夹着几根细松针。', '挑掉缝边的松针', '桌布已经收拾干净了。'),
    step('抖干净再收', '{neighbor}扶着另一头：“折小一点吧，放在篮子上面，别被果子压到。”', '叠好桌布放进篮子', '聚餐要用的桌布准备好了。', 17),
  ] },
  forest_meet: { region: 'forest', node: 'camp', requires: [17], steps: [
    step('在小屋旁歇一会儿', '{neighbor}把桌布递过来：“这个你先带过去，我还想去旁边采点东西。”', '接过桌布，问问出发时间', '伙伴认得上山的路，会稍晚一点过来。'),
    step('给晚到的伙伴留个位', '“你们先摆饭，不用等我。给我留个位置就行。”{neighbor}背好篮子，又确认了一遍集合地点。', '答应留好座位', '林地这边准备好了，晚到的座位也记下了。', 18),
  ] },
  coast_boxes: { region: 'coast', node: 'crossing', requires: [], steps: [
    step('问清楚回程的路', '{neighbor}指着栈桥上方：“回来走那边。沙滩看着近，水上来以后就不好走了。”', '记下高处的回程通路', '大家约好往返都走高处通路。', 19),
    step('栈桥上绊脚的绳子', '装灯罩的箱子还在栈桥边，旁边散着几段旧绳。先把绳头卷好，搬东西时就不会绊住。', '卷好绳头放到一边', '通道腾出来了，可以搬箱子。', 20),
    step('箱子先搬上去', '{neighbor}扶住箱子另一头：“一、二，抬。先放到上面干一点的地方。”', '一起搬箱子，扣好箱盖', '箱子搬到高处，盖子也扣牢了。', 21),
  ] },
  coast_glass: { region: 'coast', node: 'camp', requires: [21], steps: [
    step('挑两片厚实的', '旧船屋里有一块平整的工作台。{neighbor}想挑两片厚实的海玻璃，给聚餐用的小灯装上灯片。', '选好两片海玻璃', '这两片厚度合适，边沿再包一下就能装箱。', 22, give('sea_glass', 2)),
    step('把边角包好', '屋里的旧布条正好能用。绕着玻璃边沿包一圈，灯片放在一起也不容易磕碰。', '包好边角，放进箱子', '灯片装好了，箱子里也垫了软布。', 23),
    step('到时候一起走', '{neighbor}把箱子放到门边：“到时候来船屋找我，咱们一起走，路上还能换着提。”', '约好在船屋碰头', '海边的东西收拾好了，出发时一起带上。', 24),
  ] },
  station_room: { region: 'observatory', node: 'story', requires: [], steps: [
    step('先收拾窗边', '{neighbor}提前来帮忙，已经把抹布洗好了：“你擦那边，我把窗边这几样东西挪开。”', '一起擦干净窗边', '窗边腾出了位置，借来的凳子能摆下了。', 25),
    step('小灯有点接触不良', '借来的便携灯亮了一下又暗了。{neighbor}打开底盖，发现里面的小连接件已经松了。', '检查需要更换的连接件', '只要换好连接件，这盏聚餐用的小灯就能继续用。'),
    step('小灯还差几个零件', '{neighbor}扶住灯壳，你把准备好的零件装回去，再合上底盖。', '换好零件，试亮小灯', '小灯亮稳了，可以放在大家的座位旁。', 26, give('observatory_part', 2)),
  ] },
  station_path: { region: 'observatory', node: 'lookout', requires: [], steps: [
    step('先看看路牌', '大家吃完饭要从这里回去。{neighbor}带上路线笔记，想趁准备的时候把路再看一遍。', '核对回程路牌', '路牌方向对得上，没有被枝叶挡住。'),
    step('扶手也摸一遍', '沿稳固的步道慢慢走，试试扶手的连接处。带着东西回家时，有扶手会方便一些。', '逐段检查扶手', '扶手没有松动，转弯处也留得出通行的位置。'),
    step('把回去的路看一遍', '{neighbor}在笔记上画了个圈：“这里放一盏灯吧，下坡的时候看得清楚。”', '确认灯位和返程路线', '回程的路看过了，转弯处也安排好了灯。', 27),
  ] },
  station_dinner: { region: 'observatory', node: 'camp', requires: [26, 27], steps: [
    step('饭还差两份', '桌布铺好了，凳子也搬了进来。{neighbor}数了数桌上的饭：“还差两份，凑齐就能开饭了。”', '把带来的饭摆上桌', '饭菜摆齐了，旁边还有兑好蜂蜜的水。', 28, meal(2)),
    step('看看还有谁没到', '来帮忙的伙伴陆续进门，把借来的东西放好。晚到的那位提着篮子赶了过来：“我来了，饭还热着吧？”', '招呼伙伴坐下', '旁边的伙伴挪了挪凳子：“热着呢，坐这儿。”', 29),
    step('先吃饭', '有人递碗，有人往杯子里倒水。忙了这么一阵，大家终于坐下来，边吃边聊路上遇见的事。', '和大家一起吃饭', '这顿饭吃得挺热闹，桌上的东西也差不多分完了。'),
    step('开饭吧', '收好碗筷，大家又去穹顶看了一会儿星星。临走时把借来的东西分着拿好，约定下次再一起吃饭。', '收好东西，和伙伴们回家', '聚餐结束了。这一路帮忙准备的人和事，都记在了任务册里。', 30),
  ] },
};
export const isCampaignVisitId = (id: unknown): id is CampaignVisitId => typeof id === 'string' && (campaignVisitIds as readonly string[]).includes(id);
export const getTaskVisitId = (task: number) => campaignVisitIds.find(id => campaignVisits[id].steps.some(step => step.task === task))!;
