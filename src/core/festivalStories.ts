import type { PetState } from './petTypes';
import type { RecipeId } from './companionActivityTypes';
import { isMidautumnOpen, type FestivalId } from './festivalCalendar';
import { getActiveSeasonalRun, hasSeasonalReward, normalizeSeasonalRun } from './seasonalStories';
import type { SeasonalRun } from './seasonalScripts';
import { canSpendCompanionTime } from './kitchen';
import { removeInventoryItem } from './items';
import { activityText as L } from './kitchenRecipes';

export interface StoryText { zh: string; en: string }
export type MooncakeFlavour = 'nuts' | 'bean';
export type MoonlightSetting = 'tea' | 'window';
export type MoonlightWish = 'everyday' | 'journey' | 'health';
export type MidautumnStage = 'flavour' | 'prepare' | 'setting' | 'wish' | 'ending' | 'complete';
export interface StoryMoment {
  id: Exclude<MidautumnStage, 'complete'>;
  title: StoryText;
  paragraphs: StoryText[];
  choice?: StoryText;
}
export interface MidautumnRun {
  id: string;
  festival: 'midautumn';
  scriptVersion: 1;
  year: number;
  actorId: string;
  actorName: string;
  startedAt: number;
  completedAt: number;
  rewardClaimedAt: number;
  stage: MidautumnStage;
  flavour?: MooncakeFlavour;
  setting?: MoonlightSetting;
  wish?: MoonlightWish;
}
export type FestivalRun = MidautumnRun | SeasonalRun;
export interface FestivalStoryState { schemaVersion: 3; runs: Record<string, FestivalRun> }
export type MidautumnAction =
  | { type: 'flavour'; value: MooncakeFlavour }
  | { type: 'serve' }
  | { type: 'setting'; value: MoonlightSetting }
  | { type: 'wish'; value: MoonlightWish }
  | { type: 'finish' }
  | { type: 'claim' };

const T = (zh: string, en: string): StoryText => ({ zh, en });
export const storyText = (text: StoryText) => L(text.zh, text.en);
export const midautumnTitle = T('把月光留一份', 'A little moonlight to keep');
export const midautumnRewardTickets = 10;
export const midautumnRunId = (year: number) => `midautumn:${year}`;
const rewardId = (year: number) => `festival:midautumn:${year}:v1`;
const stages: MidautumnStage[] = ['flavour', 'prepare', 'setting', 'wish', 'ending', 'complete'];
export const mooncakeOptions = {
  nuts: T('五仁月饼', 'Five-nut mooncake'),
  bean: T('豆沙月饼', 'Red bean mooncake'),
};
export const moonlightSettings = {
  tea: T('泡一壶热茶，慢慢聊', 'Brew some tea and take our time'),
  window: T('把椅子挪到窗边，等月亮', 'Pull up a chair and wait for the moon'),
};
export const moonlightWishes = {
  everyday: T('想把普通的日子过得更好', 'Make our ordinary days a little better'),
  journey: T('想一起看看更远的地方', 'See somewhere new together'),
  health: T('希望我们都能好好照顾自己', 'Take good care of ourselves'),
};
export const midautumnRecipe = (flavour: MooncakeFlavour): RecipeId => flavour === 'nuts' ? 'mooncake_mixed_nuts' : 'mooncake_red_bean';
export const midautumnDish = (flavour: MooncakeFlavour) => `dish_${midautumnRecipe(flavour)}` as const;
export const defaultFestivalStories = (): FestivalStoryState => ({ schemaVersion: 3, runs: {} });
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const timestamp = (value: unknown): value is number => typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime());
export const normalizeFestivalStories = (raw: unknown): FestivalStoryState => {
  const state = object(raw);
  const result = defaultFestivalStories();
  if (state.schemaVersion !== 1 && state.schemaVersion !== 2 && state.schemaVersion !== 3) return result;
  const runs = object(state.runs);
  for (const [id, source] of Object.entries(runs)) {
    const run = object(source);
    if (run.festival !== 'midautumn') {
      if (state.schemaVersion === 3) {
        const seasonal = normalizeSeasonalRun(id, run);
        if (seasonal) result.runs[id] = seasonal;
      }
      continue;
    }
    if (typeof run.year !== 'number' || !Number.isInteger(run.year) || run.year < 1900 || run.year > 2199 || id !== midautumnRunId(run.year) || run.id !== id || run.festival !== 'midautumn' || run.scriptVersion !== 1) continue;
    if (typeof run.actorId !== 'string' || !run.actorId.trim() || typeof run.actorName !== 'string' || !run.actorName.trim() || !timestamp(run.startedAt)) continue;
    const stage = run.stage as MidautumnStage;
    const step = stages.indexOf(stage);
    if (step < 0 || (step > 0 && run.flavour !== 'nuts' && run.flavour !== 'bean') || (step > 2 && run.setting !== 'tea' && run.setting !== 'window') || (step > 3 && run.wish !== 'everyday' && run.wish !== 'journey' && run.wish !== 'health')) continue;
    if (stage === 'complete' && !timestamp(run.completedAt)) continue;
    // Version 1 already stored these choices. Discard its text snapshots on read/save.
    result.runs[id] = {
      id, festival: 'midautumn', scriptVersion: 1, year: run.year, actorId: run.actorId.slice(0, 128), actorName: run.actorName.slice(0, 64),
      startedAt: run.startedAt, completedAt: stage === 'complete' ? run.completedAt as number : 0,
      rewardClaimedAt: stage === 'complete' && timestamp(run.rewardClaimedAt) ? run.rewardClaimedAt : 0,
      stage,
      ...(step > 0 ? { flavour: run.flavour as MooncakeFlavour } : {}),
      ...(step > 2 ? { setting: run.setting as MoonlightSetting } : {}),
      ...(step > 3 ? { wish: run.wish as MoonlightWish } : {}),
    };
  }
  return result;
};

export const getMidautumnRun = (pet: PetState, year: number) => {
  const run = pet.festivalStories.runs[midautumnRunId(year)];
  return run?.festival === 'midautumn' ? run : undefined;
};
export const hasMidautumnReward = (pet: PetState, run: MidautumnRun) => run.rewardClaimedAt > 0 || pet.claimedRewardIds.includes(rewardId(run.year));
export const getMidautumnMemories = (pet: PetState) => Object.values(pet.festivalStories.runs).filter((run): run is MidautumnRun => run.festival === 'midautumn' && run.stage === 'complete').sort((a, b) => b.year - a.year);
export const getActiveMidautumnRun = (pet: PetState) => Object.values(pet.festivalStories.runs).filter((run): run is MidautumnRun => run.festival === 'midautumn').filter(run => run.stage !== 'complete' || !hasMidautumnReward(pet, run)).sort((a, b) => a.year - b.year)[0];
export const getActiveFestivalRun = (pet: PetState, festival: FestivalId) => festival === 'midautumn' ? getActiveMidautumnRun(pet) : getActiveSeasonalRun(pet, festival);
export const hasFestivalReward = (pet: PetState, run: FestivalRun) => run.festival === 'midautumn' ? hasMidautumnReward(pet, run) : hasSeasonalReward(pet, run);
export const getFestivalMemories = (pet: PetState) => Object.values(pet.festivalStories.runs).filter(run => run.stage === 'complete').sort((a, b) => b.year - a.year || b.completedAt - a.completedAt);

const saveRun = (pet: PetState, run: MidautumnRun): PetState => ({ ...pet, festivalStories: { schemaVersion: 3, runs: { ...pet.festivalStories.runs, [run.id]: run } } });

export const startMidautumnStory = (pet: PetState, actorId: string, actorName: string, now = Date.now()): PetState => {
  const year = new Date(now).getFullYear();
  if (!isMidautumnOpen(now) || getMidautumnRun(pet, year) || getActiveMidautumnRun(pet) || !canSpendCompanionTime(pet) || !actorId.trim() || !actorName.trim()) return pet;
  const name = actorName.trim().slice(0, 64);
  return saveRun(pet, {
    id: midautumnRunId(year), festival: 'midautumn', scriptVersion: 1, year, actorId: actorId.slice(0, 128), actorName: name,
    startedAt: now, completedAt: 0, rewardClaimedAt: 0, stage: 'flavour',
  });
};

const claimReward = (pet: PetState, run: MidautumnRun, now: number): PetState => {
  if (run.stage !== 'complete' || hasMidautumnReward(pet, run) || pet.goldenAppleGacha.tickets > 9999 - midautumnRewardTickets) return pet;
  return saveRun({ ...pet, goldenAppleGacha: { ...pet.goldenAppleGacha, tickets: pet.goldenAppleGacha.tickets + midautumnRewardTickets }, claimedRewardIds: [...pet.claimedRewardIds, rewardId(run.year)] }, { ...run, rewardClaimedAt: now });
};

/** The expected stage is the operation receipt: repeated clicks cannot spend or reward twice. */
export const advanceMidautumnStory = (pet: PetState, year: number, action: MidautumnAction, now = Date.now()): PetState => {
  const run = getMidautumnRun(pet, year);
  if (!run || !timestamp(now)) return pet;
  if (action.type === 'claim') return claimReward(pet, run, now);
  if (!canSpendCompanionTime(pet)) return pet;
  switch (action.type) {
    case 'flavour': {
      if (run.stage !== 'flavour' || (action.value !== 'nuts' && action.value !== 'bean')) return pet;
      return saveRun(pet, { ...run, stage: 'prepare', flavour: action.value });
    }
    case 'serve': {
      if (run.stage !== 'prepare' || !run.flavour || (pet.inventory[midautumnDish(run.flavour)] ?? 0) < 1) return pet;
      return saveRun({ ...pet, inventory: removeInventoryItem(pet.inventory, midautumnDish(run.flavour), 1) }, { ...run, stage: 'setting' });
    }
    case 'setting': {
      if (run.stage !== 'setting' || (action.value !== 'tea' && action.value !== 'window')) return pet;
      return saveRun(pet, { ...run, stage: 'wish', setting: action.value });
    }
    case 'wish': {
      if (run.stage !== 'wish' || !Object.prototype.hasOwnProperty.call(moonlightWishes, action.value)) return pet;
      return saveRun(pet, { ...run, stage: 'ending', wish: action.value });
    }
    case 'finish': {
      if (run.stage !== 'ending') return pet;
      const next: MidautumnRun = { ...run, stage: 'complete', completedAt: now };
      return claimReward(saveRun(pet, next), next, now);
    }
  }
};

/** Display-only transcript for script version 1; never put the returned text into PetState. */
export const getMidautumnHistory = (run: MidautumnRun): StoryMoment[] => {
  const step = stages.indexOf(run.stage);
  if (run.scriptVersion !== 1 || step < 0) return [];
  const history: StoryMoment[] = [{
    id: 'flavour', title: T('先为今晚留一点空', 'Leave a little room for tonight'), paragraphs: [
      T('窗外还亮着，桌上已经空出了两只杯子的位置。日历翻到中秋附近，连晚风都像慢了下来。', 'It is still light outside. There is room on the table for two cups. With Mid-Autumn approaching, even the evening breeze seems to slow down.'),
      T(`${run.actorName}翻开食谱，把写着“月饼”的那一页轻轻推到你面前。`, `${run.actorName} opens the recipe book and slides the mooncake page towards you.`),
      T('“今年不赶热闹，好不好？我们给今晚准备一点自己的味道。”', '“Could we spend a quiet evening together this year? Let’s make something that tastes like us.”'),
      T('一边是咬得到果仁的香，一边是细细绵绵的甜。你决定先做哪一种？', 'One filling is nutty and full of little crunches; the other is soft and sweet. Which shall we make?'),
    ],
  }];
  if (step < 1 || !run.flavour) return history;
  history[0].choice = mooncakeOptions[run.flavour];
  history.push({
    id: 'prepare', title: T('厨房里的小小月亮', 'A little moon in the kitchen'), paragraphs: [
      run.flavour === 'nuts' ? T('你选了五仁。果仁碰着碗沿，发出细碎的声响，像把秋天收进了掌心。', 'You choose five-nut filling. The nuts tap against the bowl, like small pieces of autumn gathered in your hands.') : T('你选了豆沙。细软的馅料被拢成圆球，像先把今晚的温柔藏进饼里。', 'You choose red bean. The soft filling rolls into a ball, as though tonight’s warmth were tucked inside it.'),
      T(`${run.actorName}把盘子放在一旁：“不用做得和食谱上一模一样。我们一起做的，就认得出来。”`, `${run.actorName} sets a plate nearby. “It doesn’t have to look just like the recipe. We’ll recognise the one we made together.”`),
      T('去厨房准备一份选好的月饼吧。做好的月饼会留在背包，回来时再把它摆上赏月的桌子。', 'Prepare your chosen mooncake in the kitchen. It will stay in your inventory until you bring it back to the moonlit table.'),
    ],
  });
  if (step < 2) return history;
  history[1].choice = T(`摆上了一份${mooncakeOptions[run.flavour].zh}`, `Set out one ${mooncakeOptions[run.flavour].en.toLowerCase()}`);
  history.push({
    id: 'setting', title: T('给月亮留个座位', 'A seat for the moon'), paragraphs: [
      T('月饼落在盘子正中，边缘还有一点不太整齐。你们看了看，决定就让它这样。', 'The mooncake sits in the middle of the plate, its edges a little uneven. You both decide to leave it just like that.'),
      T('窗外的天一点点暗下来，云里露出一小片银白。桌子不大，却刚好放得下今晚的期待。', 'Outside, the sky darkens and a sliver of silver peeks through the clouds. The table is small, but there is room for everything you hoped for tonight.'),
      T(`${run.actorName}问：“接下来，想怎么等月亮？”`, `${run.actorName} asks, “How shall we wait for the moon?”`),
    ],
  });
  if (step < 3 || !run.setting) return history;
  history[2].choice = moonlightSettings[run.setting];
  history.push({
    id: 'wish', title: T('不用很大的愿望', 'A wish can be small'), paragraphs: [
      run.setting === 'tea' ? T('水汽从两只杯子里慢慢升起来。你们聊起最近的小事：一道新菜、一次没接住的球，还有那个终于做完的计划。', 'Steam rises gently from two cups. You talk about little things: a new dish, a missed catch, and that plan you finally finished.') : T('椅子挪到窗边，杯子也跟着挪近了一点。云走得很慢，你们不说话的时候，房间也没有变得冷清。', 'You move the chairs to the window and bring the cups closer. The clouds drift slowly. Even in the quiet, the room feels full of company.'),
      T('“听说对着月亮许愿，要认真想一下。”', '“They say you should take your time when making a wish to the moon.”'),
      T(`${run.actorName}顿了顿，又补了一句：“也不一定要很大。明天就能开始的那种，也很好。”`, `${run.actorName} pauses. “It doesn’t have to be a big wish. Something we can start tomorrow would be lovely too.”`),
    ],
  });
  if (step < 4 || !run.wish) return history;
  history[3].choice = moonlightWishes[run.wish];
  const reply: Record<MoonlightWish, StoryText> = {
    everyday: T('“那就从明天的一顿饭开始吧。再留一点时间，听你讲今天发生的事。”', '“Then let’s begin with a meal tomorrow, and leave a little time for you to tell me about your day.”'),
    journey: T('“好。先把想去的地方记下来。等准备好了，我们就从第一小步出发。”', '“Yes. Let’s write down the places we want to see. When we’re ready, we’ll take the first little step.”'),
    health: T('“那我们说好了，累的时候就休息，饿的时候好好吃饭。也记得提醒对方。”', '“It’s a promise. Rest when we’re tired, eat when we’re hungry, and remind each other when we forget.”'),
  };
  history.push({
    id: 'ending', title: midautumnTitle, paragraphs: [
      T(`${run.actorName}认真听完你的愿望，把自己的杯子轻轻碰了碰你的杯沿。`, `${run.actorName} listens carefully, then touches their cup gently against yours.`),
      reply[run.wish],
      run.flavour === 'nuts' ? T('五仁的香气在嘴里散开，最后那一点脆响，被窗外的风悄悄接住。', 'The nutty fragrance lingers. The last little crunch seems to disappear into the breeze outside.') : T('豆沙的甜慢慢化开，热茶接住了余味，像给今晚写下了一个柔软的句号。', 'The sweetness of red bean melts slowly away. Warm tea follows, like a gentle full stop at the end of the evening.'),
      T('月亮终于从云后走出来。两杯茶、一盘月饼，还有一句已经有人记住的愿望。', 'At last, the moon emerges from the clouds. Two cups of tea, a plate of mooncake, and a wish that someone will remember.'),
      T('你想，把这一晚留一份吧。往后的普通日子里，随时都能再翻到。', 'You decide to keep a little of this evening, ready to find again on an ordinary day.'),
    ],
  });
  return history;
};
