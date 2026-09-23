import { useState } from 'react';
import { CalendarDays, Check, Gift, Heart, Sparkles } from 'lucide-react';
import { projectIds } from '../../core/expeditionData';
import { communityProjects, communityGiftPool, getCommunityGiftItems, projectThemes, type ProjectTheme } from '../../core/communityProjectData';
import { getCommunityActivityBoard, getProjectThemeReason } from '../../core/communityActivities';
import { startCommunityProject, contributeCommunityProject, finishCommunityProject, claimCommunityProjectReward, getProjectReason, getProjectRunId, getProjectContributionReason, getProjectRewardReason } from '../../core/communityProjectActions';
import { getExplorationSource } from '../../core/explorationSources';
import { getInventoryItem } from '../../core/items';
import { fish } from '../../core/communityData';
import type { ProjectId } from '../../core/expeditionTypes';
import type { Inventory, ItemId } from '../../core/petTypes';
import type { RecipeId } from '../../core/companionActivityTypes';
import type { CommunityPanelProps } from './types';
import type { WaterId } from '../../core/communityTypes';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import { CommunityMemory } from './CommunityMemories';
import '../../styles/community-activities.css';

type Props = CommunityPanelProps & { actorId: string; actorName: string; onFishing: (water?: WaterId) => void; onFarm?: (place: 'field' | 'coop' | 'barn') => void };
const steps = ['准备物资', '准备料理', '布置并举办'];
const itemName = (id: string) => getInventoryItem(id as ItemId)?.name ?? id;
const inventoryText = (items: Inventory) => Object.entries(items).map(([id, n]) => `${itemName(id)} ×${n}`).join('、');

export const CommunityActivities = (props: Props) => {
  const { pet } = props;
  const [selected, setSelected] = useState<ProjectId | null>(null);
  const board = getCommunityActivityBoard(pet);
  const active = projectIds.filter(id => pet.community.expedition.projects[id].theme || pet.community.expedition.projects[id].reward);
  return <section className="community-activities" aria-label="社区活动邀请">
    <header><div><small><CalendarDays size={15} />每周一 05:00 更新</small><h3>本周社区活动</h3></div><span>独立邀请 · 接下后不过期</span></header>
    <p>在已经开放的活动中轮换，每轮邀请可接一次；不会占用每日委托或特产收购名额。</p>
    {board.project ? <button className="community-activity-invitation" onClick={() => setSelected(board.project!)}><span className="community-activity-symbol"><Sparkles size={27} /></span><span><small>{board.accepted ? '本周邀请已接取' : '邻居们的新邀请'}</small><strong>{communityProjects[board.project].name}</strong><span><Heart size={14} />{communityProjects[board.project].hearts} 小心心起 · 随机高价值回礼</span></span><span>查看邀请 →</span></button> : <p className="community-note">完成活动条件后，邻居会在这里留下第一封邀请。</p>}
    {active.length > 0 && <div className="community-activity-pinned"><h4>已经接下的约定</h4>{active.map(id => {
      const p = pet.community.expedition.projects[id];
      return <button key={id} onClick={() => setSelected(id)}><span><strong>{communityProjects[id].name}</strong><small>{p.reward ? '已经举办 · 邻居回礼待领取' : `${steps[p.stage]} · 已完成 ${p.stage}/3 步`}</small></span>{p.reward ? <Gift size={20} /> : p.stage === 2 ? <Check size={20} /> : <span>继续 →</span>}</button>;
    })}</div>}
    <details className="community-activity-rules"><summary>活动条件与以后能参加的邀请</summary>{projectIds.map(id => <div key={id}><h4>{communityProjects[id].name}</h4>{projectThemes.map((theme, i) => <p key={theme}>{communityProjects[id].themes[i]}：{getProjectThemeReason(pet, id, theme) || '已开放，等待轮到这项活动'}</p>)}</div>)}</details>
    {selected && <ActivityDetails key={selected} {...props} id={selected} onClose={() => setSelected(null)} />}
  </section>;
};

const ActivityDetails = ({ id, onClose, ...props }: Props & { id: ProjectId; onClose: () => void }) => {
  const { pet, update, actorId, actorName } = props;
  const [chosen, setChosen] = useState<ProjectTheme>(() => projectThemes.find(theme => !getProjectThemeReason(pet, id, theme)) ?? 'garden');
  const [claimed, setClaimed] = useState(false);
  const p = pet.community.expedition.projects[id], data = communityProjects[id], board = getCommunityActivityBoard(pet);
  const theme = p.theme ?? chosen, index = theme === 'journey' ? 1 : 0;
  const startReason = getProjectReason(pet, id, theme), contributionReason = getProjectContributionReason(pet, id);
  const runId = getProjectRunId(pet, id), reward = p.reward, rewardReason = getProjectRewardReason(pet, id);
  const sourceLinks = (item: string) => {
    if (item.startsWith('dish_')) return <button className="text-button" onClick={() => props.onKitchen(item.slice(5) as RecipeId)}>去厨房制作</button>;
    const water = fish[item as keyof typeof fish]?.water;
    if (water) return <button className="text-button" onClick={() => props.onFishing(water)}>去对应水域钓鱼</button>;
    if (item === 'carrot' || item === 'egg') return <>{props.onFarm && <button className="text-button" onClick={() => props.onFarm?.(item === 'carrot' ? 'field' : 'coop')}>{item === 'carrot' ? '去菜地' : '去鸡舍'}</button>}<button className="text-button" onClick={props.onShop}>商店补充</button></>;
    const source = getExplorationSource(pet, item);
    return source && props.onOpenOutpost ? <button className="text-button" onClick={() => props.onOpenOutpost?.({ view: 'manual', ...source })}>去探索采集</button> : null;
  };
  const items = (inventory: Inventory, delivered: boolean) => <ul className="community-activity-materials">{Object.entries(inventory).map(([item, n]) => <li key={item}><span>{itemName(item)} ×{n}<small>{delivered ? '已交付，不再扣除' : `持有 ${pet.inventory[item] ?? 0} · ${(pet.inventory[item] ?? 0) >= n ? '已备齐' : `还差 ${n - (pet.inventory[item] ?? 0)}`}`}</small></span>{!delivered && <span className="community-activity-sources">{sourceLinks(item)}</span>}</li>)}</ul>;
  return <CommunityDetailDialog title={data.name} eyebrow={reward ? '活动圆满完成 · 邻居回礼' : p.theme ? '已经接下 · 跨周继续' : '本周社区活动邀请'} onClose={onClose}>
    {reward || claimed ? <>
      <CommunityMemory pet={pet} id={id} />
      {reward ? <section className="community-activity-reward"><h3><Gift size={20} />{communityGiftPool.find(entry => entry.kind === reward.gift)?.name}</h3><p>这一次和 {reward.actorName} 一起，邻居们送来了：</p><p><Heart size={17} /><b>{reward.hearts} 小心心</b>{reward.first && '（含首次纪念奖励）'}</p><p>{inventoryText(reward.items)}</p>{reward.first && <p>首次回忆已收藏 · 体力上限永久 +3</p>}<button className="primary-button" disabled={Boolean(rewardReason)} onClick={() => { update(current => claimCommunityProjectReward(current, id, reward.id)); setClaimed(true); }}>领取邻居回礼</button>{rewardReason && <p className="community-note">{rewardReason}</p>}</section> : <p className="community-note" role="status">邻居回礼已领取，回忆已经放进纪念册。</p>}
    </> : <>
      <p>{data.description}</p>
      <div className="community-activity-themes" aria-label="活动主题">{projectThemes.map((t, i) => <button className="secondary-button" key={t} aria-pressed={theme === t} disabled={Boolean(p.theme)} onClick={() => setChosen(t)}>{data.themes[i]}</button>)}</div>
      {!p.theme && <p className="community-note">{getProjectThemeReason(pet, id, theme) || '这个主题已经开放，可以准备。'}</p>}
      <ol className="community-activity-steps">{[data.supplies[index], data.meals[index], {}].map((stock, step) => <li key={step} data-done={Boolean(p.theme && p.stage > step)}><h4>{p.theme && p.stage > step ? '✓' : step + 1} · {steps[step]}</h4>{step < 2 ? items(stock, Boolean(p.theme && p.stage > step)) : <p>饱食 −4 · 体力 −4；伙伴空闲且物资交齐后，随时举办，无需计时。</p>}</li>)}</ol>
      <section className="community-activity-reward"><h4><Heart size={17} />每次 {data.hearts} 小心心＋一份邻居礼盒</h4>{!p.completed && <p>首次另有 {data.hearts} 小心心、体力上限 +3 与纪念 CG。</p>}<ul>{communityGiftPool.map(gift => <li key={gift.kind}>{gift.chance}% · {inventoryText(getCommunityGiftItems(id, gift.kind))}</li>)}</ul><small>每份礼盒都有回礼。举办时确定内容，仓库满时会留待领取。</small></section>
      {p.theme ? <><button className="primary-button" disabled={Boolean(contributionReason)} onClick={() => update(current => p.stage === 2 ? finishCommunityProject(current, id, runId, actorId, actorName) : contributeCommunityProject(current, id, runId, p.stage))}>{p.stage === 2 ? '邀请邻居，布置并举办' : `交付${p.stage === 0 ? '物资' : '料理'}`}</button>{contributionReason && <p className="community-note">{contributionReason}</p>}</> : <><button className="primary-button" disabled={Boolean(startReason) || !board.invitationId} onClick={() => update(current => startCommunityProject(current, id, theme, board.invitationId!))}>选定主题，接下邀请</button>{startReason && <p className="community-note">{startReason}</p>}</>}
      <p className="community-note">接下后主题固定，每阶段整份交付；进度跨周保留，不占每日委托额度。</p>
    </>}
    <p className="community-event" role="status">{pet.recentEvent}</p>
  </CommunityDetailDialog>;
};
