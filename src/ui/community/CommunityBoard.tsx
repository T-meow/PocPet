import { useState } from 'react';
import { ArrowUpRight, Check, Coins, Pin } from 'lucide-react';
import { deliverCommunityOrder } from '../../core/community';
import { acceptCommunityTask, cancelCommunityTask, canClaimCommunityTask, claimCommunityTask, commissionDefinitions, getCommunityCandidates, getCommunityDay, getCommunityTasks } from '../../core/communityCommissions';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { CommunityTask, CommissionTemplate, WaterId } from '../../core/communityTypes';
import type { ItemId } from '../../core/petTypes';
import { getInventoryItem } from '../../core/items';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import type { CommunityPanelProps } from './types';
import { CommunitySpecialtyOrders } from './CommunitySpecialtyOrders';

const noteArt: Record<CommissionTemplate, { glyph: string; tone: string }> = {
  valley_basket: { glyph: '🍄', tone: 'mint' }, valley_rice: { glyph: '🍚', tone: 'cream' },
  forest_delicacy: { glyph: '🍄', tone: 'cream' }, tea_order: { glyph: '🍵', tone: 'mint' },
  search: { glyph: '🧭', tone: 'blue' }, forage: { glyph: '🌿', tone: 'mint' },
  vegetables: { glyph: '🥕', tone: 'peach' }, eggs: { glyph: '🥚', tone: 'cream' }, milk: { glyph: '🥛', tone: 'blue' },
  fish_pond: { glyph: '🐟', tone: 'blue' }, fish_upstream: { glyph: '🎣', tone: 'mint' },
  soup: { glyph: '🍲', tone: 'peach' }, fresh_porridge: { glyph: '🥣', tone: 'cream' }, delivery: { glyph: '🧺', tone: 'pink' },
};

export const CommunityBoard = (props: CommunityPanelProps & { onFishing: (water?: WaterId) => void; onFarm?: (place: 'field' | 'coop' | 'barn') => void }) => {
  const { pet, update, onExplore, onKitchen, onFishing, onFarm, registry, onExpedition } = props;
  const [selected, setSelected] = useState<string | null>(null);
  const tasks = getCommunityTasks(pet), candidates = getCommunityCandidates(pet), day = getCommunityDay(pet), accepted = pet.community.boardDay === day ? pet.community.acceptedToday : [];
  const notes = [...tasks, ...candidates.filter(task => !tasks.some(active => active.id === task.id))];
  const selectedTask = notes.find(task => task.id === selected);
  const free = canSpendCompanionTime(pet), warmDone = pet.community.firstOrderDelivered;
  const close = () => setSelected(null);
  const details = (task: CommunityTask) => {
    const active = tasks.some(value => value.id === task.id);
    const def = commissionDefinitions[task.template], used = accepted.includes(task.id), sameKind = tasks.some(t => t.template === task.template);
    return <CommunityDetailDialog title={def.name} eyebrow={active ? '已接取 · 不过期' : used ? '今日已接过' : '今日候选'} onClose={close}>
      <div className="community-letter"><span className="community-letter-art" aria-hidden="true">{noteArt[task.template].glyph}</span><p>{def.detail}</p><p className="community-letter-reward"><Coins size={16} />酬谢：{def.coins} 金币{def.reward ? ' · 木料 ×1 · 石料 ×1' : ''}</p></div>
      {active ? <>
        {def.event && <p className="community-note">{task.found ? '✓ 已记录有效行动' : '○ 等待接取后的有效行动'}</p>}
        {Object.entries(def.take ?? {}).map(([id, n]) => <p key={id}>交付 {registry?.get(id)?.name ?? getInventoryItem(id as ItemId)?.name ?? id} ×{n} · 持有 {pet.inventory[id] ?? 0}</p>)}
        <div className="community-actions">
          {task.template === 'valley_basket' && onExpedition && <button className="secondary-button" onClick={() => onExpedition('valley_mushroom')}>去溪谷采集野菇</button>}
          {task.template === 'valley_rice' && <button className="secondary-button" onClick={() => onKitchen('mushroom_rice')}>去厨房做野菇焖饭</button>}
          <button className="primary-button" disabled={!canClaimCommunityTask(pet, task) || Boolean(pet.adventure.active || pet.community.expedition.active || pet.community.fishing.active)} onClick={() => { update(p => claimCommunityTask(p, task.id)); close(); }}>交付并领取酬谢</button>
          {!task.found && ['search', 'forage', 'delivery'].includes(task.template) && <button className="secondary-button" disabled={Boolean(pet.adventure.active || pet.adventure.pending || pet.community.fishing.active)} onClick={() => onExplore('commission')}>去溪谷短途{task.template === 'delivery' ? '送餐' : '搜寻'}</button>}
          {!task.found && task.template.startsWith('fish_') && <button className="secondary-button" onClick={() => onFishing(task.template === 'fish_upstream' ? 'upstream' : 'pond')}>去对应水域钓鱼</button>}
          {onFarm && ['vegetables', 'eggs', 'milk'].includes(task.template) && <button className="secondary-button" onClick={() => onFarm(task.template === 'eggs' ? 'coop' : task.template === 'milk' ? 'barn' : 'field')}>去生产地点</button>}
          {(task.template === 'soup' || task.template === 'fresh_porridge') && <button className="secondary-button" onClick={() => onKitchen(task.template === 'soup' ? 'creek_fish_soup' : 'herb_porridge')}>去厨房</button>}
        </div>
        <details className="community-abandon"><summary>放弃这份委托</summary><p>已接取额度不会退还，已消耗的送达物不会返还。</p><button className="text-button" onClick={() => { update(p => cancelCommunityTask(p, task.id)); close(); }}>确认放弃</button></details>
      </> : <button className="primary-button" disabled={used || accepted.length >= 2 || tasks.length >= 2 || sameKind} onClick={() => { update(p => acceptCommunityTask(p, task.id)); close(); }}>{used ? '今天已接取，明日再来' : sameKind ? '先完成同类在途委托' : accepted.length >= 2 ? '今日已接满 2 单' : tasks.length >= 2 ? '先完成手上的 2 单' : '接下这份委托'}</button>}
    </CommunityDetailDialog>;
  };
  return <>
    <CommunitySpecialtyOrders {...props} />
    <section className="community-noticeboard" aria-label="邻里公告板">
      <header className="community-noticeboard-heading"><div><small>溪畔来信 · 留一点时间给邻居</small><h3>今天，帮一点小忙</h3></div><span><span>今日已接 {accepted.length}/2</span><span>进行中 {tasks.length}/2</span></span></header>
      <div className="community-pinned-notes">
        <button type="button" className="community-pinned-note community-story-note" data-tone="pink" aria-haspopup="dialog" onClick={() => setSelected('warm-order')}>
          <Pin className="community-note-pin" size={18} aria-hidden="true" /><span className="community-note-label">{warmDone ? '一封感谢信' : '常驻故事'}</span><span className="community-note-art" aria-hidden="true">🥣</span><strong>给修渠邻居<br />的一碗暖粥</strong><span className="community-note-excerpt">{warmDone ? '谢谢你的暖粥。洗好的碗，下次再还给你。' : '水渠通了，想和你一起尝尝第一份收获。'}</span><span className="community-note-bottom">{warmDone ? <><Check size={16} />心意已送达</> : <>80 金币 · 5 小心心</>}<ArrowUpRight size={16} /></span>
        </button>
        {notes.map(task => {
          const def = commissionDefinitions[task.template], active = tasks.some(value => value.id === task.id), used = accepted.includes(task.id);
          const ready = active && canClaimCommunityTask(pet, task);
          return <button type="button" className="community-pinned-note" key={task.id} data-tone={noteArt[task.template].tone} data-active={active} data-ready={ready} aria-haspopup="dialog" onClick={() => setSelected(task.id)}>
            <Pin className="community-note-pin" size={18} aria-hidden="true" /><span className="community-note-label">{ready ? '可以交付' : active ? '进行中 · 不过期' : used ? '今日已接过' : '今日候选'}</span><span className="community-note-art" aria-hidden="true">{noteArt[task.template].glyph}</span><strong>{def.name}</strong><span className="community-note-excerpt">{def.detail}</span><span className="community-note-bottom"><span><Coins size={15} />{def.coins} 金币{def.reward ? ' ＋ 建材' : ''}</span>{active ? <Check size={16} /> : <ArrowUpRight size={16} />}</span>
          </button>;
        })}
        {!candidates.length && <div className="community-board-memo"><span aria-hidden="true">✎</span><p>完成踩点教学后，邻居们就会把委托贴在这里。</p></div>}
      </div>
      <footer className="community-noticeboard-footer"><span>轻点纸条，读读邻居的留言</span><small>每日 5 点换新 3 份候选 · 每天最多接 2 单 · 同时保留 2 单 · 已接委托不过期</small></footer>
    </section>
    {selectedTask && details(selectedTask)}
    {selected === 'warm-order' && <CommunityDetailDialog title="给修渠邻居的一碗暖粥" eyebrow={warmDone ? '心意已送达' : '常驻故事 · 慢慢来，不会过期'} onClose={close}>
      <div className="community-letter"><span className="community-letter-art" aria-hidden="true">🥣</span><p>{warmDone ? '邻居把空碗洗得干干净净。溪谷带回的种子，已经成了大家日常的一部分。' : '修好菜地，把第一份香草做成暖粥，感谢一起修渠的邻居。'}</p><p className="community-letter-reward">首次酬谢：80 金币 · 5 小心心 · 体力上限 +3</p></div>
      {!warmDone && <><p>菜地开放后交付暖粥 ×1，可用已有料理。持有 {pet.inventory.dish_herb_porridge ?? 0} 份。</p><div className="community-actions"><button className="primary-button" disabled={!free || !pet.community.gardenBuilt || !(pet.inventory.dish_herb_porridge ?? 0)} onClick={() => { update(deliverCommunityOrder); close(); }}>交付暖粥</button><button className="secondary-button" disabled={!free || !pet.community.herbDiscovered} onClick={() => onKitchen('herb_porridge')}>去厨房做暖粥</button></div></>}
    </CommunityDetailDialog>}
  </>;
};
