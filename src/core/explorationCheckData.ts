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
type Steps = { title: string; story: string; choices: AdventureChoice[] }[];
const safe = (base: AdventureChoice, index: number, label: string): AdventureChoice => ({ id: `safe:${index}`, label, detail: '稳妥通过，体力成本较高；不进行技能判定，不额外采集。', hunger: base.hunger, energy: base.energy, check: { mode: 'safe' } });
const meals = (base: AdventureChoice, bag?: Inventory): AdventureChoice[] => explorationMealChoices(bag).map(m => ({ id: m.id, label: m.title, mealItem: m.mealItem,
  detail: '整理并食用一份料理，按动手前的状态判定；可让后续行动更省体力。', hunger: base.hunger, energy: base.energy, check: explorationCheck('cooking', 2, { prepare: 'meal' }) }));
const toolOption = (choice?: AdventureChoice): AdventureChoice | undefined => {
  const skill = choice?.check?.skill, tool = skill === 'study' ? 'survey_lens' : skill === 'garden' ? 'harvest_sickle' : undefined;
  if (!choice || !tool || choice.check?.mode !== 'check' || choice.check.tool || choice.check.prepare === 'meal') return undefined;
  return { ...choice, id: `${choice.id}:tool`, label: `${tool === 'survey_lens' ? '用放大镜' : '用镰刀'}${choice.label}`, detail: '对应工具辅助判定：成功率 +10 个百分点，耐久 −1。', check: { ...choice.check, tool } };
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
        detail: c.item ? c.detail : c.tool ? '借助探路绳判定，耐久 −1；勉强或受挫时减轻擦伤。' : '根据技能与当前状态判定；结果结算后记下线索并继续。',
        check: c.item ? { mode: 'delivery' as const } : explorationCheck(skill, difficulty, { risky: skill === 'exercise' || c.tool === true, ...(c.tool ? { tool: 'trail_rope' as const } : {}), ...(index === 0 && skill === 'study' ? { prepare: 'focus' as const } : {}) }) };
    });
    if (purpose === 'valley_camp' && index === 1) choices = meals(base, bag);
    choices.push(safe(base, index, safeQuestLabels[purpose!][index]));
  } else if (purpose) {
    const skill = (['study', 'exercise', 'garden'] as const)[index];
    choices = step.choices.map(c => {
      const { health: _health, minMoodRatio: _minMood, ...rest } = c;
      return { ...rest, hunger: base.hunger, energy: base.energy, detail: index === 1 ? c.id === 'search_bank' ? '沿岸边稳妥绕行，健康无损。' : '运动判定；失手可能擦伤，结果结算后继续。' : c.detail,
        check: c.id === 'search_bank' ? { mode: 'safe' as const } : explorationCheck(skill, index === 0 ? 1 : 2, { risky: c.id === 'search_shallows', ...(index === 0 ? { prepare: 'focus' as const } : {}) }) };
    });
    if (!choices.some(c => c.check?.mode === 'safe')) choices.push(safe(base, index, ['沿路标慢慢前进', '沿岸边安全绕行', '沿旧手账完成搜寻'][index]));
  } else {
    choices = step.choices.map(c => {
      const { health: _health, minMoodRatio: _minMood, ...rest } = c;
      const clean: AdventureChoice = { ...rest, hunger: base.hunger, energy: base.energy, mood: 0 };
      if (index === 0) return { ...clean, check: explorationCheck('study', 1, { prepare: 'focus' }) };
      if (index === 1) return { ...clean, detail: '有采集机会时消耗 1 次；技能判定影响材料数量。', finds: c.id === 'bank' ? { valley_mushroom: 3 } : { community_wood: 4, community_stone: 3 }, harvest: 1,
        check: c.id === 'bank' ? explorationCheck('garden', 1) : explorationCheck('exercise', 2, { risky: true }) };
      if (index === 2) return { ...clean, check: { mode: c.item ? 'delivery' as const : 'safe' as const } };
      if (index === 3) return c.tool ? { ...clean, detail: '探路绳辅助通过，并寻找浅滩嫩笋；耐久 −1。', finds: { bamboo_shoot: 5 }, harvest: 1, check: explorationCheck('exercise', 2, { risky: true, tool: 'trail_rope' }) }
        : { ...clean, detail: '沿岸边稳妥通过，保留采集机会，健康无损。', check: { mode: 'safe' as const } };
      return { ...clean, check: explorationCheck('study', 2) };
    });
    if (index === 2) choices.unshift({ id: 'calm', label: '辨认足迹，安抚小动物', detail: '园艺判定，尝试找到温和的通过方式。', hunger: base.hunger, energy: base.energy, check: explorationCheck('garden', 2) });
    if (index === 3) choices.unshift({ id: 'cross', label: '踩着露石穿过浅滩', detail: '运动判定，寻找嫩笋；失手可能擦伤。', hunger: base.hunger, energy: base.energy, finds: { bamboo_shoot: 5 }, harvest: 1, check: explorationCheck('exercise', 2, { risky: true }) });
    if (index === 4) choices.push(...meals(base, bag));
    if (!choices.some(c => c.check?.mode === 'safe')) choices.push(safe(base, index, ['沿路标稳妥前进', '留下材料，继续前行', '绕过小动物', '沿岸边安全绕行', '整理行囊后稳妥前进', '沿熟悉道路返回'][index]));
  }
  const assisted = toolOption(choices.find(c => c.check?.mode === 'check'));
  if (assisted) choices.splice(1, 0, assisted);
  return { ...step, ...(purpose === 'valley_camp' && index === 1 ? { story: '擦亮窗台后，屋里有了可以整理餐食的小桌。可以准备一份暖食，也可以继续把长凳和窗台收拾干净。' } : {}), choices };
});
