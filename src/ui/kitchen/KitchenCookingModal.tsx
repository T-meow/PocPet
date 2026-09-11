import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ChefHat, Heart, Sparkles, X } from 'lucide-react';
import type { ItemId, PetState } from '../../core/pet';
import { canCraftRecipe, canSpendCompanionTime, craftRecipe, getKitchenHeartReward } from '../../core/kitchen';
import { activityText as L, dishName, getDishId, getRecipe, getRecipeIngredients } from '../../core/kitchenRecipes';
import { playSfx } from '../../core/audio';
import { unknownItemIcon } from '../../assets';
import { DialogShell } from '../DialogShell';
import { beginCookingStep, cookingActionSound, createCookingProgress, finishCookingAnimation, getCookingActionText, getCookingActions, isCookingComplete, type KitchenCraftRequest } from './cookingProcess';

interface Props {
  pet: PetState; request: KitchenCraftRequest; portrait: string; icons: Record<string, string>;
  update: (action: (pet: PetState) => PetState) => void; onBack: () => void; onFeed: (id: ItemId) => void;
}
export const KitchenCookingModal = ({ pet, request, portrait, icons, update, onBack, onFeed }: Props) => {
  const recipe = getRecipe(request.recipeId)!;
  const dishId = getDishId(recipe, request.banana);
  const result = pet.kitchen.lastCraft?.id === request.id ? pet.kitchen.lastCraft : undefined;
  const [progress, setProgress] = useState(createCookingProgress);
  const [submitted, setSubmitted] = useState(false);
  const progressRef = useRef(progress);
  const updateRef = useRef(update);
  updateRef.current = update;
  const finishSoundPlayed = useRef(Boolean(result));
  const reward = getKitchenHeartReward(pet);
  const actions = getCookingActions(recipe.method, recipe.technique);
  const canCook = canCraftRecipe(pet, request.recipeId, request.banana, request.quantity);
  const back = () => { playSfx('close'); onBack(); };
  const submit = () => {
    setSubmitted(true);
    updateRef.current((current) => craftRecipe(current, request.recipeId, request.banana, request.quantity, request.id));
  };
  useEffect(() => {
    if (!progress.readyAt || result) return;
    const timer = window.setTimeout(() => {
      const next = finishCookingAnimation(progress, progress.readyAt);
      progressRef.current = next;
      setProgress(next);
      if (isCookingComplete(next)) submit();
    }, Math.max(0, progress.readyAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [progress.readyAt, request.id, Boolean(result)]);
  useEffect(() => {
    if (result && !finishSoundPlayed.current) { finishSoundPlayed.current = true; playSfx('kitchen_finish'); }
  }, [result?.id]);
  const step = () => {
    if (!canCook || result) return;
    const next = beginCookingStep(progressRef.current, recipe.method, Date.now(), recipe.technique);
    if (next === progressRef.current) return;
    progressRef.current = next; setProgress(next);
    playSfx(cookingActionSound(next.action!));
  };
  const completedSteps = progress.step - (progress.readyAt ? 1 : 0);
  const ingredients = getRecipeIngredients(recipe, request.banana);
  const baseTotal = result?.baseHearts;
  const skillTotal = result?.skillHearts;
  return <DialogShell className="activity-modal cooking-modal" labelId="cooking-title" onClose={back}>
    <header className="activity-header"><div className="activity-heading"><span className="activity-icon"><ChefHat /></span><div><small>MADE WITH LOVE</small><h2 id="cooking-title">{result ? L('一起做好啦', 'Freshly made together') : L('亲手做一道小料理', 'A little hands-on cooking')}</h2></div></div><button className="icon-button" onClick={back} aria-label={L('返回食谱', 'Back to recipes')}><X /></button></header>
    <div className="cooking-body">{result ? <section className="cooking-reward" aria-live="polite">
      <div className={`dish-plate dish-plate--${pet.kitchen.plating} cooking-finished-dish`}><img src={icons[result.dishId] ?? unknownItemIcon} alt="" /></div>
      <small>{L('已收入背包', 'SAVED IN YOUR BAG')}</small><h3>{dishName(result.dishId)} × {result.quantity}</h3>
      <p className="cooking-reward-hearts"><Heart /><strong>+{result.hearts}</strong><span>{L('心心', 'hearts')}</span></p>
      {baseTotal !== undefined && skillTotal !== undefined && <p className="cooking-reward-breakdown">{L(`基础 ${baseTotal} · 料理 Lv.${result.skillLevel} +${skillTotal}`, `Base ${baseTotal} · Cooking Lv.${result.skillLevel} +${skillTotal}`)}{result.hearts > baseTotal + skillTotal && L(` · 其他加成 +${result.hearts - baseTotal - skillTotal}`, ` · Other bonuses +${result.hearts - baseTotal - skillTotal}`)}</p>}
      <p className="activity-muted">{L('香喷喷的，留着慢慢分享。', 'Something tasty to share whenever you like.')}</p>
      <div className="cooking-result-actions"><button className="activity-secondary" onClick={back}><ArrowLeft size={17} />{L('回到食谱', 'Back to recipes')}</button><button className="activity-primary" disabled={!canSpendCompanionTime(pet) || !(pet.inventory[result.dishId] > 0)} onClick={() => onFeed(result.dishId)}>{L('喂给伙伴一份', 'Share one serving')}</button></div>
    </section> : <>
      <div className="cooking-order"><img src={icons[dishId] ?? unknownItemIcon} alt="" /><div><h3>{dishName(dishId)} × {request.quantity}</h3><p>{L('轻点三下，一起把它做好。', 'Three little actions to make it together.')}</p></div></div>
      <ol className="cooking-steps">{actions.map((action, index) => <li key={action} className={completedSteps > index ? 'done' : completedSteps === index ? 'current' : ''}><span>{completedSteps > index ? '✓' : index + 1}</span>{getCookingActionText(action)}</li>)}</ol>
      <div key={`${progress.step}-${progress.action ?? 'idle'}`} className={`cooking-stage cooking-method--${recipe.method} cooking-technique--${recipe.technique ?? recipe.method} cooking-action--${progress.action ?? 'idle'}`} aria-hidden="true">
        <img className="cooking-companion" src={portrait} alt="" draggable={false} />
        <div className="cooking-appliance"><div className="cooking-vessel"><i className="cooking-heat" /><span className="cooking-ingredients">{ingredients.map((id, index) => <img key={id} src={icons[id] ?? unknownItemIcon} alt="" draggable={false} style={{ '--ingredient-index': index } as CSSProperties} />)}</span></div><span className="cooking-spoon" /><span className="cooking-steam">〰　〰　〰</span></div>
        {progress.action === 'serve' && <img className="cooking-plated" src={icons[dishId] ?? unknownItemIcon} alt="" />}
        <span className="cooking-counter" />
      </div>
      <div className="cooking-controls"><p className="activity-heart"><Heart size={16} />{L(`完成收获 ${request.quantity} 份料理，至少 ${reward.heartsPerServing * request.quantity} 心心`, `${request.quantity} servings and at least ${reward.heartsPerServing * request.quantity} hearts`)}</p>
        {!canCook && <p className="activity-info">{L('伙伴需要空闲，且材料和厨具齐全后才能继续。', 'Your companion needs to be free, with ingredients and tools ready.')}</p>}
        {submitted ? <><p className="activity-info">{L('这次还没能出炉，材料没有扣除。可以稍后重试或回食谱调整。', 'Not ready to serve yet. No ingredients were spent. Retry or return to recipes.')}</p><button className="activity-primary" disabled={!canCook} onClick={submit}>{L('重新确认出炉', 'Try serving again')}</button></> : <button className="activity-primary cooking-step-button" disabled={!canCook || Boolean(progress.readyAt) || progress.step >= 3} onClick={step}><Sparkles size={18} />{progress.readyAt ? L('好香呀…', 'Looking lovely…') : getCookingActionText(actions[Math.min(progress.step, 2)])}</button>}
        <button className="activity-link" onClick={back}>{L('先回食谱 · 完成前不消耗材料', 'Back to recipes · ingredients are spent on completion')}</button>
      </div>
    </>}</div>
  </DialogShell>;
};
