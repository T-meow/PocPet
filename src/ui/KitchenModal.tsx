import { useState } from 'react';
import { BookOpen, ChefHat, Heart, ShoppingBag, X } from 'lucide-react';
import { DialogShell } from './DialogShell';
import { CompanionMemories } from './CompanionMemories';
import type { PetState, ItemId, ItemRegistry } from '../core/pet';
import type { CookingMethod, RecipeId } from '../core/companionActivityTypes';
import { activityText as L, cookingMethods, dishName, findRecipeCombination, getDish, getDishId, getRecipe, getRecipeIngredientEntries, recipeName, recipes } from '../core/kitchenRecipes';
import { buyKitchenEquipment, canCraftRecipe, canSpendCompanionTime, getCraftLimit, getKitchenHeartReward, kitchenMadeCount, kitchenRecipeCount } from '../core/kitchen';
import { playSfx } from '../core/audio';
import { KitchenCookingModal } from './kitchen/KitchenCookingModal';
import type { KitchenCraftRequest } from './kitchen/cookingProcess';

interface Props {
  pet: PetState; actorId: string; portrait: string; workingPortrait: string; icons: Record<string, string>; registry: ItemRegistry;
  recipeId: RecipeId; onRecipe: (id: RecipeId) => void; banana: boolean; onBanana: (value: boolean) => void; quantity: number; onQuantity: (quantity: number) => void;
  update: (action: (pet: PetState) => PetState) => void; onClose: () => void; onShop: () => void; onFeed: (id: ItemId) => void;
}
export const KitchenModal = ({ pet, actorId, portrait, workingPortrait, icons, registry, recipeId, onRecipe, banana, onBanana, quantity, onQuantity, update, onClose, onShop, onFeed }: Props) => {
  const [tab, setTab] = useState<'book' | 'research' | 'equipment' | 'memories'>('book');
  const [research, setResearch] = useState<string[]>([]);
  const [method, setMethod] = useState<CookingMethod>('mix');
  const [craftRequest, setCraftRequest] = useState<KitchenCraftRequest>();
  const recipe = getRecipe(recipeId)!;
  const ingredients = getRecipeIngredientEntries(recipe, banana);
  const combination = findRecipeCombination(research, method);
  const recipeCount = kitchenRecipeCount(pet);
  const limit = getCraftLimit(pet, recipeId, banana);
  const canCook = canSpendCompanionTime(pet);
  const equipmentReady = pet.kitchen.equipment.includes(recipe.method);
  const result = pet.kitchen.lastCraft;
  const reward = getKitchenHeartReward(pet);
  const materials = [...new Set(recipes.flatMap((entry) => [...entry.ingredients, ...(entry.fruitVariant ? ['banana' as const] : [])]))];
  const craft = () => {
    if (!canCraftRecipe(pet, recipeId, banana, quantity)) return;
    playSfx('open');
    setCraftRequest({ id: crypto.randomUUID(), recipeId, banana, quantity });
  };
  if (craftRequest) return <KitchenCookingModal key={craftRequest.id} pet={pet} request={craftRequest} portrait={workingPortrait} icons={icons} update={update} onBack={() => setCraftRequest(undefined)} onFeed={onFeed} />;
  return <DialogShell className="activity-modal kitchen-modal" labelId="kitchen-title" onClose={onClose}>
    <header className="activity-header"><div className="activity-heading"><span className="activity-icon"><ChefHat /></span><div><small>MADE WITH LOVE</small><h2 id="kitchen-title">{L('一起下厨', 'Our little kitchen')}</h2></div></div><div className="activity-header-actions"><span className="activity-wallet">🪙 {pet.coins}</span><button className="icon-button" onClick={onShop} aria-label={L('去商店补充食材', 'Buy ingredients')}><ShoppingBag size={20} /></button><button className="icon-button" onClick={onClose} aria-label={L('关闭厨房', 'Close kitchen')}><X /></button></div></header>
    <nav className="activity-tabs" aria-label={L('厨房内容', 'Kitchen sections')}>{([['book', L('食谱本', 'Recipes')], ['research', L('研究搭配', 'Experiment')], ['equipment', L('厨具与摆盘', 'Tools & plating')], ['memories', L('试吃留言', 'Memories')]] as const).map(([id, label]) => <button key={id} aria-pressed={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
    <div className="activity-body">
      <div className="kitchen-scene"><div className="kitchen-scene-copy"><small>{L('不着急，慢慢来', 'TAKE YOUR TIME')}</small><h3>{L('今天想一起做点什么？', 'What shall we make today?')}</h3><p>{L(`发现 ${recipeCount} / ${recipes.length} 道食谱 · 累计制作 ${kitchenMadeCount(pet)} 份`, `${recipeCount} / ${recipes.length} recipes · ${kitchenMadeCount(pet)} dishes made`)}</p></div><img className="companion-portrait" src={portrait} alt={pet.name} /><div className="kitchen-counter" aria-hidden="true">🥣　🥄　🪴</div></div>
      {!canCook && <p className="activity-info">{L('伙伴正在休息或忙碌，可以先看食谱，等空闲再一起做。', 'Your companion is resting or busy. Browse recipes and cook together later.')}</p>}
      {tab === 'book' && <div className="kitchen-workspace"><section><div className="activity-section-title"><BookOpen size={18} /><h3>{L('小小食谱本', 'Our recipe book')}</h3><small>{recipeCount}/{recipes.length}</small></div><div className="recipe-grid">{recipes.map((entry) => <button className={`recipe-card${recipeId === entry.id ? ' selected' : ''}`} aria-pressed={recipeId === entry.id} key={entry.id} onClick={() => { onRecipe(entry.id); onBanana(false); onQuantity(1); }}><img src={icons[getDishId(entry)]} alt="" /><strong>{recipeName(entry)}</strong><small>{pet.kitchen.made[entry.id] ? L(`做过 ${pet.kitchen.made[entry.id]} 份`, `${pet.kitchen.made[entry.id]} made`) : L('还没一起做过', 'A new recipe to try')}</small></button>)}</div></section>
        <section className="recipe-detail"><div className={`dish-plate dish-plate--${pet.kitchen.plating}`}><img src={icons[getDishId(recipe, banana)]} alt="" /></div><h3>{dishName(getDishId(recipe, banana))}</h3><p className="activity-muted">{L(cookingMethods.find((entry) => entry.id === recipe.method)!.name, cookingMethods.find((entry) => entry.id === recipe.method)!.en)} · {pet.kitchen.made[recipeId] ? L('熟悉的好味道', 'A familiar favorite') : L('首做获得 5 点料理经验', 'First recipe: +5 cooking XP')}</p>
          {recipe.fruitVariant && <div className="activity-choice"><button aria-pressed={!banana} onClick={() => onBanana(false)}>🍎 {L('苹果', 'Apple')}</button><button aria-pressed={banana} onClick={() => onBanana(true)}>🍌 {L('香蕉', 'Banana')}</button></div>}
          <div className="recipe-ingredients">{ingredients.map(({ id, quantity: perServing }) => <div key={id} className={(pet.inventory[id] ?? 0) < perServing * quantity ? 'ingredient missing' : 'ingredient'}><img src={icons[id]} alt="" /><span>{registry.get(id)?.name ?? id}<small>{L(`需要 ${perServing * quantity} · 持有 ${pet.inventory[id] ?? 0}`, `Need ${perServing * quantity} · Own ${pet.inventory[id] ?? 0}`)}</small></span></div>)}</div>
          <p className="dish-effects">{Object.entries(recipe.effect).map(([key, value]) => <span key={key}>{L(({ hunger: '饱腹', mood: '心情', health: '健康', energy: '体力', cleanliness: '清洁' } as Record<string, string>)[key], key)} +{value}</span>)}</p>
          <label className="quantity-field">{L('制作份数', 'Quantity')}<input type="number" min={1} max={Math.max(1, limit)} value={quantity} onChange={(event) => onQuantity(Math.max(1, Math.min(99, Math.floor(Number(event.target.value)) || 1)))} /></label><div className="activity-choice">{[1, 5, 10].map((amount) => <button key={amount} disabled={amount > limit} onClick={() => onQuantity(amount)}>{amount}</button>)}<button disabled={!limit} onClick={() => onQuantity(limit)}>{L('最多', 'Max')}</button></div>
          <p className="activity-heart"><Heart size={16} /> {L(`本次至少 ${reward.heartsPerServing * quantity} 心心`, `At least ${reward.heartsPerServing * quantity} hearts`)}<small>{L(`每份基础 ${reward.baseHearts} · 料理 Lv.${reward.skillLevel} 加成 ${reward.skillBonusPercent}%（+${reward.skillHearts}）`, `Base ${reward.baseHearts} each · Cooking Lv.${reward.skillLevel}: +${reward.skillBonusPercent}% (+${reward.skillHearts})`)}</small><small>{L('已有产心加成另计', 'Your heart bonuses also apply')}</small></p>
          <button className="activity-primary" disabled={!canCook || !equipmentReady || quantity > limit} onClick={craft}>{L('一起制作', 'Make it together')}</button>
          {!equipmentReady && <button className="activity-link" onClick={() => setTab('equipment')}>{L('先添置需要的厨具', 'Get the required kitchen tool')}</button>}
          {quantity > limit && <button className="activity-link" onClick={onShop}>{L('去商店补充食材', 'Shop for ingredients')}</button>}
        </section></div>}
      {tab === 'research' && <section className="research-panel"><h3>{L('选 1–3 种食材，试试新的搭配', 'Choose 1–3 ingredients')}</h3><p className="activity-muted">{L('先看组合，再决定制作。没有对应食谱时不会消耗材料。', 'Preview your combination first. Unmatched ingredients are never consumed.')}</p><div className="activity-choice">{cookingMethods.map((entry) => <button key={entry.id} aria-pressed={method === entry.id} onClick={() => setMethod(entry.id)}>{entry.glyph} {L(entry.name, entry.en)}</button>)}</div><div className="ingredient-picker">{materials.map((id) => <button key={id} aria-pressed={research.includes(id)} disabled={research.length === 3 && !research.includes(id)} onClick={() => setResearch((selected) => selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id])}><img src={icons[id]} alt="" /><strong>{registry.get(id)?.name ?? id}</strong><small>×{pet.inventory[id] ?? 0}</small></button>)}</div><div className="research-result">{combination ? <><img src={icons[combination.id]} alt="" /><h3>{dishName(combination.id)}</h3><button className="activity-primary" onClick={() => { onRecipe(combination.recipe.id); onBanana(combination.banana); onQuantity(1); setTab('book'); }}>{L('查看配方并制作', 'Review and make')}</button></> : <p>{L('试试水果与牛奶，或者大米与鸡蛋。也可以在食谱本查看做法线索。', 'Try fruit with milk, or rice with an egg. The recipe book has more clues.')}</p>}</div></section>}
      {tab === 'equipment' && <section><div className="equipment-grid">{cookingMethods.map((entry) => <article className="equipment-card" key={entry.id}><span>{entry.glyph}</span><h3>{L(entry.name, entry.en)}</h3><p>{pet.kitchen.equipment.includes(entry.id) ? L('已经摆在厨房里了', 'Ready in your kitchen') : L(`做过 ${entry.requiredRecipes} 种料理后 · ${entry.price} 金币`, `Make ${entry.requiredRecipes} recipes · ${entry.price} coins`)}</p><button className="activity-primary" disabled={pet.kitchen.equipment.includes(entry.id) || recipeCount < entry.requiredRecipes || pet.coins < entry.price} onClick={() => update((current) => buyKitchenEquipment(current, entry.id))}>{pet.kitchen.equipment.includes(entry.id) ? L('已拥有', 'Owned') : L('添置厨具', 'Get this tool')}</button></article>)}</div><h3>{L('给餐盘一点装饰', 'A little decoration')}</h3><div className="activity-choice">{(['plain', 'flower', 'stars'] as const).map((style, index) => <button key={style} aria-pressed={pet.kitchen.plating === style} onClick={() => update((current) => ({ ...current, kitchen: { ...current.kitchen, plating: style } }))}>{['🍽️', '🌼', '✨'][index]} {L(['素净', '小花', '星星'][index], ['Simple', 'Flowers', 'Stars'][index])}</button>)}</div><p className="activity-muted">{L('摆盘只改变样子，不影响料理和心心收益。', 'Plating changes the look without affecting food or hearts.')}</p></section>}
      {tab === 'memories' && <CompanionMemories pet={pet} actorId={actorId} />}
      {result && tab !== 'memories' && <button className="kitchen-last-craft" onClick={() => { const dish = getDish(result.dishId); if (dish) { playSfx('open'); setCraftRequest({ id: result.id, recipeId: dish.recipe.id, banana: dish.banana, quantity: result.quantity }); } }}><img src={icons[result.dishId]} alt="" /><span>{L('查看最近出炉', 'View the last dish')}<strong>{dishName(result.dishId)} × {result.quantity}</strong></span><span aria-hidden="true">›</span></button>}
    </div>
  </DialogShell>;
};
