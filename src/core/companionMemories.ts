import type { PetState } from './petTypes';
import type { CompanionMemory, CompanionMemoryState, MemoryKind } from './companionActivityTypes';
import { activityText, dishName } from './kitchenRecipes';

export const defaultCompanionMemories = (): CompanionMemoryState => ({ schemaVersion: 1, entries: [] });
export const normalizeCompanionMemories = (raw: unknown): CompanionMemoryState => {
  const entries = (raw as Partial<CompanionMemoryState> | null)?.entries;
  const kinds: MemoryKind[] = ['first_taste', 'catch_record', 'menu_page', 'fruit_comparison', 'practice_photo'];
  const seen = new Set<string>();
  return { schemaVersion: 1, entries: (Array.isArray(entries) ? entries : []).filter((entry): entry is CompanionMemory => {
    if (!entry || typeof entry.id !== 'string' || typeof entry.actorId !== 'string' || typeof entry.subject !== 'string' || !kinds.includes(entry.kind) || typeof entry.at !== 'number' || !Number.isFinite(new Date(entry.at).getTime()) || entry.at < 0 || seen.has(entry.id)) return false;
    seen.add(entry.id); return true;
  }).map((entry) => ({ id: entry.id.slice(0, 200), actorId: entry.actorId.slice(0, 128), kind: entry.kind, subject: entry.subject.slice(0, 128), at: entry.at, mentionedAt: Number.isFinite(entry.mentionedAt) ? entry.mentionedAt : 0 })) };
};
export const rememberTogether = (pet: PetState, actorId: string, kind: MemoryKind, subject: string, now: number): PetState => {
  const id = `${actorId}:${kind}:${subject}`;
  if (pet.companionMemories.entries.some((entry) => entry.id === id)) return pet;
  return { ...pet, companionMemories: { schemaVersion: 1, entries: [...pet.companionMemories.entries, { id, actorId, kind, subject, at: now, mentionedAt: 0 }] } };
};
export const memoryText = (memory: CompanionMemory) => {
  switch (memory.kind) {
    case 'first_taste': return activityText(`还记得第一次一起吃${dishName(memory.subject)}吗？那一口的味道，我记住啦。`, `I still remember our first taste of ${dishName(memory.subject)}.`);
    case 'catch_record': return activityText('上次接球配合得真好。今天还想和你一起玩。', 'We made a great team catching that ball. Let’s play again sometime.');
    case 'menu_page': return activityText('我们的第一张家常菜单，有蛋炒饭，也有后来一起尝的新菜。', 'Our first little menu, from egg fried rice to another shared meal.');
    case 'fruit_comparison': return activityText('苹果松饼和香蕉松饼，都留在我们的食谱照片里了。', 'Apple and banana pancakes, side by side in our recipe album.');
    case 'practice_photo': return activityText('不用每次都破纪录。一起练习的样子也值得留张合影。', 'We don’t need a new record every time. Playing together deserves a photo too.');
  }
};
export const getCompanionWish = (pet: PetState, actorId: string) => {
  const entries = pet.companionMemories.entries.filter((entry) => entry.actorId === actorId);
  const has = (kind: MemoryKind, subject?: string) => entries.some((entry) => entry.kind === kind && (!subject || entry.subject === subject));
  if (has('first_taste', 'dish_egg_rice') && !has('menu_page')) return activityText('下次再一起尝一道不同的正餐，把它记进我们的小菜单吧。', 'Let’s taste a different main dish for our little menu, whenever you like.');
  if ((has('first_taste', 'dish_fruit_pancake') || has('first_taste', 'dish_fruit_pancake_banana')) && !has('fruit_comparison')) return activityText('另一种水果做的松饼，会是什么味道呢？有空一起尝尝。', 'I wonder how the other fruit pancakes taste. Shall we try them sometime?');
  if (has('catch_record') && !has('practice_photo')) return activityText('有空再玩一局接球吧，这次想留下我们的合影。', 'Let’s play catch again sometime and save a little picture of us.');
  return '';
};
