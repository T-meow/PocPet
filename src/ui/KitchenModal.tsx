import { getExplorationSource } from '../core/explorationSources';
import type { OutpostRequest } from './outpostNavigation';
import { useState } from 'react';
import { ChefHat, Heart, ShoppingBag, X } from 'lucide-react';
import { DialogShell } from './DialogShell';
import { CompanionMemories } from './CompanionMemories';
import type { PetState, ItemId, ItemRegistry } from '../core/pet';
import type { RecipeId, MilkChoice } from '../core/companionActivityTypes';
import { activityText as L, cookingMethods, dishName, getDish, getDishId, getRecipe, getRecipeIngredientEntries, getRecipeUnlockReason, recipeName, recipes } from '../core/kitchenRecipes';
import { buyKitchenEquipment, canCraftRecipe, canSpendCompanionTime, getCraftLimit, getKitchenHeartReward, getKitchenSkillXpReward, kitchenMadeCount, kitchenRecipeCount } from '../core/kitchen';
import { formatPracticeSkillXp } from '../core/partnerSchedule';
import { playSfx } from '../core/audio';
import { KitchenCookingModal } from './kitchen/KitchenCookingModal';
import type { KitchenCraftRequest } from './kitchen/cookingProcess';
import { getItemStatEffect } from '../core/itemEffects';
import { getItemEffectBadges } from './itemEffectBadges';
import { kitchenEquipmentImages } from '../kitchenEquipmentAssets';
import { kitchenPlateImages, kitchenSceneImages } from '../kitchenSceneAssets';
import { DishArtwork } from './kitchen/DishArtwork';
import { dishPresentation } from '../companionActivityAssets';
import { hasRecipeMilkChoice } from '../core/kitchenRecipes';
import { RecipeBook } from './kitchen/RecipeBook';
import { RecipeBadges } from './kitchen/RecipeBadges';
import { RecipeProgress } from './kitchen/RecipeProgress';
import { RecipeNotes } from './kitchen/RecipeNotes';
import { FoodProcessingPanel } from './kitchen/FoodProcessingPanel';
import '../styles/food-production.css';
import { getItemSourceLabel } from './itemSourceLabel';

interface Props {
  pet: PetState; actorId: string; portrait: string; workingPortrait: string; icons: Record<string, string>; registry: ItemRegistry;
  recipeId: RecipeId; onRecipe: (id: RecipeId) => void; banana: boolean; onBanana: (value: boolean) => void; quantity: number; onQuantity: (quantity: number) => void;
  update: (action: (pet: PetState) => PetState) => void; onClose: () => void; onShop: () => void; onFeed: (id: ItemId) => void;
  favoriteFoodIds?: readonly ItemId[]; onOpenOutpost?: (request: OutpostRequest) => void;
}
export const KitchenModal = ({ pet, actorId, portrait, workingPortrait, icons, registry, recipeId, onRecipe, banana, onBanana, quantity, onQuantity, update, onClose, onShop, onFeed, favoriteFoodIds, onOpenOutpost }: Props) => {
  const [tab, setTab] = useState<'book' | 'processing' | 'equipment' | 'memories'>('book');
  const [milk, setMilk] = useState<MilkChoice>('farm_milk');
  const [isRecipeOpen, setRecipeOpen] = useState(false);
  const [craftRequest, setCraftRequest] = useState<KitchenCraftRequest>();
  const [recipeParents, setRecipeParents] = useState<{ recipeId: RecipeId; banana: boolean; quantity: number; milk: MilkChoice }[]>([]);
  const recipe = getRecipe(recipeId)!;
  const ingredients = getRecipeIngredientEntries(recipe, banana, milk);
  const recipeCount = kitchenRecipeCount(pet);
  const limit = getCraftLimit(pet, recipeId, banana, milk);
  const canCook = canSpendCompanionTime(pet);
  const equipmentReady = pet.kitchen.equipment.includes(recipe.method);
  const result = pet.kitchen.lastCraft;
  const reward = getKitchenHeartReward(pet, recipeId, banana);
  const dishItem = registry.get(getDishId(recipe, banana));
  const parent = recipeParents[recipeParents.length - 1];
  const skillXp = getKitchenSkillXpReward(pet, recipeId);
  const returnToParent = () => {
    if (!parent) return;
    onRecipe(parent.recipeId); onBanana(parent.banana); onQuantity(parent.quantity); setMilk(parent.milk);
    setRecipeParents((parents) => parents.slice(0, -1)); setRecipeOpen(true);
  };
  const closeRecipe = () => { playSfx('close'); if (parent) returnToParent(); else setRecipeOpen(false); };
  const prepareIngredient = (id: ItemId, missing: number) => {
    const dish = getDish(id);
    if (!dish) return;
    setRecipeParents((parents) => [...parents, { recipeId, banana, quantity, milk }]);
    onRecipe(dish.recipe.id); onBanana(dish.banana); onQuantity(Math.max(1, Math.min(99, missing)));
  };
  const craft = () => {
    if (!canCraftRecipe(pet, recipeId, banana, quantity, milk)) return;
    playSfx('open');
    setRecipeOpen(false);
    setCraftRequest({ id: crypto.randomUUID(), recipeId, banana, quantity, milk });
  };
  return <><DialogShell className="activity-modal kitchen-modal" backdropClassName="activity-backdrop" labelId="kitchen-title" onClose={onClose}>
    <header className="activity-header"><div className="activity-heading"><span className="activity-icon"><ChefHat /></span><div><small>MADE WITH LOVE</small><h2 id="kitchen-title">{L('一起下厨', 'Our little kitchen')}</h2></div></div><div className="activity-header-actions"><span className="activity-wallet">🪙 {pet.coins}</span><button className="icon-button" onClick={onShop} aria-label={L('去商店补充食材', 'Buy ingredients')}><ShoppingBag size={20} /></button><button className="icon-button" onClick={onClose} aria-label={L('关闭厨房', 'Close kitchen')}><X /></button></div></header>
    <nav className="activity-tabs" aria-label={L('厨房内容', 'Kitchen sections')}>{([['book', L('食谱本', 'Recipes')], ['processing', '加工台'], ['equipment', L('厨具', 'Kitchen tools')], ['memories', L('试吃留言', 'Memories')]] as const).map(([id, label]) => <button key={id} aria-pressed={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
    <div className="activity-body">
      <div className="kitchen-scene"><div className="kitchen-scene-copy"><small>{L('不着急，慢慢来', 'TAKE YOUR TIME')}</small><h3>{L('今天想一起做点什么？', 'What shall we make today?')}</h3><p>{L(`发现 ${recipeCount} / ${recipes.length} 道食谱 · 累计制作 ${kitchenMadeCount(pet)} 份`, `${recipeCount} / ${recipes.length} recipes · ${kitchenMadeCount(pet)} dishes made`)}</p></div><img className="companion-portrait" src={portrait} alt={pet.name} /><div className="kitchen-counter" aria-hidden="true"><img src={kitchenSceneImages.servingBowl} alt="" draggable={false} /><img src={kitchenSceneImages.servingGlass} alt="" draggable={false} /><img src={kitchenSceneImages.cookingSpoon} alt="" draggable={false} /><img src={kitchenSceneImages.kitchenPlant} alt="" draggable={false} /></div></div>
      {!canCook && <p className="activity-info">{L('伙伴正在休息或忙碌，可以先看食谱，等空闲再一起做。', 'Your companion is resting or busy. Browse recipes and cook together later.')}</p>}
      {!pet.community.herbDiscovered && <p className="activity-info">香草暖粥需要在溪谷溪边采集地完成全部阶段取得香草线索，随后可在社区菜地培育原料。</p>}
      {tab === 'book' && <RecipeBook kitchen={pet.kitchen} actorId={actorId} icons={icons} selected={recipeId} onSelect={id => { playSfx('open'); setRecipeParents([]); onRecipe(id); onBanana(false); onQuantity(1); setMilk((pet.inventory.farm_milk ?? 0) > 0 || !(pet.inventory.ad_milk ?? 0) ? 'farm_milk' : 'ad_milk'); setRecipeOpen(true); }} />}
      {tab === 'processing' && <FoodProcessingPanel pet={pet} update={update} registry={registry} icons={icons} />}
      {tab === 'equipment' && <section><div className="equipment-grid">{cookingMethods.map((entry) => <article className="equipment-card" key={entry.id}><img src={kitchenEquipmentImages[entry.id].image} alt="" draggable={false} /><h3>{L(entry.name, entry.en)}</h3><p>{pet.kitchen.equipment.includes(entry.id) ? L('已经摆在厨房里了', 'Ready in your kitchen') : L(`做过 ${entry.requiredRecipes} 种料理后 · ${entry.price} 金币`, `Make ${entry.requiredRecipes} recipes · ${entry.price} coins`)}</p><button className="activity-primary" disabled={pet.kitchen.equipment.includes(entry.id) || recipeCount < entry.requiredRecipes || pet.coins < entry.price} onClick={() => update((current) => buyKitchenEquipment(current, entry.id))}>{pet.kitchen.equipment.includes(entry.id) ? L('已拥有', 'Owned') : L('添置厨具', 'Get this tool')}</button></article>)}</div></section>}
      {tab === 'memories' && <CompanionMemories pet={pet} actorId={actorId} />}
      {result && tab !== 'memories' && <button className="kitchen-last-craft" onClick={() => { const dish = getDish(result.dishId); if (dish) { playSfx('open'); setRecipeParents([]); onRecipe(dish.recipe.id); onBanana(dish.banana); onQuantity(result.quantity); setCraftRequest({ id: result.id, recipeId: dish.recipe.id, banana: dish.banana, quantity: result.quantity }); } }}><img src={icons[result.dishId]} alt="" /><span>{L('查看最近出炉', 'View the last dish')}<strong>{dishName(result.dishId)} × {result.quantity}</strong></span><span aria-hidden="true">›</span></button>}
    </div>
  </DialogShell>
  {craftRequest ? <KitchenCookingModal key={craftRequest.id} pet={pet} request={craftRequest} portrait={workingPortrait} icons={icons} update={update} backLabel={parent ? L(`继续做${recipeName(getRecipe(parent.recipeId)!)}`, `Continue ${recipeName(getRecipe(parent.recipeId)!)}`) : undefined} onBack={() => { setCraftRequest(undefined); if (parent) returnToParent(); else setRecipeOpen(true); }} onFeed={onFeed} /> : isRecipeOpen && <DialogShell className="activity-modal kitchen-recipe-modal" backdropClassName="activity-backdrop" labelId="kitchen-recipe-title" onClose={closeRecipe}>
    <header className="activity-header"><div className="activity-heading"><span className="activity-icon"><ChefHat /></span><h2 id="kitchen-recipe-title">{L('制作料理', 'Prepare a dish')}</h2></div><button type="button" className="icon-button" onClick={closeRecipe} aria-label={L('关闭并返回菜谱', 'Close and return to recipes')}><X /></button></header>
    <div className="activity-body recipe-detail"><DishArtwork id={getDishId(recipe, banana)} image={icons[getDishId(recipe, banana)]} plating={pet.kitchen.plating} /><h3>{dishName(getDishId(recipe, banana))}</h3><RecipeProgress kitchen={pet.kitchen} actorId={actorId} recipe={recipe} banana={banana} /><RecipeBadges recipe={recipe} banana={banana} /><p className="activity-muted">{L(cookingMethods.find((entry) => entry.id === recipe.method)!.name, cookingMethods.find((entry) => entry.id === recipe.method)!.en)} · {pet.kitchen.made[recipeId] ? L('熟悉的好味道', 'A familiar favorite') : L('新的味道，一起试试', 'A new flavor to try together')}</p>
          {dishPresentation[getDishId(recipe, banana)].container === 'fixed_plate' && <div className="kitchen-plating-options" role="group" aria-label={L('餐盘样式', 'Plate style')}>{([['plain', L('素色', 'Plain')], ['flower', L('花朵', 'Flowers')], ['stars', L('星星', 'Stars')]] as const).map(([plating, label]) => <button key={plating} type="button" aria-pressed={pet.kitchen.plating === plating} onClick={() => update((current) => ({ ...current, kitchen: { ...current.kitchen, plating } }))}><img src={kitchenPlateImages[plating]} alt="" draggable={false} /><span>{label}</span></button>)}</div>}
          {skillXp > 0 && <p className="activity-skill-xp">{formatPracticeSkillXp('cooking', skillXp)}</p>}
          {recipe.fruitVariant && <div className="activity-choice"><button aria-pressed={!banana} onClick={() => onBanana(false)}>🍎 {L('苹果', 'Apple')}</button><button aria-pressed={banana} onClick={() => onBanana(true)}>🍌 {L('香蕉', 'Banana')}</button></div>}
          {hasRecipeMilkChoice(recipe) && <fieldset className="recipe-milk-choice"><legend>选择奶类</legend><div className="activity-choice">{(['farm_milk', 'ad_milk'] as const).map(id => <button key={id} aria-pressed={milk === id} onClick={() => setMilk(id)}>{registry.get(id)?.name ?? id} · 库存 {pet.inventory[id] ?? 0}</button>)}</div></fieldset>}
          {parent && <button className="activity-link" onClick={returnToParent}>{L(`返回${recipeName(getRecipe(parent.recipeId)!)}`, `Back to ${recipeName(getRecipe(parent.recipeId)!)}`)}</button>}
          <div className="recipe-ingredients">{ingredients.map(({ id, quantity: perServing }) => {
            const missing = perServing * quantity - (pet.inventory[id] ?? 0), source = getExplorationSource(pet, id);
            return <div key={id} className={missing > 0 ? 'ingredient missing' : 'ingredient'}><img src={icons[id]} alt="" /><span>{registry.get(id)?.name ?? id}<small>{L(`需要 ${perServing * quantity} · 持有 ${pet.inventory[id] ?? 0}`, `Need ${perServing * quantity} · Own ${pet.inventory[id] ?? 0}`)}</small>{missing > 0 && <small>来源：{getItemSourceLabel(id)}</small>}{missing > 0 && source && onOpenOutpost && <button className="activity-link" onClick={() => { onClose(); onOpenOutpost({ view: 'manual', ...source }); }}>前往地图采集</button>}{missing > 0 && getDish(id) && <button className="activity-link" onClick={() => prepareIngredient(id, missing)}>{L(`先做${dishName(id)}`, `Prepare ${dishName(id)}`)}</button>}</span></div>;
          })}</div>
          {dishItem && <div className="item-recovery-preview"><p>每份成品效果：{getItemEffectBadges(getItemStatEffect(pet, dishItem)).map(effect => effect.label).join(' · ')}</p></div>}
          <RecipeNotes pet={pet} recipe={recipe} banana={banana} milk={milk} />
          <label className="quantity-field">{L('制作份数', 'Quantity')}<input type="number" min={1} max={Math.max(1, limit)} value={quantity} onChange={(event) => onQuantity(Math.max(1, Math.min(99, Math.floor(Number(event.target.value)) || 1)))} /></label><div className="activity-choice">{[1, 5, 10].map((amount) => <button key={amount} disabled={amount > limit} onClick={() => onQuantity(amount)}>{amount}</button>)}<button disabled={!limit} onClick={() => onQuantity(limit)}>{L('最多', 'Max')}</button></div>
          <p className="activity-heart"><Heart size={16} /> {L(`本次 ${reward.heartsPerServing * quantity} 心心`, `${reward.heartsPerServing * quantity} hearts`)}</p>
          <button className="activity-primary" disabled={!canCook || !equipmentReady || quantity > limit} onClick={craft}>{getRecipeUnlockReason(pet, recipeId) || L('一起制作', 'Make it together')}</button>
          {!equipmentReady && <button className="activity-link" onClick={() => { closeRecipe(); setTab('equipment'); }}>{L('先添置需要的厨具', 'Get the required kitchen tool')}</button>}
          {ingredients.some(({ id, quantity: amount }) => !getDish(id) && (pet.inventory[id] ?? 0) < amount * quantity) && <button className="activity-link" onClick={onShop}>{L('去商店补充食材', 'Shop for ingredients')}</button>}
    </div>
  </DialogShell>}</>;
};
