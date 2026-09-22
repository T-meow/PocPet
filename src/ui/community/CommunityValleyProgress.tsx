import type { CommunityPanelProps } from './types';
import type { CommunityPlace } from '../CommunityPage';
import { ExplorationBudgetCard } from '../expedition/ExplorationBudgetCard';
import { mainStoryProgress, regionNames } from '../../core/landmarkProgress';

export const CommunityValleyProgress = ({ pet, onExplore, onKitchen, onOpenOutpost, onAdventure, onOpen }: CommunityPanelProps & { onAdventure: () => void; onOpen: (place: CommunityPlace) => void }) => {
  const c = pet.community, story = mainStoryProgress(pet.adventure), next = story.next[0];
  const steps = [
    { title: '五地图主线', done: story.completed === 40, detail: `${story.completed}/40 地标 · ${next ? regionNames[next.region] + '／' + next.name : story.completed === 40 ? '全部章节已完成' : '完成并结算新手关'}`, label: next ? '前往下一地标' : '查看地图', action: () => next ? onExplore(next.id) : onAdventure() },
    { title: '让菜地开始生产', done: c.gardenBuilt, detail: c.gardenBuilt ? `已开放 ${c.plots.length} 块菜地，种子来自商店或探索` : '完成并结算新手踩点，免费开放第 1 块菜地', label: c.gardenBuilt ? '去菜地' : '去踩点', action: () => c.gardenBuilt ? onOpen('field') : onAdventure() },
    { title: '做一份溪谷料理', done: Boolean(pet.kitchen.made.herb_porridge || pet.kitchen.made.mushroom_rice), detail: '香草暖粥从第一段故事接入，野菇焖饭在温室故事后开放', label: '做香草暖粥', action: () => onKitchen('herb_porridge') },
    { title: '送出第一碗暖粥', done: c.firstOrderDelivered, detail: '交付暖粥 ×1，领取常驻故事酬谢与永久成长', label: '去交付暖粥', action: () => onOpen('board') },
    { title: '完成一次日常委托', done: c.commissionsCompleted + c.specialtyOrders.completed > 0, detail: `邻里交单 ${c.commissionsCompleted} 次 · 特产收购 ${c.specialtyOrders.completed} 次`, label: '看看邻里委托', action: () => onOpen('board') },
    { title: '修好温室休息间', done: c.expedition.regions.valley.base >= 1, detail: `基地 ${c.expedition.regions.valley.base}/2 级 · 溪谷全部地标完成后建设，开放 2／4／8 小时挂机`, label: '去修基地', action: () => onOpenOutpost?.({ view: 'camp', region: 'valley' }) },
    { title: '完成一次挂机探索', done: (c.expedition.loop?.idleCompleted ?? 0) > 0, detail: '预留口粮与机会，让伙伴把材料和酬谢带回来', label: '安排探索', action: () => onOpenOutpost?.({ view: 'idle', region: 'valley', target: 'valley_mushroom' }) },
    { title: '留下溪谷收藏', done: c.decorations.includes('creek_fountain'), detail: `海蓝宝勘探 ${(c.treasureResearch.creek_aquamarine ?? 0) % 6}/6 · 海蓝宝 1、石料 3 制作溪光水景`, label: '去溪谷勘探', action: () => onOpenOutpost?.({ view: 'manual', region: 'valley', target: 'aquamarine' }) },
  ];
  return <><section className="community-card valley-progress"><h3>溪谷生活进度</h3><p>已完成 {steps.filter(s => s.done).length}/{steps.length} 项 · 采集、生产、交单与收藏</p><progress aria-label="溪谷生活循环进度" max={steps.length} value={steps.filter(s => s.done).length} />
    <ol>{steps.map(step => <li key={step.title} data-done={step.done}><span aria-label={step.done ? '已完成' : '待完成'}>{step.done ? '✓' : '○'}</span><div><b>{step.title}</b><p>{step.detail}</p><button className="text-button" onClick={step.action}>{step.label} →</button></div></li>)}</ol>
  </section><ExplorationBudgetCard pet={pet} /></>;
};
