import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChefHat, Moon, Sparkles, Ticket } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import type { RecipeId } from '../core/companionActivityTypes';
import { activityText as L } from '../core/kitchenRecipes';
import { canSpendCompanionTime } from '../core/kitchen';
import { festivalIds, festivalNames, getMidautumnWindow, isFestivalOpen, isMidautumnOpen, type FestivalId } from '../core/festivalCalendar';
import { getActiveFestivalRun, getFestivalMemories, getMidautumnHistory, hasMidautumnReward, midautumnDish, midautumnRecipe, midautumnTitle, mooncakeOptions, moonlightSettings, moonlightWishes, storyText, type MidautumnAction, type MidautumnRun, type MooncakeFlavour, type MoonlightSetting, type MoonlightWish } from '../core/festivalStories';
import { FestivalArtwork, festivalTitle } from './FestivalArtwork';
import midautumnCg from '../assets/story/midautumn-moonlight.webp';
import nutsMooncake from '../assets/icon/item_dish_mooncake_mixed_nuts.png';
import beanMooncake from '../assets/icon/item_dish_mooncake_red_bean.png';

const dateLabel = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return L(`${year} 年 ${month} 月 ${day} 日`, `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
};
const MoonlightArtwork = () => <img className="festival-cg" src={midautumnCg} width={1920} height={1080} alt={L('月夜窗边，两杯茶和一盘月饼，留住一起赏月的夜晚', 'Two cups of tea and mooncakes beside a moonlit window')} />;

export const FestivalEntry = ({ pet, onOpen, now = Date.now() }: { pet: PetState; onOpen: (festival: FestivalId) => void; now?: number }) => {
  const festivals = festivalIds.filter(festival => isFestivalOpen(festival, now));
  if (!festivals.length) return null;
  return <>{festivals.map(festival => {
    const active = getActiveFestivalRun(pet, festival);
    const run = active ?? pet.festivalStories.runs[`${festival}:${new Date(now).getFullYear()}`];
    const subtitle = active ? active.stage === 'complete' ? '十张扭蛋券待领取' : `继续 ${active.year} 年的故事`
      : run?.stage === 'complete' ? '这一年的回忆已收藏' : '节日到了，一起留下一段回忆';
    return <button key={festival} className="festival-entry" data-festival={festival} onClick={() => onOpen(festival)}><span className="festival-entry-moon"><Sparkles size={24} /></span><span><small>{festivalNames[festival]}</small><strong>{festivalTitle(festival)}</strong><span>{subtitle}</span></span><ArrowRight size={19} /></button>;
  })}</>;
};

export const FestivalMemories = ({ pet, onReplay, onContinue }: { pet: PetState; onReplay: (id: string) => void; onContinue?: (id: string) => void }) => {
  const memories = getFestivalMemories(pet);
  const pending = onContinue ? festivalIds.flatMap(festival => {
    const run = getActiveFestivalRun(pet, festival);
    return run ? [run] : [];
  }) : [];
  return <section className="v2-card festival-memories">
    <h3><Moon size={19} />{L('节日回忆', 'Seasonal memories')}</h3>
    {pending.length > 0 && <div className="festival-pending">{pending.map(run => <button key={run.id} className="festival-memory-row" onClick={() => onContinue?.(run.id)}><span><strong>{festivalTitle(run.festival)}</strong><small>{run.year} · {run.actorName} · {run.stage === 'complete' ? '奖励待领取' : '继续还没讲完的故事'}</small></span><ArrowRight size={19} /></button>)}</div>}
    {memories.length ? festivalIds.map(festival => {
      const runs = memories.filter(run => run.festival === festival);
      return runs.length ? <div className="festival-memory-group" key={festival}><FestivalArtwork festival={festival} /><h4>{festivalTitle(festival)}</h4>{runs.map(run => <button key={run.id} className="festival-memory-row" onClick={() => onReplay(run.id)}><span><strong>{run.year} · {run.actorName}</strong><small>{run.festival === 'midautumn' && run.flavour ? `${storyText(mooncakeOptions[run.flavour])} · ` : ''}{L('重温完整故事', 'Replay the full story')}</small></span><BookOpen size={19} /></button>)}</div> : null;
    }) : <p>{L('完成节日故事后，插画和你们当时的选择会一起留在这里。', 'Complete a seasonal story to keep its artwork and the choices you made together here.')}</p>}
  </section>;
};

interface StoryProps {
  pet: PetState;
  run?: MidautumnRun;
  replay?: boolean;
  backToAlbum?: boolean;
  blocked?: boolean;
  now?: number;
  onStart: () => void;
  onAction: (action: MidautumnAction) => void;
  onKitchen: (recipe: RecipeId) => void;
  onBack: () => void;
  onAlbum: () => void;
}

export const FestivalStoryPage = ({ pet, run, replay = false, backToAlbum = replay, blocked = false, now = Date.now(), onStart, onAction, onKitchen, onBack, onAlbum }: StoryProps) => {
  const [page, setPage] = useState(0);
  const year = run?.year ?? new Date(now).getFullYear();
  const window = getMidautumnWindow(year);
  const history = useMemo(() => run ? getMidautumnHistory(run) : [], [run]);
  const moment = history[replay ? Math.min(page, history.length - 1) : history.length - 1];
  const busy = !canSpendCompanionTime(pet);
  const disabled = blocked || busy;
  const showCg = moment?.id === 'ending';
  return <section className="festival-page">
    <header className="v2-page-heading">
      <button className="icon-button" onClick={onBack} aria-label={backToAlbum ? L('返回纪念册', 'Back to album') : '返回小窝'}><ArrowLeft /></button>
      <div><p className="eyebrow">{replay ? L('重温 · 中秋回忆', 'REVISITING MID-AUTUMN') : L('中秋 · 节日故事', 'A MID-AUTUMN STORY')}</p><h2>{storyText(midautumnTitle)}</h2></div>
    </header>
    <article className="festival-story-card">
      {run && <div className="festival-story-meta"><span><Moon size={16} />{year} · {run.actorName}</span><span>{replay ? `${page + 1} / ${history.length}` : L('开始后可随时继续', 'Continue whenever you like')}</span></div>}
      {showCg && <MoonlightArtwork />}
      {!run ? <div className="festival-story-copy">
        <div className="festival-welcome"><Moon size={40} /><Sparkles size={19} /></div>
        <h3>{L('留一个晚上，和月亮见面', 'An evening with the moon')}</h3>
        <p>{L('选一种喜欢的月饼，在厨房慢慢做好，陪伙伴等一轮月亮，再说一个不用很大的愿望。', 'Choose a mooncake, prepare it in the kitchen, wait for the moon together, and make a wish that can be small.')}</p>
        {window && <p>{L(`今年中秋：${dateLabel(window.date)}。故事可在 ${dateLabel(window.startDate)} 至 ${dateLabel(window.endDate)} 开启，开始后不必赶时间。`, `Mid-Autumn falls on ${dateLabel(window.date)}. Start between ${dateLabel(window.startDate)} and ${dateLabel(window.endDate)}, then continue at your own pace.`)}</p>}
        <p className="festival-note">{L('完成可收藏纪念插画与完整故事，并获得当年一次的 10 张扭蛋券。', 'Keep the artwork and full story, plus ten tickets once each year.')}</p>
        {!replay && <button className="primary-button" disabled={!isMidautumnOpen(now) || disabled} onClick={onStart}>{isMidautumnOpen(now) ? L('一起准备中秋', 'Plan our evening') : L('等中秋故事开启', 'The story opens soon')}</button>}
      </div> : moment && <>
        <div className="festival-story-copy" aria-live="polite">
          <h3>{storyText(moment.title)}</h3>
          {moment.paragraphs.map((text, index) => <p key={index}>{storyText(text)}</p>)}
          {replay && moment.choice && <p className="festival-recorded-choice"><Sparkles size={16} />{L('那时的选择：', 'Your choice then: ')}{storyText(moment.choice)}</p>}
        </div>
        {replay ? <nav className="festival-replay-controls" aria-label={L('回忆翻页', 'Memory pages')}>
          <button className="secondary-button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ArrowLeft size={17} />{L('上一页', 'Previous')}</button>
          {page < history.length - 1 ? <button className="primary-button" onClick={() => setPage((current) => current + 1)}>{L('下一页', 'Next')}<ArrowRight size={17} /></button> : <button className="primary-button" onClick={onBack}><BookOpen size={17} />{L('放回纪念册', 'Back to the album')}</button>}
        </nav> : <div className="festival-story-actions">
          {run.stage === 'flavour' && <div className="festival-flavours">{(['nuts', 'bean'] as MooncakeFlavour[]).map((value) => <button key={value} disabled={disabled} onClick={() => onAction({ type: 'flavour', value })}><img src={value === 'nuts' ? nutsMooncake : beanMooncake} alt="" /><strong>{storyText(mooncakeOptions[value])}</strong><span>{value === 'nuts' ? L('果仁香脆，慢慢嚼', 'Nutty, with a little crunch') : L('细软香甜，配热茶', 'Soft and sweet, lovely with tea')}</span></button>)}</div>}
          {run.stage === 'prepare' && run.flavour && <div className="festival-kitchen-step">
            <img src={run.flavour === 'nuts' ? nutsMooncake : beanMooncake} alt="" />
            <div><strong>{storyText(mooncakeOptions[run.flavour])}</strong><p>{L(`背包里有 ${pet.inventory[midautumnDish(run.flavour)] ?? 0} 份；摆上餐桌会消耗 1 份。`, `${pet.inventory[midautumnDish(run.flavour)] ?? 0} in your inventory. Setting the table uses one.`)}</p>
              {!pet.kitchen.equipment.includes('oven') && <p>{L('小烤箱需要先做过 5 种料理，再到厨房添置；故事进度会一直保留。', 'Make five different recipes to buy the small oven in the kitchen. Your story will wait for you.')}</p>}
              <div className="festival-button-row"><button className="secondary-button" disabled={disabled} onClick={() => onKitchen(midautumnRecipe(run.flavour!))}><ChefHat size={18} />{L('去厨房做月饼', 'Make a mooncake')}</button><button className="primary-button" disabled={disabled || (pet.inventory[midautumnDish(run.flavour)] ?? 0) < 1} onClick={() => onAction({ type: 'serve' })}>{L('摆上月饼，准备赏月', 'Set our mooncake on the table')}</button></div>
            </div>
          </div>}
          {run.stage === 'setting' && <div className="festival-choices">{(Object.keys(moonlightSettings) as MoonlightSetting[]).map((value) => <button className="secondary-button" key={value} disabled={disabled} onClick={() => onAction({ type: 'setting', value })}>{storyText(moonlightSettings[value])}<ArrowRight size={17} /></button>)}</div>}
          {run.stage === 'wish' && <div className="festival-choices">{(Object.keys(moonlightWishes) as MoonlightWish[]).map((value) => <button className="secondary-button" key={value} disabled={disabled} onClick={() => onAction({ type: 'wish', value })}>{storyText(moonlightWishes[value])}<ArrowRight size={17} /></button>)}</div>}
          {run.stage === 'ending' && <button className="primary-button" disabled={disabled} onClick={() => onAction({ type: 'finish' })}><BookOpen size={18} />{L('把这一晚收入纪念册', 'Keep this evening in our album')}</button>}
          {run.stage === 'complete' && <div className="festival-complete">
            <strong><BookOpen size={19} />{L('这一年的月光，收藏好了', 'This year’s moonlight is safe in our album')}</strong>
            {hasMidautumnReward(pet, run) ? <p><Ticket size={17} />{L('当年奖励 · 10 张扭蛋券已领取', 'This year’s reward · ten tickets received')}</p> : <><p>{L('10 张扭蛋券等你领取；券达到上限时，奖励会一直保留。', 'Ten tickets are waiting. If your tickets are full, the reward will wait.')}</p><button className="secondary-button" disabled={blocked || pet.goldenAppleGacha.tickets > 9989} onClick={() => onAction({ type: 'claim' })}>{L('领取 10 张扭蛋券', 'Claim ten tickets')}</button></>}
            <button className="primary-button" onClick={onAlbum}><BookOpen size={18} />{L('去纪念册重温', 'Revisit it in the album')}</button>
          </div>}
        </div>}
      </>}
      {!replay && busy && run?.stage !== 'complete' && <p className="festival-busy" role="status">{L('等伙伴睡醒或忙完，再一起继续。进度已经留好了。', 'Continue when your companion is awake and free. Your progress is safe.')}</p>}
      {!replay && blocked && <p className="festival-busy" role="status">{L('请先处理存档提示，再继续故事。', 'Please resolve the save notice before continuing.')}</p>}
    </article>
  </section>;
};
