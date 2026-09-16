import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChefHat, Sparkles, Ticket } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import type { RecipeId } from '../core/companionActivityTypes';
import { festivalNames, getFestivalWindow, getNextFestivalWindow, isFestivalOpen, type SeasonalFestivalId } from '../core/festivalCalendar';
import { getSeasonalSteps, seasonalScripts, type SeasonalRun } from '../core/seasonalScripts';
import { hasSeasonalReward, type SeasonalAction } from '../core/seasonalStories';
import { canSpendCompanionTime } from '../core/kitchen';
import { getRecipe } from '../core/kitchenRecipes';
import { FestivalArtwork } from './FestivalArtwork';
import porkDumplings from '../assets/icon/item_dish_dumplings_pork_cabbage.png';
import vegetableDumplings from '../assets/icon/item_dish_dumplings_vegetable.png';
import porkZongzi from '../assets/icon/item_dish_zongzi_braised_pork.png';
import beanZongzi from '../assets/icon/item_dish_zongzi_red_bean.png';

const dishImages: Partial<Record<RecipeId, string>> = { dumplings_pork_cabbage: porkDumplings, dumplings_vegetable: vegetableDumplings, zongzi_braised_pork: porkZongzi, zongzi_red_bean: beanZongzi };
interface SeasonalStoryProps {
  pet: PetState; festival: SeasonalFestivalId; run?: SeasonalRun; replay?: boolean; backToAlbum?: boolean; blocked?: boolean; now?: number;
  onStart: () => void; onAction: (action: SeasonalAction) => void; onKitchen: (recipe: RecipeId) => void; onBack: () => void; onAlbum: () => void;
}
export const SeasonalStoryPage = ({ pet, festival, run, replay = false, backToAlbum = replay, blocked = false, now = Date.now(), onStart, onAction, onKitchen, onBack, onAlbum }: SeasonalStoryProps) => {
  const [page, setPage] = useState(0);
  const script = seasonalScripts[festival];
  const window = run ? getFestivalWindow(festival, run.year) : getNextFestivalWindow(festival, now);
  const steps = run ? getSeasonalSteps(run) : [];
  const history = run?.stage === 'complete' ? steps : steps.slice(0, steps.findIndex(step => step.id === run?.stage) + 1);
  const pageIndex = replay ? Math.min(page, history.length - 1) : history.length - 1;
  const moment = history[pageIndex];
  const busy = !canSpendCompanionTime(pet), disabled = blocked || busy;
  const recipe = moment?.recipe ? getRecipe(moment.recipe) : undefined;
  const dish = recipe ? `dish_${recipe.id}` as const : undefined;
  const choice = moment?.options?.find(option => option.id === run?.choices[moment.id]);
  const advance = (choice?: string) => { if (moment) onAction({ type: 'advance', stage: moment.id, ...(choice ? { choice } : {}) }); };
  return <section className="festival-page">
    <header className="v2-page-heading"><button className="icon-button" onClick={onBack} aria-label={backToAlbum ? '返回纪念册' : '返回小窝'}><ArrowLeft /></button><div><p className="eyebrow">{replay ? '重温回忆' : '节日故事'} · {festivalNames[festival]}</p><h2>{script.title}</h2></div></header>
    <article className="festival-story-card">
      {run && <div className="festival-story-meta"><span><Sparkles size={16} />{run.year} · {run.actorName}</span><span>{replay ? `${pageIndex + 1} / ${history.length}` : '开始后可随时继续'}</span></div>}
      {moment?.id === 'ending' && <FestivalArtwork festival={festival} />}
      {!run ? <div className="festival-story-copy"><h3>{script.title}</h3><p>{script.summary}</p>{window && <p>{window.year} 年{festivalNames[festival]}：{window.date}。故事可在 {window.startDate} 至 {window.endDate} 开启。</p>}<p>完成可收藏纪念插画与完整故事，并获得当年一次的 10 张扭蛋券。</p><button className="primary-button" disabled={disabled || !isFestivalOpen(festival, now)} onClick={onStart}>{isFestivalOpen(festival, now) ? '一起开始' : '等节日故事开启'}</button></div> : moment && <>
        <div className="festival-story-copy" aria-live="polite"><h3>{moment.title}</h3>{moment.paragraphs.map((text, index) => <p key={index}>{text}</p>)}{replay && (choice || recipe) && <p className="festival-recorded-choice"><Sparkles size={16} />那时的选择：{choice?.label ?? `留了一份${recipe!.name}`}</p>}</div>
        {replay ? <nav className="festival-replay-controls" aria-label="回忆翻页"><button className="secondary-button" disabled={pageIndex <= 0} onClick={() => setPage(pageIndex - 1)}><ArrowLeft size={17} />上一页</button>{pageIndex < history.length - 1 ? <button className="primary-button" onClick={() => setPage(pageIndex + 1)}>下一页<ArrowRight size={17} /></button> : <button className="primary-button" onClick={onBack}><BookOpen size={17} />放回纪念册</button>}</nav> : <div className="festival-story-actions">
          {run.stage === 'complete' ? <div className="festival-complete"><strong><BookOpen size={19} />这一年的回忆，收藏好了</strong>{hasSeasonalReward(pet, run) ? <p><Ticket size={17} />当年奖励 · 10 张扭蛋券已领取</p> : <><p>10 张扭蛋券等你领取；券达到上限时，奖励会一直保留。</p><button className="secondary-button" disabled={blocked || pet.goldenAppleGacha.tickets > 9989} onClick={() => onAction({ type: 'claim' })}>领取 10 张扭蛋券</button></>}<button className="primary-button" onClick={onAlbum}>去纪念册重温</button></div>
            : moment.options ? <div className={moment.options.every(option => option.recipe) ? 'festival-flavours' : 'festival-choices'}>{moment.options.map(option => <button className="secondary-button" key={option.id} disabled={disabled} onClick={() => advance(option.id)}>{option.recipe && <img src={dishImages[option.recipe]} alt="" />}<span>{option.label}</span></button>)}</div>
              : recipe && dish ? <div className="festival-kitchen-step"><img src={dishImages[recipe.id]} alt="" /><div><strong>{recipe.name}</strong><p>背包里有 {pet.inventory[dish] ?? 0} 份；留在餐桌上会消耗 1 份。</p><div className="festival-button-row"><button className="secondary-button" disabled={disabled} onClick={() => onKitchen(recipe.id)}><ChefHat size={18} />去厨房准备</button><button className="primary-button" disabled={disabled || (pet.inventory[dish] ?? 0) < 1} onClick={() => advance()}>留一份，继续故事</button></div></div></div>
                : <button className="primary-button" disabled={disabled} onClick={() => advance()}>{moment.id === 'ending' ? '把这一段收入纪念册' : '继续'}<ArrowRight size={17} /></button>}
        </div>}
      </>}
      {!replay && busy && run?.stage !== 'complete' && <p className="festival-busy" role="status">等伙伴睡醒或忙完，再一起继续。进度已经留好了。</p>}
      {!replay && blocked && <p className="festival-busy" role="status">请先处理存档提示，再继续故事。</p>}
    </article>
  </section>;
};
