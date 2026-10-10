import { isClassicEndgameComplete } from './classicEndgame';
import { getWeekStartDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { canSpendCompanionTime } from './kitchen';
import { allDishes, getDish, getRecipeUnlockReason } from './kitchenRecipes';
import { removeInventoryItem } from './items';
import { getMuseumExhibits, getMuseumOpenHalls, normalizeMuseumDraft } from './museumState';
import { museumDishRegion, museumExhibits, museumScales, museumThemeIds, museumThemes, type MuseumTheme, type MuseumTag } from './museumData';
import type { MuseumDraft, MuseumRecord } from './museumTypes';
import type { NeighborIdentity, PetState } from './petTypes';
import { hashString } from './utils';

export const museumGuestMessages = [
  '这几件东西摆在一起，就想起那一路的风景。谢谢你把它们留下来。',
  '展品和今天的饭菜很相衬，下回还想来听听你们的故事。',
  '原来普通日子也能收进展柜。以后一起走过的路，还会更多吧。',
  '在这里坐了一会儿，想起好多熟悉的地方。下一次开馆也记得叫上我。',
];
export const evaluateMuseumLayout = (theme: MuseumTheme, exhibitIds: readonly string[], dishIds: readonly string[]): boolean[] => {
  const exhibits = exhibitIds.map(id => museumExhibits.find(e => e.id === id)).filter(e => Boolean(e));
  const regions = new Set(exhibits.map(e => e!.region));
  const tags = (tag: MuseumTag) => exhibits.filter(e => e!.tags.includes(tag)).length;
  const categories = new Set(dishIds.map(id => getDish(id)?.recipe.category));
  const menu = (a: string, b: string) => categories.has(a as never) && categories.has(b as never);
  const quest = exhibits.some(e => e!.quest);
  switch (theme) {
    case 'valley': return [regions.has('valley'), tags('life') > 0, menu('main', 'soup')];
    case 'farm': return [tags('life') >= 2, tags('nature') > 0, menu('side', 'dessert')];
    case 'wind': return [regions.has('hills'), tags('record') > 0, menu('main', 'drink')];
    case 'forest': return [regions.has('forest'), tags('nature') >= 2, menu('drink', 'dessert')];
    case 'sea': return [regions.has('coast'), tags('craft') > 0, menu('main', 'soup')];
    case 'stars': return [regions.has('station'), exhibits.some((e, i) => e!.tags.includes('record') && exhibits.some((other, j) => i !== j && other!.tags.includes('craft'))), menu('main', 'drink')];
    case 'journey': return [regions.has('hills') && regions.has('coast'), regions.size === 3, quest];
    case 'five': return [regions.size === 3, new Set([...regions, ...dishIds.map(museumDishRegion).filter(Boolean)]).size === 5, quest];
  }
};
export const getMuseumAvailableDishes = (pet: PetState) => allDishes.filter(d => pet.kitchen.equipment.includes(d.recipe.method) && !getRecipeUnlockReason(pet, d.recipe.id, d.recipe.variantKey));
export const findMuseumSolution = (pet: PetState, theme: MuseumTheme): Pick<MuseumDraft, 'exhibits' | 'dishes'> | undefined => {
  if (!isClassicEndgameComplete(pet) || !getMuseumOpenHalls(pet.museum).length) return undefined;
  const exhibits = getMuseumExhibits(pet.museum);
  // Two dishes per scoring signature are sufficient, including themes without menu restrictions.
  const signatures = new Map<string, number>();
  const dishes = getMuseumAvailableDishes(pet).filter(d => {
    const key = `${d.recipe.category}:${museumDishRegion(d.id) ?? ''}`, used = signatures.get(key) ?? 0;
    signatures.set(key, used + 1); return used < 2;
  });
  for (let a = 0; a < exhibits.length - 2; a++) for (let b = a + 1; b < exhibits.length - 1; b++) for (let c = b + 1; c < exhibits.length; c++) {
    const ids = [exhibits[a].id, exhibits[b].id, exhibits[c].id];
    const partial = evaluateMuseumLayout(theme, ids, []);
    if (!partial[0] || theme !== 'five' && !partial[1] || (theme === 'journey' || theme === 'five') && !partial[2]) continue;
    for (let d = 0; d < dishes.length - 1; d++) for (let e = d + 1; e < dishes.length; e++) {
      const menu = [dishes[d].id, dishes[e].id];
      if (evaluateMuseumLayout(theme, ids, menu).every(Boolean)) return { exhibits: ids, dishes: menu };
    }
  }
  return undefined;
};
export const getMuseumEligibleThemes = (pet: PetState) => museumThemeIds.filter(id => Boolean(findMuseumSolution(pet, id)));
export const advanceMuseumWeek = (pet: PetState, now = Date.now()): PetState => {
  if (!pet.museum || pet.timePause || !isClassicEndgameComplete(pet) || !getMuseumOpenHalls(pet.museum).length) return pet;
  const week = getWeekStartDateKey(getEffectiveDailyDateKey(pet, now));
  if (pet.museum.board.week >= week) return pet;
  const themes = getMuseumEligibleThemes(pet).sort((a, b) => hashString(`museum:${pet.createdAt}:${week}:${a}`) - hashString(`museum:${pet.createdAt}:${week}:${b}`) || a.localeCompare(b)).slice(0, 3);
  return { ...pet, museum: { ...pet.museum, board: { week, themes } } };
};
export const beginMuseumCuration = (pet: PetState, theme: MuseumTheme): PetState => {
  if (pet.timePause || pet.museum.draft || !findMuseumSolution(pet, theme) || pet.museum.nextDraftId >= Number.MAX_SAFE_INTEGER) return pet;
  const previous = pet.museum.best[theme];
  const draft: MuseumDraft = { id: pet.museum.nextDraftId, revision: 0, theme, scale: 'small', exhibits: previous?.exhibits ?? [], dishes: previous?.dishes ?? [] };
  return { ...pet, museum: { ...pet.museum, draft, nextDraftId: draft.id + 1 } };
};
export const editMuseumCuration = (pet: PetState, id: number, revision: number, changes: Partial<Pick<MuseumDraft, 'scale' | 'exhibits' | 'dishes'>>): PetState => {
  const draft = pet.museum.draft;
  if (pet.timePause || !draft || draft.id !== id || draft.revision !== revision) return pet;
  const next = normalizeMuseumDraft({ ...draft, ...changes, revision: revision + 1 });
  if (!next || next.exhibits.some(id => !getMuseumExhibits(pet.museum).some(e => e.id === id))) return pet;
  return { ...pet, museum: { ...pet.museum, draft: next } };
};
export const cancelMuseumCuration = (pet: PetState, id: number): PetState => pet.timePause || pet.museum.draft?.id !== id ? pet : { ...pet, museum: { ...pet.museum, draft: undefined } };
export const getMuseumCurationQuote = (pet: PetState) => {
  const draft = pet.museum.draft;
  const cost = museumScales[draft?.scale ?? 'small'];
  const goals = draft ? evaluateMuseumLayout(draft.theme, draft.exhibits, draft.dishes) : [false, false, false];
  const rating = goals.filter(Boolean).length, stars = rating * cost.coefficient;
  const owned = getMuseumExhibits(pet.museum);
  const reason = pet.timePause ? '恢复时间后再举办。' : !isClassicEndgameComplete(pet) || !getMuseumOpenHalls(pet.museum).length ? '先正式开放一座展厅。'
    : !draft ? '先选择一个主题。' : draft.exhibits.length !== 3 || new Set(draft.exhibits).size !== 3 || draft.exhibits.some(id => !owned.some(e => e.id === id)) ? '请选择三件已收藏的不同展品。'
      : draft.dishes.length !== 2 || new Set(draft.dishes).size !== 2 || draft.dishes.some(id => !getDish(id)) ? '请选择两种不同料理。'
        : !rating ? '至少满足一项主题条件才能举办。' : !canSpendCompanionTime(pet) || pet.pomodoro.isRunning ? '等伙伴空闲后一起举办。'
          : pet.coins < cost.coins ? '金币不足。' : (pet.inventory.golden_apple ?? 0) < cost.apples ? '金苹果不足。'
            : draft.dishes.some(id => (pet.inventory[id] ?? 0) < cost.portions) ? `每种料理需要 ${cost.portions} 份。`
              : ['stars', 'hosted', 'coinsSpent', 'applesSpent', 'weeklyPages'].some(key => pet.museum[key as 'stars'] > Number.MAX_SAFE_INTEGER - Math.max(cost.coins, stars)) ? '纪念记录已达上限。' : '';
  return { cost, goals, rating, stars, reason };
};
export const hostMuseumCuration = (pet: PetState, id: number, revision: number, actorId: string, actorName: string, neighbors: readonly NeighborIdentity[], now = Date.now()): PetState => {
  const draft = pet.museum.draft;
  if (!draft || draft.id !== id || draft.revision !== revision || !actorId || !Number.isFinite(now)) return pet;
  const quote = getMuseumCurationQuote(pet);
  if (quote.reason) return pet;
  const week = getWeekStartDateKey(getEffectiveDailyDateKey(pet, now)), weekly = week > pet.museum.lastHostedWeek;
  const guests = neighbors.filter(n => n.modId !== actorId).slice().sort((a, b) => a.modId.localeCompare(b.modId));
  const roll = hashString(`curation:${pet.createdAt}:${draft.id}`), guest = guests[roll % Math.max(guests.length, 1)];
  const record: MuseumRecord = { id: draft.id, at: now, week, weekly, theme: draft.theme, scale: draft.scale, rating: quote.rating, stars: quote.stars,
    exhibits: [...draft.exhibits], dishes: [...draft.dishes], coins: quote.cost.coins, apples: quote.cost.apples, portions: quote.cost.portions,
    actorId: actorId.slice(0, 128), actorName: actorName.slice(0, 32), guestId: guest?.modId, guestName: guest?.name.slice(0, 32) ?? '社区邻居', message: roll % museumGuestMessages.length };
  let inventory = removeInventoryItem(pet.inventory, 'golden_apple', quote.cost.apples);
  for (const dish of draft.dishes) inventory = removeInventoryItem(inventory, dish, quote.cost.portions);
  const old = pet.museum, stars = old.stars + quote.stars;
  return { ...pet, coins: pet.coins - quote.cost.coins, inventory, lastInteractionAt: now,
    museum: { ...old, draft: undefined, stars, hosted: old.hosted + 1, coinsSpent: old.coinsSpent + quote.cost.coins, applesSpent: old.applesSpent + quote.cost.apples,
      lastHostedWeek: weekly ? week : old.lastHostedWeek, weeklyPages: old.weeklyPages + Number(weekly), records: [...old.records, record].slice(-200),
      best: (old.best[draft.theme]?.rating ?? 0) < quote.rating ? { ...old.best, [draft.theme]: { rating: quote.rating, exhibits: [...draft.exhibits], dishes: [...draft.dishes] } } : old.best,
      appearance: { ...old.appearance, frame: !old.hosted ? 'common' : old.stars < 90 && stars >= 90 ? 'prestige' : old.appearance.frame, badge: old.stars < 300 && stars >= 300 ? 'prestige' : old.appearance.badge, title: old.stars < 900 && stars >= 900 ? 'curator' : old.appearance.title } },
    recentEvent: `「${museumThemes[draft.theme].name}」举办完成，评分 ${quote.rating} 星，累计策展星 +${quote.stars}。${weekly ? '本周纪念页已收藏。' : ''}` };
};
