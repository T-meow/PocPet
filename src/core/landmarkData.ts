import type { AdventureChoice } from './adventureData';
import type { AdventureRegionId } from './adventureTypes';
import type { Inventory, PartnerScheduleCategory } from './petTypes';
import { explorationTravel, getRegionActionCost } from './explorationTravelData';
import { wildIngredientIds, wildIngredients } from './foodCatalog';
import { regionalTreasureIds, regionalTreasures } from './regionalTreasures';
import { expeditionProducts, regions } from './expeditionData';
import { explorationDifficulty } from './explorationChecks';
import { expeditionRegionForMap, landmarkNames, parseLandmarkId, type LandmarkId, type LandmarkNode } from './landmarkProgress';
import { valleyQuests, type ValleyQuestId } from './valleyQuests';
import { valleyGatherFinds } from './valleyExplorationData';

// Six authored moments per landmark; later chapters add fieldwork between the discovery and resolution.
type Script = readonly [string, string, string, string, string, string];
const scripts: Record<AdventureRegionId, Record<LandmarkNode, Script>> = {
  valley: {
    entrance: ['溪水指向家的方向', '前哨的屋檐还在身后。溪水分成两道，先把回家的方向画在手册边上。', '路牌背面有一道新刻痕，和河滩上的脚印指向不同方向。分别记下，才能认清入口。', '向阳处长着野菇，背阴处散落着可用的木石。留出小动物通行的空隙，再查看岸边物产。', '浅滩的露石有些湿滑。可以沿岸绕行，也可以固定绳索，从结实的石头旁通过。', '树荫下看得见旧桥和温室屋顶。把近处两条支路标清楚，往后的故事便有了起点。'],
    gather: ['水渠的第一滴水', '石头上刻着一片叶子。旧水渠在这里分成两道，一道通往社区，一道没入草丛。', '拨开渠边的落叶，水位刻痕终于露了出来。先找到堵住水流的地方。', '几株香草仍守着浅浅的水洼。取种时留下根，让来年的这里还能绿起来。', '细砂堵着一个小小出水口。顺着水势清理，避免让泥土埋住刚找到的幼苗。', '旧手册里记着香草暖粥的做法。收好种子与配方，把这一点清香带回已经开放的菜地。'],
    ridge: ['坡道上的旧农舍', '青苔下露着旧石阶，远处是农舍的屋顶。先沿干燥的边缘找到上坡的落脚处。', '歪倒的木牌画着鸡舍与牧道。核对箭头，区分通往谷仓和水桶架的两条路。', '谷仓里还留着能转动的饲喂装置。把结构画下来，比搬走整座木架更有用。', '饮水设备的支架陷在草里。清理周围，读出水槽之间的连接方式。', '两张图纸终于完整。等菜地、鸡舍和牛棚依次开放，这条牧道就会重新热闹起来。'],
    crossing: ['旧桥那边的来信', '水渠与农舍的笔记在桥头接到一起。守望者招手，请你先看岸边的通行木牌。', '信封上的波纹与桥柱上的记号相同。核对水边小屋的位置，也记下邻居托付的事情。', '桥边草丛留着工具包的带扣。查看石缝与香草，完成已接下的寻物和实地采集。', '中间一块桥板晃了晃。沿岸有平缓小径，结实的桥柱也能固定探路绳。', '守望者递来钓鱼小屋的图纸。把物资送到他手中，再把通往栈桥的路记进手账。'],
    lookout: ['风声里的上游', '沿着旧桥后的路标登上观景台，溪流分岔在风里亮成两道银线。', '近处池塘安静，上游却传来清亮水声。用手册把两处水面分别圈出来。', '在稳固石阶边查看水草与岩缝，辨认适合停留的岸线。', '一段旧护栏松了。绕到内侧逐段量出步道位置，不必冒险靠近崖边。', '手账上多出清楚的上游岸线。等钓鱼小屋建成，就能凭这份勘测记录修好第二处水域。'],
    story: ['温室里未完的约定', '细藤遮住旧温室的门。木牌轻轻摇着：请记得给邻居留一点收获。', '拨开门边藤蔓，日光落到一张小木桌上。桌脚刻着社区菜地的标记。', '抽屉中的种子与守园手账放在一起。先分清哪些可以取走，哪些留给温室。', '书页受潮粘在一起。耐心逐页翻开，找回野菇焖饭的配方和小摊图纸。', '守园人写道：遇见需要的人，就一起做顿饭。留下新的一页，让种养与鱼获回到邻里的日常。'],
    encounter: ['石芽与迷路的小客人', '温室旁有一块长着嫩芽的石头，后面藏着一双紧张的小眼睛。', '脚印在树枝堆前打转。蹲下来辨认它来时的路，不急着靠近。', '草丛里有香草，也有小客人留下的落果。只取沿路可用的物产，留出足够空间。', '慢慢挪开树枝，小客人才探出头来。可以安静等待，也可以借食物引它走向宽处。', '它钻进树荫又回头望望。脚印连接着温室休息间，你与伙伴记下最后一段安全的小径。'],
    camp: ['溪谷第一盏灯', '门上还挂着旧温室的号码。经过这些支路，回家的方向已经很熟悉。', '窗台下压着一张值班表，写着水渠、农舍与旧桥。把走过的地点逐个对上。', '查看屋旁的落枝和石块，挑出能够用于以后建设的材料。', '伙伴擦亮窗，你整理长凳。桌面腾出位置，可以把一路的笔记摊开核对。', '第一盏灯亮起，溪谷八个地标连成完整章节。休息间已找到，回去备好建材便能修成挂机基地。'],
  },
  windmill: {
    entrance: ['追风的第一枚路标', '越过溪谷，山丘路口的布条朝着花田摆动。先确认返回温室的方向。', '路牌的箭头被风转歪了。对照远处风车，找出花田与坡道的位置。', '路旁有蜂蜜香气和散落的小枝。查看物产时，记下蜜蜂返巢的方向。', '一阵侧风卷起手册。压稳书页，把会误导来客的箭头重新辨认清楚。', '花田和风向坡道都已标入地图。沿哪条支路出发，都能重新回到这里。'],
    gather: ['花田里的轮值约定', '香草花田里留下窄窄的采蜜道。守花人示意你从背风的一侧进入。', '蜂群在浅色花簇间停留。观察花期标牌，分清正在生长和可以采收的区域。', '花田边的蜂蜜、野洋葱与山栗各有记录。按需要选择，给下一位来客留下余量。', '倒下的细枝压着采蜜道。沿土埂绕到背面，慢慢把通路整理出来。', '守花人在手册盖下一朵小花。花田的物产与采集规则记清了，下一次可按需重访。'],
    ridge: ['会说话的风向旗', '坡道上的几面旧旗朝不同方向倾斜。风声从山脊与低洼处轮流传来。', '一根旗杆旁刻着早晚风向。将眼前的风与刻痕比对，找出背风通路。', '坡边的果树与石缝有可用物产。先确认脚下的台阶，再查看沿途发现。', '松动的旗绳拍打木柱。站在稳固处整理绳结，让旗面重新展开。', '新记录标出了安全上坡时机。把它和花田记录并在一起，就能判断木栈桥的风势。'],
    crossing: ['风车栈桥的两端', '花田和坡道的记录在栈桥入口汇合。桥下的风吹得叶片簌簌作响。', '木板边缘有守桥人的轮值记号。核对受力位置，也看看是否有邻居遗落的物件。', '桥头存放着可用的小木料。取用前清点，并查看附近草丛里的物产。', '中间的横杆轻轻晃动。沿内侧慢行，或利用可靠的绳索扶点通过。', '把记录交到桥那边的小桌上。通往瞭望台与老风车的两条路都能辨认了。'],
    lookout: ['金色瞭望台的双路图', '站在护栏内，远处一边是深绿松林，一边是明亮海面。', '铜盘上的两道刻线分别对准林地和海岸。先用风车塔顶校准方位。', '瞭望台边有被风吹来的种实和浅露矿脉。记下当地物产的位置。', '铜盘积着尘土，读数有些模糊。细看刻度，分辨并行的两条山路。', '两条道路画得清清楚楚。等山丘整章完成，森林与海岸都将成为下一站。'],
    story: ['让老风车再转一圈', '老风车的叶轮停在半空，屋里仍有细微的齿轮响声。', '维修册上画着叶轮、轴承与制动杆。先把每个部件认清，别急着推动。', '在安全停机处整理散落材料，辨认卡住叶轮的树枝。', '清开枝条后，沿着维修册检查联动。伙伴在门边报风向，你确认制动杆的位置。', '叶轮再次转动，屋内留下蜂蜜暖饮的记录。把风车恢复的消息带去营地，完成本章最后的交接。'],
    encounter: ['风团送回来的丝带', '一团蓬松的草絮沿坡滚来，里面缠着一条带有营地标记的丝带。', '风团绕着石头打转。观察阵风间歇，找到丝带不会继续飘走的位置。', '沿途收拢掉落的物产，给花田留出通风的空隙。', '伙伴挡住一阵侧风，你从草絮里慢慢解开丝带，没有伤到藏在里面的小虫。', '丝带指向避风小营地。把瞭望台与风车的记录带过去，山丘旅程就能连成完整一页。'],
    camp: ['山丘的两封启程信', '避风小营地的门朝着山丘背面，风声在屋外柔和了许多。', '营地桌上留着两只信封，一只画树叶，一只画贝壳。', '查看储物棚旁的建材与物产，准备以后的基地建设。', '把花田、风旗、栈桥和风车记录按顺序排好，补全两封信里的路线。', '山丘八个地标全部记入手账。森林与海岸同时开放，这处营地也具备了修复条件。'],
  },
  forest: {
    entrance: ['雾里仍然清楚的路', '松林入口漂着薄雾，树干上有从山丘延续下来的叶形路标。', '苔藓遮住半块木牌。确认树叶记号和回程方向，再走入林间。', '入口附近落着松果和林莓。辨认可采的物产，留意小动物活动的痕迹。', '雾气让两条路显得相似。把林莓丛与足迹小径的特征分别记下。', '入口坐标已确认。即使雾变浓，也可以沿着刚记录的树干刻痕返回。'],
    gather: ['给林莓留下种子', '林莓丛沿古树的阴影生长，枝梢上的果实有深有浅。', '守林人的木牌写着采熟留青。先辨认成熟果与保留的嫩枝。', '林莓、木耳与松子各有生长位置，种子也可在丛边定向寻找。', '倒伏枝条遮住阴湿的小径。轻轻撑开树枝，让采集点和小动物的通道各留一边。', '林莓的种植方法与松茸调查点都已记录。日后可以带种子回菜地，也可以继续当地调查。'],
    ridge: ['足迹小径的来客', '松针间的脚印一深一浅，像有个小客人拖着什么东西走过。', '脚印在树根前分开。比较新旧落叶，找出真正通向古树的那一串。', '路边留着松香和种实。查看这些发现时，也记下足迹经过的树根。', '一根低枝横在小径上。绕到宽处为来客留路，避免惊动雾后的动物。', '足迹终点连着古树栈道。把它与林莓丛的位置合起来，就能寻找更深处的路。'],
    crossing: ['古树栈道上的旧留言', '两条支路在盘绕的树根旁汇合，古树栈道从雾中伸出。', '扶手下刻着守林人的留言。辨认栈道的承重位置，再查看邻居托付的物件。', '栈道入口积着落枝与松果，可在稳固位置整理需要的材料。', '树根抬高了一块旧木板。沿旁边低矮的小径通过，或固定绳索后逐段确认。', '树梢观察台和空心古树都能到达了。把留言补全，给后来的访客留下方向。'],
    lookout: ['树梢间的山地方位', '观察台搭在两棵松树之间，护栏内可以看见远处山顶。', '旧方位盘只剩半边刻度。先对准风车，再记录观测站穹顶露出的方向。', '平台下的岩缝可观察当地矿脉，树影边也有可采的种实。', '枝叶挡住了一个关键视角。换到稳固位置，等待雾隙里的山峰出现。', '山地方位记录完整了。这份记录将与海岸的星图一起指向旧观测站。'],
    story: ['空心古树的守望册', '古树树洞里藏着一本干燥的守望册，门口铺着厚厚松针。', '册页记着林莓、松茸与林间水池。将文字和走过的支路逐项核对。', '树洞周围有林地物产，取用时留下幼苗，不破坏古树的根。', '缺失的一页夹在树皮缝里。耐心取回，读出守林小屋与池塘栈道的位置。', '守望册终于完整。把配方与林间水域线索送到小屋，待整章完成后正式登记。'],
    encounter: ['苔石旁的归途', '一只小动物在苔石旁停下，鼻尖蹭着落在地上的守望木牌。', '木牌上的树纹与观察台记录相同。先让小客人熟悉你的声音。', '查看周围物产，顺手清理挡在归途上的枯枝。', '它想穿过一段被根系围住的狭道。慢慢挪开枝条，为它留出绕行的位置。', '小客人带着你找到守望小屋外的空地。方位记录与古树手账可以在这里汇合了。'],
    camp: ['雾松林地的守望灯', '林间守望小屋的窗里映着树影，墙上留着记录水池位置的木图。', '把入口、林莓丛与足迹小径标上木图，确认每条回程道路。', '小屋旁堆着可用枝材，清点物产，为今后的修复做准备。', '核对树梢方位与守望册，再将林间水域标为待建设的永久通路。', '林地八个地标全部完成，配方、种植与水域线索已登记。和海岸记录齐备后，就能前往山顶。'],
  },
  coast: {
    entrance: ['潮线以内的脚印', '沙滩入口的木牌标着涨潮刻度，海风带来旧船屋方向的铃声。', '比较干湿两条潮线，先确认不会被海水截断的回程路。', '海岸边留着海藻与盐晶，观察可以采集的浅滩位置。', '沙上两串脚印分别通往潮池和贝壳坡道。把两条路记清，避免跟着浪花走远。', '入口的潮时与路标已记下。下次重访仍要先看水位，再往深处出发。'],
    gather: ['潮池留下的小小世界', '退潮后的浅池闪着光，石缝里有缓慢摆动的海藻。', '先看潮池出口，让小鱼与虾有返回大海的路。', '海藻、蛤蜊、海虾和盐晶各有取用的位置。选好目标，只采需要的一份。', '一块碎木堵着水口。站在干燥石面上清理，让浅池重新与外海连通。', '潮池物产与安全停留位置都记清了。浪花回来之前，沿原路带着发现离开。'],
    ridge: ['贝壳坡道的回声', '贝壳坡道上的白色碎片随风轻响，脚下沙粒比海滩更松软。', '坡旁旧木桩画着浪线。比较高低刻度，找出涨潮时仍能通过的路。', '在稳固坡脚查看海玻璃与贝壳附近的物产，不扰动整片沙坡。', '落沙遮住了一个台阶。沿内侧缓慢清理，辨认可以承重的位置。', '通往旧栈桥的高处路径已确认。把潮池记录一起带去，才能完整判断往返时机。'],
    crossing: ['旧栈桥的潮时留言', '潮池与坡道的记录在旧栈桥汇合，桥柱上的标线还很清楚。', '守桥人留下的留言写着安全潮时。查看系绳点，也寻找邻居遗失的物件。', '桥头漂来的木料与海藻可以整理利用，先确认水位再取用。', '几块旧桥板之间有缝隙。沿稳固内侧慢行，或固定绳索后通过。', '听浪观景台与潮汐洞穴的路已标清。将送达物交好，再带着潮时记录向前。'],
    lookout: ['听浪台上的三颗星', '观景台能听见不同方向的浪声，石栏上刻着三颗排列整齐的星。', '对照山丘方位图，先找出星刻与山顶穹顶之间的方向。', '沿台旁安全岩面查看矿脉和潮水带来的物产。', '一颗星被盐壳遮住。慢慢清理刻面，等海雾散开再读出完整图形。', '三颗星的方位已经确认。这是拼合洞穴漂流信与山顶路线的重要一页。'],
    story: ['潮汐洞穴里的来信', '退潮露出洞口，石壁内侧挂着一只没有被海水淹没的信筒。', '先标记安全水位和出口，再查看信筒上的穹顶图案。', '洞口附近可整理海玻璃与海岸物产，深处的湿滑石面暂时留在远处观察。', '信纸卷得很紧。摊在干燥平石上，借观景台的三颗星找出星图朝向。', '来信画着山顶穹顶与旧船屋。把星图带去船屋，与整片海岸的记录一起保存。'],
    encounter: ['贝壳里的小小求助', '一只小客人拖着贝壳停在浅沟边，涨潮的声音从远处传来。', '看清它想去的方向，再在干燥沙面上留下可以跟随的标记。', '沿沟边查看当地物产，把挡路的漂流枝轻轻移开。', '小客人不敢越过水痕。等浪退去，沿缓坡给它留出一条连续的路。', '它回到旧船屋旁的安全岸线。跟着这串小脚印，最后一处落脚点也找到了。'],
    camp: ['旧船屋的星图交接', '旧船屋的窗朝向山顶，墙上留着一块用于拼图的木板。', '把入口潮线、栈桥潮时与观景台星刻依次摆好。', '清点船屋旁的木料和海岸物产，给以后修复留出位置。', '将漂流信中的星图与三颗星对齐，标出海岸码头的永久通路。', '海岸八个地标全部完成，海岸料理与码头线索已登记。林地方位记录齐备后，便可向观测站出发。'],
  },
  observatory: {
    entrance: ['两份记录指向山顶', '林地方位和海岸星图在山顶入口对上了。旧观测站的穹顶就在雾后。', '先核对山脊路标与回程绳柱，确认两份记录使用的是同一个方向。', '入口附近有旧零件和高山植物，查看时保留完整的观测标记。', '山顶风让纸页不停翻动。把路线分成碎片采集地和符号坡道两段记录。', '入口坐标已确认。接下来要分别找回仪器部件与符号含义，再走向连桥。'],
    gather: ['碎片各自的位置', '碎片采集地散落着旧仪器部件，金属表面仍有编号。', '对照维修目录，把承重零件和普通碎片分开，避免误拿仍在使用的部件。', '查看可用观测零件与高山茶叶调查点，按目标整理材料。', '一块镜架压着编号牌。先找到稳固支点，再辨认牌上的装配位置。', '部件编号与采集点全部记下。带着清单去核对符号坡道，便能理解连桥后的仪器。'],
    ridge: ['符号坡道的读法', '坡道两侧刻着星形与短线，同样的符号也出现在海岸来信上。', '比较短线的长短和朝向，把它们与林地方位记录对应。', '在安全平台查看茶丛、零件和露出的岩层，记下调查位置。', '一段刻痕被落石挡住。绕到稳固侧面辨认余下符号，再补全顺序。', '符号说明了连桥和穹顶的方向。与部件编号合在一起，后面的路终于能读懂。'],
    crossing: ['连桥上的共同坐标', '碎片与符号的两份记录在悬空连桥前汇合，桥端有旧观测坐标。', '对照桥柱标记确认安全通路，也查看值班员留下的交接物件。', '桥头工具箱附近有可用材料，先清点再记录取用。', '风穿过桥板的空隙。沿固定护栏缓慢通过，或借助可靠绳索减少消耗。', '星空观景台与旧穹顶的位置都已确认。把物资交接好，再带着坐标继续调查。'],
    lookout: ['星空观景台的校准', '观景台的圆盘朝向夜空，边缘留着树叶和贝壳形状的记号。', '用林地方位校准圆盘，再将海岸三颗星的位置画入刻度。', '台边的旧仪器和矿脉可作进一步调查，清楚记录每一份发现。', '圆盘的指针偏了一格。重新比对两份记录，分清刻度误差与真正的星位。', '校准记录完整了。把它带进穹顶，旧望远镜就有了重新对准夜空的依据。'],
    story: ['为夜空重新打开穹顶', '穹顶门边挂着旧维修册，屋内的望远镜静静对着关闭的顶窗。', '先读制动、齿轮与镜架的关系，把碎片编号和校准记录放在一起。', '整理工作台上的可用零件与调查材料，保持镜面附近干净。', '对照维修册逐项检查联动。伙伴照看指针，你确认齿轮与顶窗之间的间隙。', '穹顶缓缓打开，星光落在记录册上。把完整过程带回值班室，让所有人的见闻有一个归处。'],
    encounter: ['星石旁的最后一枚标记', '值班室方向有块发亮的星石，一只小客人在旁边守着掉落的标记牌。', '标记牌背面写着回程编号。先让小客人安静下来，再读出它带来的信息。', '查看星石附近的调查点，给来客留下能自由离开的空间。', '一段旧线缠在标记牌上。顺着线头慢慢解开，把回程路标重新摆正。', '小客人沿值班室的灯影离开。最后一段回程路线也清楚了，可以去完成整章交接。'],
    camp: ['属于大家的星空记录', '值班室的长桌足够摊开五张地图，窗外是已经打开的穹顶。', '从溪谷第一盏灯开始，把风车、古树、潮汐和星空记录依次放好。', '清点工作台旁可用的物资，把后续研究所需的东西分类记录。', '核对坐标、部件与回程标记，确认每张地图都留下了完整的探索记录。', '观测站八个地标全部完成，五地故事在这里汇合。营地可以修复，往后的探索、邻里委托与珍宝调查仍可继续。'],
  },
};
const extraFieldwork: Partial<Record<AdventureRegionId, readonly [string, string][]>> = {
  forest: [['雾中的二次核对', '雾从树根间升起。用附近树干的刻痕复核刚才的发现，把易混淆的方向单独画出来。'], ['守林人的注记', '守林记录提到一处容易遗漏的细节。和伙伴分别查看地面与树梢，再把两份观察合在一起。']],
  coast: [['潮位复核', '潮水已经比抵达时高了一点。重读岩面刻线，标出仍可安全返回的时间。'], ['漂流物的来处', '一块漂流木带着不同方向的磨痕。比较风向和水流，判断发现来自近岸还是外海。'], ['与守岸人核对', '守岸人留下两种潮声的注记。静听浪声，再把当前水位写在记录旁。'], ['回程岸线检查', '返程方向露出一段新的湿沙。沿高处复核通路，给下一位访客留出清楚的标记。']],
  observatory: [['林地方位复核', '重新读出林地记录中的山峰夹角，将当前位置标在坐标纸上。'], ['海岸星图复核', '海岸星图的三颗星与这里的刻度朝向不同。转正图纸，逐一对应。'], ['仪器编号核对', '维修册中相似的编号相差一笔。与伙伴交叉核对，防止把部件放错位置。'], ['风向与固定点', '山风改变了方向。检查纸夹与固定点，把散开的记录重新整理好。'], ['远近读数比较', '分别从近处标记和远处山峰读取方位，用两份结果找出可能的误差。'], ['共同完成记录', '伙伴复述调查过程，你逐项检查遗漏。把发现、处理办法和回程方向留在同一页。']],
};
export interface LandmarkStep { id: string; title: string; story: string; choices: AdventureChoice[]; event: 'arrival' | 'clue' | 'gather' | 'obstacle' | 'fieldwork' | 'finish' }
export const landmarkSummary = (id: LandmarkId) => { const { region, node } = parseLandmarkId(id); return { name: scripts[region][node][0], summary: scripts[region][node][1], outcome: scripts[region][node][5] }; };
export const landmarkTargets = (region: AdventureRegionId) => {
  const r = expeditionRegionForMap[region], def = regions[r];
  return [...new Set([def.product, def.alternative, ...(r === 'forest' ? ['forest_berry_seed'] : []), ...(r === 'valley' ? ['creek_herb'] : []), 'materials', ...wildIngredientIds.filter(id => wildIngredients[id].region === r), ...regionalTreasureIds.filter(id => regionalTreasures[id].region === r)])];
};
export const landmarkTargetName = (id: string) => id === 'materials' ? '木料与石料' : id === 'creek_herb' ? '溪谷香草' : expeditionProducts[id as keyof typeof expeditionProducts]?.name ?? id;
const gatheringChoices = (region: AdventureRegionId, base: { hunger: number; energy: number }): AdventureChoice[] => landmarkTargets(region).flatMap(target => {
  const r = expeditionRegionForMap[region], treasure = regionalTreasures[target as keyof typeof regionalTreasures], food = wildIngredients[target as keyof typeof wildIngredients];
  const research = treasure ? { kind: 'treasure' as const, id: target, points: 1 } : food && food.investigations > 1 ? { kind: 'food' as const, id: target, points: 1 } : undefined;
  const finds: Inventory = research ? { [regions[r].product]: 1 } : target === 'materials' ? { community_wood: 4, community_stone: 3 } : target === 'forest_berry_seed' ? { forest_berry_seed: 2, pine_resin: 1 }
    : r === 'valley' && ['valley_mushroom', 'bamboo_shoot', 'lotus_seed', 'creek_herb'].includes(target) ? valleyGatherFinds(target as 'valley_mushroom') : { [target]: food?.yield ?? 2 };
  const researchCost = research ? { hunger: Math.ceil(base.hunger * 1.2), energy: Math.ceil(base.energy * 1.2) } : base;
  const name = landmarkTargetName(target), action: AdventureChoice = { ...researchCost, id: `gather:${target}`, label: `${research ? '稳妥调查' : '采集'}${name}`, detail: research ? `每次调查进度 +1，累计 ${treasure?.investigations ?? food!.investigations} 点取得${name}。消耗 1 次采集机会。` : '消耗 1 次采集机会，按行动前清单获得物资。', harvest: 1, finds, research, check: { mode: 'safe' } };
  const tool = treasure ? 'prospector_pick' as const : research ? 'survey_lens' as const : 'harvest_sickle' as const;
  return [action, { ...action, id: `tool:${target}`, label: `${treasure ? '用手镐勘探' : research ? '用放大镜调查' : '用镰刀采集'}${name}`, detail: `${research ? '调查进度 +2' : '提高采集表现'}；对应工具耐久 −1，消耗 ${treasure && r === 'valley' ? 2 : 1} 次采集机会。`, harvest: treasure && r === 'valley' ? 2 : 1, ...(research ? { finds: { [regions[r].product]: 2 }, research: { ...research, points: 2 }, check: { mode: 'story' as const, tool } } : { check: { mode: 'check' as const, skill: 'garden' as const, difficulty: explorationDifficulty[r][1], tool } }) }];
});
export const getLandmarkSteps = (id: LandmarkId): LandmarkStep[] => {
  const { region, node } = parseLandmarkId(id), script = scripts[region][node], r = expeditionRegionForMap[region];
  const moments: { key: string; title: string; story: string; event: LandmarkStep['event']; skill: PartnerScheduleCategory }[] = [
    { key: 'arrival', title: `抵达${landmarkNames[region][node]}`, story: script[1], event: 'arrival', skill: 'study' },
    { key: 'clue', title: '核对当地线索', story: script[2], event: 'clue', skill: 'study' },
    { key: 'gather', title: '查看沿途物产', story: script[3], event: 'gather', skill: 'garden' },
    { key: 'obstacle', title: '一起解决眼前的问题', story: script[4], event: 'obstacle', skill: 'exercise' },
    ...(extraFieldwork[region] ?? []).map(([title, story], index) => ({ key: `fieldwork-${index + 1}`, title, story: `${landmarkNames[region][node]}的调查仍在继续。${story}`, event: 'fieldwork' as const, skill: (index % 2 ? 'garden' : 'study') as PartnerScheduleCategory })),
    { key: 'record', title: '整理发现与交接', story: `在${landmarkNames[region][node]}旁停下，把刚才的发现与手册逐项对照。${node === 'crossing' ? '邻居在交接点等候，已接送达委托可以在这里完成。' : '把现场情况和回程方向写清楚，也查看是否有邻居托付的事情。'}`, event: 'clue', skill: 'study' },
    { key: 'finish', title: script[0], story: script[5], event: 'finish', skill: 'study' },
  ];
  return moments.map((moment, index) => {
    const base = getRegionActionCost(r, index), safe: AdventureChoice = { ...base, id: `safe:${moment.key}`, label: moment.event === 'finish' ? '完成记录，收好本次发现' : `仔细${moment.event === 'arrival' ? '辨认入口与回程方向' : moment.event === 'obstacle' ? '沿稳固通路处理问题' : moment.event === 'gather' ? '观察物产，保留采集机会' : '核对并记录'}`, detail: '稳妥完成本阶段，不需要工具或随机成功。', check: { mode: moment.event === 'finish' ? 'story' : 'safe' }, observation: 'a' };
    const alternative: AdventureChoice = { ...base, id: `observe:${moment.key}`, label: moment.event === 'finish' ? '和伙伴复述经历后完成记录' : moment.event === 'obstacle' ? '看准落脚点，尝试近处通路' : '换个角度仔细调查', detail: '按显示的技能与消耗判定；结果不会阻断故事推进。', check: moment.event === 'finish' ? { mode: 'story' } : { mode: 'check', skill: moment.skill, difficulty: explorationDifficulty[r][moment.event === 'obstacle' ? 1 : 0], risky: moment.event === 'obstacle', ...(moment.event === 'arrival' ? { prepare: 'focus' as const } : {}) }, observation: 'b' };
    const choices = [safe, alternative];
    if (moment.event === 'gather' || r === 'valley' && moment.key === 'record') choices.push(...gatheringChoices(region, base));
    if (moment.event === 'obstacle') choices.push({ ...alternative, id: 'rope:obstacle', label: '固定探路绳，借助绳索通过', detail: '直接使用仓库中的探路绳，耐久 −1。', tool: true, check: { ...alternative.check!, tool: 'trail_rope' }, observation: 'b' });
    return { id: `${id}:${moment.key}`, title: moment.title, story: moment.story, choices, event: moment.event };
  });
};
export const landmarkCosts = (id: LandmarkId) => explorationTravel[expeditionRegionForMap[parseLandmarkId(id).region]];
export const landmarkFirstReward = (id: LandmarkId) => {
  const { region, node } = parseLandmarkId(id);
  const quest = region === 'valley' && node !== 'entrance' ? valleyQuests[`valley_${node}` as ValleyQuestId] : undefined;
  return quest ? { coins: quest.coins, hearts: quest.hearts, items: quest.items } : region !== 'valley' && node === 'camp' ? { coins: 20, hearts: 4, items: {} } : { coins: 0, hearts: 0, items: {} };
};
