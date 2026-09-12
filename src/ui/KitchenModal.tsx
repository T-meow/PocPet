import { useState } from 'react';
import { BookOpen, ChefHat, Heart, ShoppingBag, X } from 'lucide-react';
import { DialogShell } from './DialogShell';
import { CompanionMemories } from './CompanionMemories';
import type { PetState, ItemId, ItemRegistry } from '../core/pet';
import type { RecipeId } from '../core/companionActivityTypes';
import { activityText as L, cookingMethods, dishName, getDish, getDishId, getRecipe, getRecipeIngredientEntries, recipeName, recipes } from '../core/kitchenRecipes';
import { buyKitchenEquipment, canCraftRecipe, canSpendCompanionTime, getCraftLimit, getKitchenHeartReward, getKitchenSkillXpReward, kitchenMadeCount, kitchenRecipeCount } from '../core/kitchen';
import { formatPracticeSkillXp } from '../core/partnerSchedule';
import { playSfx } from '../core/audio';
import { KitchenCookingModal } from './kitchen/KitchenCookingModal';
import type { KitchenCraftRequest } from './kitchen/cookingProcess';

interface Props {
  pet: PetState; actorId: string; portrait: string; workingPortrait: string; icons: Record<string, string>; registry: ItemRegistry;
  recipeId: RecipeId; onRecipe: (id: RecipeId) => void; banana: boolean; onBanana: (value: boolean) => void; quantity: number; onQuantity: (quantity: number) => void;
  update: (action: (pet: PetState) => PetState) => void; onClose: () => void; onShop: () => void; onFeed: (id: ItemId) => void;
}
export const KitchenModal = ({ pet, actorId, portrait, workingPortrait, icons, registry, recipeId, onRecipe, banana, onBanana, quantity, onQuantity, update, onClose, onShop, onFeed }: Props) => {
  const [tab, setTab] = useState<'book' | 'equipment' | 'memories'>('book');
  const [isRecipeOpen, setRecipeOpen] = useState(false);
  const [craftRequest, setCraftRequest] = useState<KitchenCraftRequest>();
  const recipe = getRecipe(recipeId)!;
  const ingredients = getRecipeIngredientEntries(recipe, banana);
  const recipeCount = kitchenRecipeCount(pet);
  const limit = getCraftLimit(pet, recipeId, banana);
  const canCook = canSpendCompanionTime(pet);
  const equipmentReady = pet.kitchen.equipment.includes(recipe.method);
  const result = pet.kitchen.lastCraft;
  const reward = getKitchenHeartReward(pet);
  const skillXp = getKitchenSkillXpReward(pet, recipeId);
  const closeRecipe = () => { playSfx('close'); setRecipeOpen(false); };
  const craft = () => {
    if (!canCraftRecipe(pet, recipeId, banana, quantity)) return;
    playSfx('open');
    setRecipeOpen(false);
    setCraftRequest({ id: crypto.randomUUID(), recipeId, banana, quantity });
  };
  return <><DialogShell className="activity-modal kitchen-modal" labelId="kitchen-title" onClose={onClose}>
    <header className="activity-header"><div className="activity-heading"><span className="activity-icon"><ChefHat /></span><div><small>MADE WITH LOVE</small><h2 id="kitchen-title">{L('一起下厨', 'Our little kitchen')}</h2></div></div><div className="activity-header-actions"><span className="activity-wallet">🪙 {pet.coins}</span><button className="icon-button" onClick={onShop} aria-label={L('去商店补充食材', 'Buy ingredients')}><ShoppingBag size={20} /></button><button className="icon-button" onClick={onClose} aria-label={L('关闭厨房', 'Close kitchen')}><X /></button></div></header>
    <nav className="activity-tabs" aria-label={L('厨房内容', 'Kitchen sections')}>{([['book', L('食谱本', 'Recipes')], ['equipment', L('厨具', 'Kitchen tools')], ['memories', L('试吃留言', 'Memories')]] as const).map(([id, label]) => <button key={id} aria-pressed={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
    <div className="activity-body">
      <div className="kitchen-scene"><div className="kitchen-scene-copy"><small>{L('不着急，慢慢来', 'TAKE YOUR TIME')}</small><h3>{L('今天想一起做点什么？', 'What shall we make today?')}</h3><p>{L(`发现 ${recipeCount} / ${recipes.length} 道食谱 · 累计制作 ${kitchenMadeCount(pet)} 份`, `${recipeCount} / ${recipes.length} recipes · ${kitchenMadeCount(pet)} dishes made`)}</p></div><img className="companion-portrait" src={portrait} alt={pet.name} /><div className="kitchen-counter" aria-hidden="true">🥣　🥄　🪴</div></div>
      {!canCook && <p className="activity-info">{L('伙伴正在休息或忙碌，可以先看食谱，等空闲再一起做。', 'Your companion is resting or busy. Browse recipes and cook together later.')}</p>}
      {tab === 'book' && <section className="kitchen-recipe-book"><div className="activity-section-title"><BookOpen size={18} /><h3>{L('小小食谱本', 'Our recipe book')}</h3><small>{recipeCount}/{recipes.length}</small></div><div className="recipe-grid">{recipes.map((entry) => <button className={`recipe-card${recipeId === entry.id ? ' selected' : ''}`} aria-haspopup="dialog" aria-expanded={isRecipeOpen && recipeId === entry.id} key={entry.id} onClick={() => { playSfx('open'); onRecipe(entry.id); onBanana(false); onQuantity(1); setRecipeOpen(true); }}><img src={icons[getDishId(entry)]} alt="" /><strong>{recipeName(entry)}</strong><small>{pet.kitchen.made[entry.id] ? L(`做过 ${pet.kitchen.made[entry.id]} 份`, `${pet.kitchen.made[entry.id]} made`) : L('还没一起做过', 'A new recipe to try')}</small></button>)}</div></section>}
      {tab === 'equipment' && <section><div className="equipment-grid">{cookingMethods.map((entry) => <article className="equipment-card" key={entry.id}><span>{entry.glyph}</span><h3>{L(entry.name, entry.en)}</h3><p>{pet.kitchen.equipment.includes(entry.id) ? L('已经摆在厨房里了', 'Ready in your kitchen') : L(`做过 ${entry.requiredRecipes} 种料理后 · ${entry.price} 金币`, `Make ${entry.requiredRecipes} recipes · ${entry.price} coins`)}</p><button className="activity-primary" disabled={pet.kitchen.equipment.includes(entry.id) || recipeCount < entry.requiredRecipes || pet.coins < entry.price} onClick={() => update((current) => buyKitchenEquipment(current, entry.id))}>{pet.kitchen.equipment.includes(entry.id) ? L('已拥有', 'Owned') : L('添置厨具', 'Get this tool')}</button></article>)}</div></section>}
      {tab === 'memories' && <CompanionMemories pet={pet} actorId={actorId} />}
      {result && tab !== 'memories' && <button className="kitchen-last-craft" onClick={() => { const dish = getDish(result.dishId); if (dish) { playSfx('open'); setCraftRequest({ id: result.id, recipeId: dish.recipe.id, banana: dish.banana, quantity: result.quantity }); } }}><img src={icons[result.dishId]} alt="" /><span>{L('查看最近出炉', 'View the last dish')}<strong>{dishName(result.dishId)} × {result.quantity}</strong></span><span aria-hidden="true">›</span></button>}
    </div>
  </DialogShell>
  {craftRequest ? <KitchenCookingModal key={craftRequest.id} pet={pet} request={craftRequest} portrait={workingPortrait} icons={icons} update={update} onBack={() => setCraftRequest(undefined)} onFeed={onFeed} /> : isRecipeOpen && <DialogShell className="activity-modal kitchen-recipe-modal" labelId="kitchen-recipe-title" onClose={closeRecipe}>
    <header className="activity-header"><div className="activity-heading"><span className="activity-icon"><ChefHat /></span><h2 id="kitchen-recipe-title">{L('制作料理', 'Prepare a dish')}</h2></div><button type="button" className="icon-button" onClick={closeRecipe} aria-label={L('关闭并返回菜谱', 'Close and return to recipes')}><X /></button></header>
    <div className="activity-body recipe-detail"><div className={`dish-plate dish-plate--${pet.kitchen.plating}`}><img src={icons[getDishId(recipe, banana)]} alt="" /></div><h3>{dishName(getDishId(recipe, banana))}</h3><p className="activity-muted">{L(cookingMethods.find((entry) => entry.id === recipe.method)!.name, cookingMethods.find((entry) => entry.id === recipe.method)!.en)} · {pet.kitchen.made[recipeId] ? L('熟悉的好味道', 'A familiar favorite') : L('新的味道，一起试试', 'A new flavor to try together')}</p>
          {skillXp > 0 && <p className="activity-skill-xp">{L('本次出炉：', 'On completion: ')}{formatPracticeSkillXp('cooking', skillXp)}<br />{L('每次制作 +1，首做额外 +5；批量计一次。', 'Each completed batch: +1 XP, plus 5 for a new recipe.')}</p>}
          {recipe.fruitVariant && <div className="activity-choice"><button aria-pressed={!banana} onClick={() => onBanana(false)}>🍎 {L('苹果', 'Apple')}</button><button aria-pressed={banana} onClick={() => onBanana(true)}>🍌 {L('香蕉', 'Banana')}</button></div>}
          <div className="recipe-ingredients">{ingredients.map(({ id, quantity: perServing }) => <div key={id} className={(pet.inventory[id] ?? 0) < perServing * quantity ? 'ingredient missing' : 'ingredient'}><img src={icons[id]} alt="" /><span>{registry.get(id)?.name ?? id}<small>{L(`需要 ${perServing * quantity} · 持有 ${pet.inventory[id] ?? 0}`, `Need ${perServing * quantity} · Own ${pet.inventory[id] ?? 0}`)}</small></span></div>)}</div>
          <p className="dish-effects">{Object.entries(recipe.effect).map(([key, value]) => <span key={key}>{L(({ hunger: '饱腹', mood: '心情', health: '健康', energy: '体力', cleanliness: '清洁' } as Record<string, string>)[key], key)} +{value}</span>)}</p>
          <label className="quantity-field">{L('制作份数', 'Quantity')}<input type="number" min={1} max={Math.max(1, limit)} value={quantity} onChange={(event) => onQuantity(Math.max(1, Math.min(99, Math.floor(Number(event.target.value)) || 1)))} /></label><div className="activity-choice">{[1, 5, 10].map((amount) => <button key={amount} disabled={amount > limit} onClick={() => onQuantity(amount)}>{amount}</button>)}<button disabled={!limit} onClick={() => onQuantity(limit)}>{L('最多', 'Max')}</button></div>
          <p className="activity-heart"><Heart size={16} /> {L(`本次至少 ${reward.heartsPerServing * quantity} 心心`, `At least ${reward.heartsPerServing * quantity} hearts`)}<small>{L(`每份基础 ${reward.baseHearts} · 料理 Lv.${reward.skillLevel} 加成 ${reward.skillBonusPercent}%（+${reward.skillHearts}）`, `Base ${reward.baseHearts} each · Cooking Lv.${reward.skillLevel}: +${reward.skillBonusPercent}% (+${reward.skillHearts})`)}</small><small>{L('已有产心加成另计', 'Your heart bonuses also apply')}</small></p>
          <button className="activity-primary" disabled={!canCook || !equipmentReady || quantity > limit} onClick={craft}>{L('一起制作', 'Make it together')}</button>
          {!equipmentReady && <button className="activity-link" onClick={() => { closeRecipe(); setTab('equipment'); }}>{L('先添置需要的厨具', 'Get the required kitchen tool')}</button>}
          {quantity > limit && <button className="activity-link" onClick={onShop}>{L('去商店补充食材', 'Shop for ingredients')}</button>}
    </div>
  </DialogShell>}</>;
};
