import { useState } from 'react';
import { Coins } from 'lucide-react';
import { deliverCommunityOrder } from '../../core/community';
import { acceptCommunityTask, cancelCommunityTask, canClaimCommunityTask, claimCommunityTask, commissionDefinitions, getCommunityCandidates, getCommunityDay, getCommunityTasks } from '../../core/communityCommissions';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { CommunityTask, CommissionTemplate, WaterId } from '../../core/communityTypes';
import type { BuiltinItemId, ItemId } from '../../core/petTypes';
import { getInventoryItem } from '../../core/items';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import type { CommunityPanelProps } from './types';
import { CommunitySpecialtyOrders } from './CommunitySpecialtyOrders';
import { specialtyDay } from '../../core/communitySpecialtyOrders';
import { itemIcons } from '../../assets';
import { CommunityBoardNote } from './CommunityBoardNote';
import { HelpButton } from '../help/HelpButton';
import { landmarkNames, mapRegionForExpedition, regionNames } from '../../core/landmarkProgress';
import { communityOrdersHelp } from '../help/workHelp';
import { CommunityActivities } from './CommunityActivities';

const noteArt: Partial<Record<CommissionTemplate, { item: BuiltinItemId; tone: string; summary: string }>> = {
  valley_basket: { item: 'valley_mushroom', tone: 'mint', summary: '送野菇 ×3' }, valley_rice: { item: 'dish_mushroom_rice', tone: 'cream', summary: '送野菇焖饭 ×1' },
  forest_delicacy: { item: 'matsutake', tone: 'cream', summary: '送松茸 ×1' }, tea_order: { item: 'mountain_tea', tone: 'mint', summary: '送高山茶叶 ×1' },
  search: { item: 'survey_lens', tone: 'blue', summary: '寻找旧桥工具包' }, forage: { item: 'creek_herb', tone: 'mint', summary: '新采一束野香草' },
  vegetables: { item: 'carrot', tone: 'peach', summary: '送胡萝卜 ×2' }, eggs: { item: 'egg', tone: 'cream', summary: '送鸡蛋 ×2' }, milk: { item: 'farm_milk', tone: 'blue', summary: '送牧场鲜奶 ×2' },
  fish_pond: { item: 'pond_crucian', tone: 'blue', summary: '钓一条池塘普通鱼' }, fish_upstream: { item: 'stream_trout', tone: 'mint', summary: '钓一条上游普通鱼' },
  soup: { item: 'dish_creek_fish_soup', tone: 'peach', summary: '送香草鲜鱼汤 ×1' }, fresh_porridge: { item: 'dish_herb_porridge', tone: 'cream', summary: '新煮一份香草暖粥' }, delivery: { item: 'bento', tone: 'pink', summary: '给旧桥守望者送餐' },
};

export const CommunityBoard = (props: CommunityPanelProps & { actorId: string; actorName: string; onFishing: (water?: WaterId) => void; onFarm?: (place: 'field' | 'coop' | 'barn') => void }) => {
  const { pet, update, onExplore, onKitchen, onFishing, onFarm, registry, onOpenOutpost, itemIconMap } = props;
  const [selected, setSelected] = useState<string | null>(null);
  const tasks = getCommunityTasks(pet), candidates = getCommunityCandidates(pet), day = getCommunityDay(pet), accepted = pet.community.boardDay === day ? pet.community.acceptedToday : [];
  const notes = [...tasks, ...candidates.filter(task => !tasks.some(active => active.id === task.id))];
  const selectedTask = notes.find(task => task.id === selected);
  const free = canSpendCompanionTime(pet), warmDone = pet.community.firstOrderDelivered;
  const specialtyUsed = pet.community.specialtyOrders.acceptedDay >= specialtyDay(pet);
  const icon = (id: BuiltinItemId) => itemIconMap?.[id] ?? itemIcons[id];
  const art = (task: CommunityTask) => noteArt[task.template] ?? { item: (Object.keys(commissionDefinitions[task.template].take ?? {})[0] ?? (commissionDefinitions[task.template].deliveryItem ? 'bento' : 'survey_lens')) as BuiltinItemId, tone: 'mint', summary: commissionDefinitions[task.template].name };
  const close = () => setSelected(null);
  const details = (task: CommunityTask) => {
    const active = tasks.some(value => value.id === task.id);
    const def = commissionDefinitions[task.template], used = accepted.includes(task.id), sameKind = tasks.some(t => t.template === task.template);
    return <CommunityDetailDialog title={def.name} eyebrow={active ? '已接取 · 不过期' : used ? '今日已接过' : '今日候选'} onClose={close}>
      <div className="community-letter"><img className="community-letter-item" src={icon(art(task).item)} alt="" /><p>{def.detail}</p><p className="community-letter-reward"><Coins size={16} />酬谢：{task.rewardCoins ?? def.coins} 金币{def.reward ? ' · 木料 ×1 · 石料 ×1' : ''}</p></div>
      <p>地点：{def.region ? regionNames[mapRegionForExpedition[def.region]] + (def.node ? '／' + landmarkNames[mapRegionForExpedition[def.region]][def.node] : '') : def.water ? '钓鱼小屋／对应水域' : '社区'} · {def.event ? '必须记录接取后的行动' : '接受库存'}</p>
      <p>交付数量：{def.deliveryItem ? '行囊便当 ×1（现场扣除）' : def.take ? Object.entries(def.take).map(([id, n]) => (registry?.get(id)?.name ?? getInventoryItem(id as ItemId)?.name ?? id) + ' ×' + n).join('、') : '只记录行动，不扣物品'}</p>
      {active ? <>
        {def.event && <p className="community-note">{task.found ? '✓ 已记录有效行动' : '○ 等待接取后的有效行动'}</p>}
        {Object.entries(def.take ?? {}).map(([id, n]) => <p key={id}>交付 {registry?.get(id)?.name ?? getInventoryItem(id as ItemId)?.name ?? id} ×{n} · 持有 {pet.inventory[id] ?? 0}</p>)}
        <div className="community-actions">
          {def.region && def.node && onOpenOutpost && <button className="secondary-button" onClick={() => onOpenOutpost({ view: 'manual', region: def.region!, node: def.node, target: Object.keys(def.take ?? {})[0] })}>前往目标地标</button>}
          {def.recipe && <button className="secondary-button" onClick={() => onKitchen(def.recipe)}>去厨房制作</button>}
          <button className="primary-button" disabled={!canClaimCommunityTask(pet, task) || Boolean(pet.adventure.active || pet.community.expedition.active || pet.community.fishing.active)} onClick={() => { update(p => claimCommunityTask(p, task.id)); close(); }}>交付并领取酬谢</button>
          {!task.found && task.template.startsWith('fish_') && <button className="secondary-button" onClick={() => onFishing(def.water)}>去对应水域钓鱼</button>}
          {onFarm && ['vegetables', 'eggs', 'milk'].includes(task.template) && <button className="secondary-button" onClick={() => task.template === 'eggs' && !pet.community.facilities.coop.built || task.template === 'milk' && !pet.community.facilities.barn.built ? props.onShop() : onFarm(task.template === 'eggs' ? 'coop' : task.template === 'milk' ? 'barn' : 'field')}>去生产地点</button>}
        </div>
        <details className="community-abandon"><summary>放弃这份委托</summary><p>已接取额度不会退还，已消耗的送达物不会返还。</p><button className="text-button" onClick={() => { update(p => cancelCommunityTask(p, task.id)); close(); }}>确认放弃</button></details>
      </> : <button className="primary-button" disabled={used || accepted.length >= 2 || tasks.length >= 2 || sameKind} onClick={() => { update(p => acceptCommunityTask(p, task.id)); close(); }}>{used ? '今天已接取，明日再来' : sameKind ? '先完成同类在途委托' : accepted.length >= 2 ? '今日已接满 2 单' : tasks.length >= 2 ? '先完成手上的 2 单' : '接下这份委托'}</button>}
    </CommunityDetailDialog>;
  };
  return <>
    <CommunityActivities {...props} />
    <section className="community-noticeboard" aria-label="邻里公告板">
      <header className="community-noticeboard-heading"><div><small>溪畔来信 · 留一点时间给邻居</small><h3>今天，帮一点小忙</h3></div><span><span>今日已接 · 委托 {accepted.length}/2 · 收购 {Number(specialtyUsed)}/1</span><span>进行中 · 委托 {tasks.length}/2 · 收购 {Number(Boolean(pet.community.specialtyOrders.active))}/1</span></span></header>
      <div className="community-pinned-notes">
        <CommunitySpecialtyOrders {...props} selected={selected} onSelect={setSelected} onClose={close} />
        <CommunityBoardNote summary={warmDone ? '修渠邻居的感谢信' : '给修渠邻居送暖粥'} label={warmDone ? '故事 · 已送达' : '常驻故事'}
          art={<img src={icon('dish_herb_porridge')} alt="" />} tone="pink" onClick={() => setSelected('warm-order')} />
        {notes.map(task => {
          const active = tasks.some(value => value.id === task.id), used = accepted.includes(task.id);
          const ready = active && canClaimCommunityTask(pet, task);
          return <CommunityBoardNote key={task.id} summary={art(task).summary}
            label={`委托 · ${ready ? '可交付' : active ? '进行中' : used ? '今日已接' : '待接取'}`}
            art={<img src={icon(art(task).item)} alt="" />} tone={art(task).tone}
            active={active} ready={ready} onClick={() => setSelected(task.id)} />;
        })}
        {!candidates.length && <div className="community-board-memo"><span aria-hidden="true">✎</span><p>完成踩点教学后，邻居们就会把委托贴在这里。</p></div>}
      </div>
      <footer className="community-noticeboard-footer"><span>轻点纸条，读读邻居的留言</span><HelpButton {...communityOrdersHelp} /></footer>
    </section>
    {selectedTask && details(selectedTask)}
    {selected === 'warm-order' && <CommunityDetailDialog title="给修渠邻居的一碗暖粥" eyebrow={warmDone ? '心意已送达' : '常驻故事 · 慢慢来，不会过期'} onClose={close}>
      <div className="community-letter"><img className="community-letter-item" src={icon('dish_herb_porridge')} alt="" /><p>{warmDone ? '邻居把空碗洗得干干净净。溪谷带回的种子，已经成了大家日常的一部分。' : '修好菜地，把第一份香草做成暖粥，感谢一起修渠的邻居。'}</p><p className="community-letter-reward">首次酬谢：80 金币 · 5 小心心 · 体力上限 +3</p></div>
      {!warmDone && <><p>菜地开放后交付暖粥 ×1，可用已有料理。持有 {pet.inventory.dish_herb_porridge ?? 0} 份。</p><div className="community-actions"><button className="primary-button" disabled={!free || !pet.community.gardenBuilt || !(pet.inventory.dish_herb_porridge ?? 0)} onClick={() => { update(deliverCommunityOrder); close(); }}>交付暖粥</button><button className="secondary-button" disabled={!free || !pet.community.herbDiscovered} onClick={() => onKitchen('herb_porridge')}>去厨房做暖粥</button></div></>}
    </CommunityDetailDialog>}
  </>;
};
