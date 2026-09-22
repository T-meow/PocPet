import type { AdventureChoice } from './adventureData';
import type { CommunityRoute } from './communityTypes';
import type { Inventory, PartnerScheduleCategory } from './petTypes';
import { allDishes, dishName } from './kitchenRecipes';
import type { ExplorationCheckDefinition } from './explorationChecks';

export const explorationCheck = (skill: PartnerScheduleCategory, difficulty: number, extra: Partial<ExplorationCheckDefinition> = {}): ExplorationCheckDefinition => ({ mode: 'check', skill, difficulty, ...extra });
export const explorationMealChoices = (bag?: Inventory) => {
  const meals = allDishes.filter(d => bag === undefined || (bag[d.id] ?? 0) > 0).map(d => ({ id: `cook:${d.id}`, title: `整理旅途餐食 · ${dishName(d.id)}`, mealItem: d.id as string }));
  return meals.length ? meals : [{ id: 'cook', title: '整理旅途餐食 · 需要行囊料理', mealItem: undefined }];
};
const questChecks: Record<string, readonly [PartnerScheduleCategory, number, PartnerScheduleCategory, number]> = {
  valley_gather: ['study', 1, 'garden', 2], valley_ridge: ['exercise', 2, 'study', 2],
  valley_crossing: ['study', 2, 'exercise', 2], valley_lookout: ['exercise', 2, 'study', 3],
  valley_story: ['garden', 2, 'study', 2], valley_encounter: ['garden', 2, 'exercise', 2], valley_camp: ['study', 2, 'cooking', 2],
};
const safeQuestLabels: Record<string, readonly [string, string]> = {
  valley_gather: ['沿水渠逐段确认方向', '在平缓岸边慢慢收种'], valley_ridge: ['沿石阶慢慢上坡', '照着手账逐项描下装置'],
  valley_crossing: ['请守望者逐段说明路线', '沿岸边安全绕行'], valley_lookout: ['沿护栏走向观景台', '沿石阶逐段记录水流'],
  valley_story: ['慢慢清理门边藤蔓', '耐心读完每一页手账'], valley_encounter: ['安静等待小客人放松', '绕到旁边慢慢挪开树枝'],
  valley_camp: ['沿已有路标走到休息间', '整理长凳和窗台'],
};
const questActionDescriptions: Record<string, string> = {
  roots: '小心收好种子，把根留在石缝里。', stairs: '看准石阶，慢慢向旧农舍走去。',
  bank: '顺着岸边的小路，绕过松动的桥板。', survey: '沿着石阶，记下溪水流过的地方。', listen: '静静听一会儿，辨认远处的水声。',
  door: '拨开门边的藤蔓，推开温室的门。', clear: '挪开树枝，为小客人让出一条路。',
  lure: '在前面放些野果，引着小客人离开。', apple: '留下一颗苹果，等小客人慢慢靠近。',
  tidy: '擦亮窗台，把散落的长凳摆好。',
};
type Steps = { title: string; story: string; choices: AdventureChoice[] }[];
const safe = (base: AdventureChoice, index: number, label: string): AdventureChoice => ({ id: `safe:${index}`, label, detail: '沿着熟悉的路，稳妥走到下一处。', hunger: base.hunger, energy: base.energy, check: { mode: 'safe' } });
const meals = (base: AdventureChoice, bag?: Inventory): AdventureChoice[] => explorationMealChoices(bag).map(m => ({ id: m.id, label: m.title, mealItem: m.mealItem,
  detail: '吃点热乎的，为接下来的路留些力气。', hunger: base.hunger, energy: base.energy, check: explorationCheck('cooking', 2, { prepare: 'meal' }) }));
const toolOption = (choice?: AdventureChoice): AdventureChoice | undefined => {
  const skill = choice?.check?.skill, tool = skill === 'study' ? 'survey_lens' : skill === 'garden' ? 'harvest_sickle' : undefined;
  if (!choice || !tool || choice.check?.mode !== 'check' || choice.check.tool || choice.check.prepare === 'meal') return undefined;
  return { ...choice, id: `${choice.id}:tool`, label: `${tool === 'survey_lens' ? '用放大镜' : '用镰刀'}${choice.label}`, detail: tool === 'survey_lens' ? '借助镜片，看清容易错过的细节。' : '借助镰刀，更从容地收集沿途材料。', check: { ...choice.check, tool } };
};
export const createAdventureCheckSteps = (steps: Steps, purpose?: CommunityRoute, bag?: Inventory): Steps => steps.map((step, index) => {
  const base = step.choices.find(c => !c.tool && !c.item) ?? step.choices[0];
  const quest = purpose && questChecks[purpose];
  if (quest && index === steps.length - 1) return { ...step, choices: step.choices.map(c => ({ ...c, check: { mode: 'story' as const } })) };
  let choices: AdventureChoice[];
  if (quest) {
    const skill = quest[index === 0 ? 0 : 2] as PartnerScheduleCategory, difficulty = quest[index === 0 ? 1 : 3] as number;
    choices = step.choices.map(c => {
      const { health: _health, minMoodRatio: _minMood, ...rest } = c;
      return { ...rest, hunger: c.item ? c.hunger : base.hunger, energy: c.item ? c.energy : base.energy,
        detail: c.tool ? '固定好绳索，小心走过这段路。' : questActionDescriptions[c.id] ?? c.detail,
        check: c.item ? { mode: 'delivery' as const } : explorationCheck(skill, difficulty, { risky: skill === 'exercise' || c.tool === true, ...(c.tool ? { tool: 'trail_rope' as const } : {}), ...(index === 0 && skill === 'study' ? { prepare: 'focus' as const } : {}) }) };
    });
    if (purpose === 'valley_camp' && index === 1) choices = meals(base, bag);
    choices.push(safe(base, index, safeQuestLabels[purpose!][index]));
  } else if (purpose) {
    const skill = (['study', 'exercise', 'garden'] as const)[index];
    choices = step.choices.map(c => {
      const { health: _health, minMoodRatio: _minMood, ...rest } = c;
      return { ...rest, hunger: base.hunger, energy: base.energy, detail: index === 1 ? c.id === 'search_bank' ? '顺着岸边，慢慢绕过浅滩。' : '踩着露出的石头，试着穿过浅滩。' : c.detail,
        check: c.id === 'search_bank' ? { mode: 'safe' as const } : explorationCheck(skill, index === 0 ? 1 : 2, { risky: c.id === 'search_shallows', ...(index === 0 ? { prepare: 'focus' as const } : {}) }) };
    });
    if (!choices.some(c => c.check?.mode === 'safe')) choices.push(safe(base, index, ['沿路标慢慢前进', '沿岸边安全绕行', '沿旧手账完成搜寻'][index]));
  } else {
    choices = step.choices.map(c => {
      const { health: _health, minMoodRatio: _minMood, ...rest } = c;
      const clean: AdventureChoice = { ...rest, hunger: base.hunger, energy: base.energy, mood: 0 };
      if (index === 0) return { ...clean, check: explorationCheck('study', 1, { prepare: 'focus' }) };
      if (index === 1) return { ...clean, detail: c.id === 'bank' ? '拨开岸边的草叶，找些新鲜野菇。' : '在河滩挑拣可用的木料和石块。', finds: c.id === 'bank' ? { valley_mushroom: 3 } : { community_wood: 4, community_stone: 3 }, harvest: 1,
        check: c.id === 'bank' ? explorationCheck('garden', 1) : explorationCheck('exercise', 2, { risky: true }) };
      if (index === 2) return { ...clean, check: { mode: c.item ? 'delivery' as const : 'safe' as const } };
      if (index === 3) return c.tool ? { ...clean, detail: '拉稳绳索穿过浅滩，找找岸边的嫩笋。', finds: { bamboo_shoot: 5 }, harvest: 1, check: explorationCheck('exercise', 2, { risky: true, tool: 'trail_rope' }) }
        : { ...clean, detail: '沿着岸边绕行，稳妥走过浅滩。', check: { mode: 'safe' as const } };
      return { ...clean, check: explorationCheck('study', 2) };
    });
    if (index === 2) choices.unshift({ id: 'calm', label: '辨认足迹，安抚小动物', detail: '轻声靠近，给小动物留出让路的时间。', hunger: base.hunger, energy: base.energy, check: explorationCheck('garden', 2) });
    if (index === 3) choices.unshift({ id: 'cross', label: '踩着露石穿过浅滩', detail: '走过浅滩，找找对岸的嫩笋。', hunger: base.hunger, energy: base.energy, finds: { bamboo_shoot: 5 }, harvest: 1, check: explorationCheck('exercise', 2, { risky: true }) });
    if (index === 4) choices.push(...meals(base, bag));
    if (!choices.some(c => c.check?.mode === 'safe')) choices.push(safe(base, index, ['沿路标稳妥前进', '留下材料，继续前行', '绕过小动物', '沿岸边安全绕行', '整理行囊后稳妥前进', '沿熟悉道路返回'][index]));
  }
  const assisted = toolOption(choices.find(c => c.check?.mode === 'check'));
  if (assisted) choices.splice(1, 0, assisted);
  return { ...step, ...(purpose === 'valley_camp' && index === 1 ? { story: '擦亮窗台后，屋里有了可以整理餐食的小桌。可以准备一份暖食，也可以继续把长凳和窗台收拾干净。' } : {}), choices };
});
