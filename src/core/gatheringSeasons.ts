export const gatheringSeasons = ['spring', 'summer', 'autumn', 'winter'] as const;
export type GatheringSeason = typeof gatheringSeasons[number];
export const isGatheringSeason = (value: unknown): value is GatheringSeason => gatheringSeasons.includes(value as GatheringSeason);
export const getGatheringSeason = (date: string | number = Date.now()): GatheringSeason => {
  const month = typeof date === 'string' ? Number(date.slice(5, 7)) : new Date(date).getMonth() + 1;
  return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
};
export const seasonalGatherings: Record<GatheringSeason, { name: string; months: string; memory: string; intro: string; ending: string; atmosphere: string; dinner: [string, string, string, string] }> = {
  spring: {
    name: '春日花宴', months: '3–5 月', memory: '花影落在空出来的座位上',
    intro: '观测站花园里的树开花了。邻居提议借几张凳子，把各自带来的饭放在树下，趁花还在，好好坐一会儿。凳子、灯和桌布仍得沿路找齐。',
    atmosphere: '路边冒出了新芽，大家商量着把这一顿安排在观测站的花树下。',
    ending: '花影从桌布的一端移到另一端，带来的饭也慢慢分完了。大家收好凳子，没有摘走树上的花，只记住了花下坐在一起的人。天暗后，又结伴去穹顶看了看星星。',
    dinner: ['花树下的桌布铺好了。{neighbor}把带来的饭挪到阴凉处：“先凑齐这两份，等大家坐下就开饭。”', '晚到的伙伴顺着花园小路来了，先拍掉衣角的草屑，再把手里的篮子放稳。{neighbor}拉开一张凳子：“这儿一直给你留着。”', '风一吹，花影就在碗边晃。有人递饭，有人扶住桌布的一角。大家说起沿路的小事，偶尔停下来，听一声远处的鸟叫。', '吃过饭，大家把落在桌布上的花瓣轻轻抖回草地。凳子和灯分着拿好，天色暗下来时，又一起去穹顶看了一会儿星星。'],
  },
  summer: {
    name: '夏日庭院下午茶', months: '6–8 月', memory: '树荫里，再续一杯',
    intro: '观测站庭院午后有一大片树荫。大家想带上饭和茶点，先吃点东西，再坐着喝茶聊天。借来的凳子、桌布和返程照明照旧要备齐，出发时记得给自己另带补给。',
    atmosphere: '日头渐高，大家约好到观测站庭院的阴凉处，把饭后那段时间留给下午茶。',
    ending: '杯里的茶续过几回，桌上的茶点也分到了最后一块。树荫慢慢移过脚边，大家收起空杯，等天凉下来才走。临走前一起看了穹顶外刚亮起的星星。',
    dinner: ['棚架下已经摆好了桌椅。{neighbor}把饭盒放进阴影里：“先把饭补齐，茶点我也带来了，吃过饭再慢慢喝。”', '最后一位伙伴带着满额头的汗赶来。{neighbor}把阴凉处的座位让开，递过去一杯水：“先歇会儿，茶还可以再泡。”', '大家把饭分好，再轮流传过茶壶和茶点。有人讲起路上的蝉声，有人只是把杯子握在手里。庭院的风穿过棚架，吹走了一点暑气。', '收好饭盒和茶杯，大家坐到晚风变凉。小灯刚好用来照亮返程的台阶，临走又去穹顶看了看初升的星星。'],
  },
  autumn: {
    name: '秋日丰收宴', months: '9–11 月', memory: '把这一季的收获分一分',
    intro: '苹果和林莓陆续熟了。邻居们想在观测站露台摆一桌饭，每个人带一点收获，再把多出来的分给彼此。沿路借好凳子、桌布和灯，就能把这顿饭办起来。',
    atmosphere: '沿路的树叶开始变色，大家惦记着把这一季的收获带上观测站露台。',
    ending: '苹果派切到了最后一块，热饭和果子都分得刚刚好。空篮子轻了，准备带给邻居的小包却多了几份。大家收好桌子，又到穹顶看星星，把秋天的这一晚记在一起。',
    dinner: ['露台上的篮子已经排好。{neighbor}把苹果放到一边：“这些饭凑齐以后，就一起分。每个人带一点，已经很丰盛了。”', '晚到的伙伴抱着最后一个篮子赶上来。{neighbor}接过篮子，拉好凳子：“先坐，收获的事等吃饭时再说。”', '有人把果子切开，有人给旁边添饭。大家说起今年哪块地长得好，也给没尝过的伙伴留下一份。露台上只有几样大盘菜，分起来却总有人接着。', '把剩下的食物分成能带走的小包，再收好借来的桌布和凳子。大家到穹顶看了会儿星星，回家时，手里各多了一点别人的秋天。'],
  },
  winter: {
    name: '冬日围炉宴', months: '12–2 月', memory: '炉火旁，每个人都有一碗热的',
    intro: '观测站休息室的炉子又生起了火。邻居想借这个暖和地方一起吃顿热饭，窗外的雪慢慢看就好。沿路把凳子、灯和桌布准备齐，晚一点到的人也要有座位。',
    atmosphere: '风里有一点寒意，大家说好把聚餐搬进观测站有炉火的休息室。',
    ending: '最后一碗热汤也盛好了，炉边的寒气慢慢散去。大家没有急着走，把借来的东西收在一起，又去穹顶看了片刻冬夜的星光。返程的小灯亮着，谁也不用独自走在后面。',
    dinner: ['炉火烧稳了，桌布也铺好了。{neighbor}把碗靠近热锅：“补齐这两份饭，大家进门就有热的吃。”', '晚到的伙伴搓着手进门，衣角还沾着寒气。{neighbor}把靠炉边的位置空出来：“坐这儿，先暖一暖。”', '大家把热饭一碗碗传过去，最后坐下的人也没落下一份。窗外很安静，屋里偶尔响起添汤的声音和低低的笑声。', '收好碗筷，大家确认小灯都能点亮，再去穹顶看了片刻星星。下山时放慢脚步，等走在后面的伙伴跟上，一起回家。'],
  },
};
