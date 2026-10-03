import { useState } from 'react';
import { ArrowRight, Check, Hammer, Sparkles } from 'lucide-react';
import { communityDecorationIds, communityDecorations, type CommunityDecorationId } from '../../core/regionalTreasures';
import { decorationEffects, getDecorationIdleTimeReduction, getDecorationLevel, getDecorationValue } from '../../core/decorationEffects';
import { getDecorationUpgradeQuote } from '../../core/communityDecorations';
import { canSpendCompanionTime } from '../../core/kitchen';
import { getInventoryItem } from '../../core/items';
import type { ItemId, PetState } from '../../core/petTypes';
import { DecorationArt } from './TreasureDisplay';
import { HelpButton } from '../help/HelpButton';
import { decorationsHelp } from '../help/decorationHelp';
import { formatInteger } from '../numberFormat';

const effectText = (id: CommunityDecorationId, level: number) => `${decorationEffects[id].label} ${formatInteger(getDecorationValue(id, level))}${decorationEffects[id].unit}${id === 'star_dome' ? ` · 挂机判定缩时 ${formatInteger(getDecorationIdleTimeReduction(level))}%` : ''}`;
const decorationEntries = (pet: PetState) => communityDecorationIds.map(id => {
  const level = getDecorationLevel(pet, id), definition = communityDecorations[id];
  const quote = level > 0 && level < 10 ? getDecorationUpgradeQuote(pet, id) : undefined;
  const materials = Object.entries(definition.items);
  const collected = materials.filter(([item, count]) => (pet.inventory[item] ?? 0) >= count).length;
  const ready = level ? Boolean(quote?.ready) : !pet.timePause && canSpendCompanionTime(pet) && collected === materials.length;
  const note = level === 10 ? '所有等级已完成' : level ? quote?.reason || '材料齐备，可提升永久效果'
    : collected < materials.length ? `制作材料 ${collected}/${materials.length} 种已备齐`
      : pet.timePause ? '材料齐备，恢复时间后可制作' : !canSpendCompanionTime(pet) ? '材料齐备，等伙伴空闲后制作' : '材料齐备，可以制作';
  return { id, level, definition, ready, note };
});

export const DecorationEntry = ({ pet, onOpen }: { pet: PetState; onOpen: () => void }) => {
  const entries = decorationEntries(pet), owned = entries.filter(entry => entry.level > 0).length;
  const craft = entries.filter(entry => !entry.level && entry.ready).length, upgrade = entries.filter(entry => entry.level > 0 && entry.ready).length;
  const status = craft || upgrade ? [craft ? `${craft} 件可制作` : '', upgrade ? `${upgrade} 件可升级` : ''].filter(Boolean).join(' · ')
    : owned ? `已陈列 ${owned}/${entries.length} 件 · 查看材料与升级` : '从第一件装饰开始 · 可先浏览制作材料';
  return <button type="button" className="decoration-entry" data-ready={craft + upgrade > 0} aria-haspopup="dialog" aria-label={`打开装饰工坊，${status}`} onClick={onOpen}>
    <span className="decoration-entry-copy"><span className="decoration-entry-eyebrow"><Sparkles size={14} aria-hidden="true" />农场装饰 · 永久加成</span><strong>装饰工坊</strong><span className="decoration-entry-description">把探索带回的珍宝，变成农场里的风景。</span><span className="decoration-entry-status">{status}</span></span>
    <span className="decoration-entry-preview" aria-hidden="true">{(['amber_lantern', 'creek_fountain', 'star_dome'] as const).map(id => <DecorationArt key={id} id={id} level={getDecorationLevel(pet, id)} />)}</span>
    <span className="decoration-entry-action">制作与升级<ArrowRight size={18} aria-hidden="true" /></span>
  </button>;
};

type WorkshopFilter = 'all' | 'craft' | 'owned' | 'upgrade';
export const DecorationWorkshop = ({ pet, onSelect }: { pet: PetState; onSelect: (id: CommunityDecorationId) => void }) => {
  const [filter, setFilter] = useState<WorkshopFilter>('all');
  const entries = decorationEntries(pet), owned = entries.filter(entry => entry.level > 0);
  const matches = (entry: typeof entries[number], value: WorkshopFilter) => value === 'all' || (value === 'owned' ? entry.level > 0 : value === 'craft' ? !entry.level && entry.ready : entry.level > 0 && entry.ready);
  const shown = entries.filter(entry => matches(entry, filter));
  const filters: { id: WorkshopFilter; label: string }[] = [{ id: 'all', label: '全部装饰' }, { id: 'craft', label: '可制作' }, { id: 'owned', label: '已拥有' }, { id: 'upgrade', label: '可升级' }];
  return <section className="decoration-workshop" aria-label="装饰制作与升级">
    <div className="decoration-workshop-intro"><div><small>让每一次探索，都留下长久的礼物</small><h3>把旅途的光，留在农场</h3><p>收集珍宝制作装饰，自动陈列在农场，让经营、种植与探索都有永久加成。</p><div className="decoration-workshop-steps"><span>01 收集材料</span><ArrowRight size={14} aria-hidden="true" /><span>02 制作陈列</span><ArrowRight size={14} aria-hidden="true" /><span>03 升级效果</span></div></div><div className="decoration-workshop-progress"><strong>{owned.length}<small> / {entries.length}</small></strong><span>装饰已陈列</span><progress value={owned.length} max={entries.length} aria-label="已制作装饰数量" /></div></div>
    <div className="decoration-workshop-toolbar"><div className="decoration-workshop-filters" role="group" aria-label="筛选装饰">{filters.map(entry => <button key={entry.id} type="button" aria-pressed={filter === entry.id} onClick={() => setFilter(entry.id)}>{entry.label}<span>{entries.filter(item => matches(item, entry.id)).length}</span></button>)}</div><HelpButton {...decorationsHelp} /></div>
    <div className="decoration-workshop-grid">{shown.map(({ id, level, definition, ready, note }) => <button type="button" key={id} className="decoration-workshop-card" data-decoration-id={id} data-ready={ready} data-owned={level > 0} aria-haspopup="dialog" onClick={() => onSelect(id)}>
      <span className="decoration-workshop-art"><DecorationArt id={id} level={level} /><span className="decoration-workshop-badge">{ready ? <Hammer size={12} aria-hidden="true" /> : level > 0 ? <Check size={12} aria-hidden="true" /> : null}{level === 10 ? 'Lv.10 · 已满级' : ready ? level ? '可升级' : '可制作' : level ? `Lv.${level} · 已陈列` : '未制作'}</span></span>
      <strong>{definition.name}</strong><span className="decoration-workshop-effect"><small>{level ? '当前永久效果' : '制作后获得'}</small><b>{effectText(id, level || 1)}</b></span>
      <span className="decoration-workshop-material">{level ? level === 10 ? `陈列在${decorationEffects[id].place}` : `下一级 · ${effectText(id, level + 1)}` : `核心材料 · ${getInventoryItem(definition.material as ItemId)?.name ?? definition.material}`}</span>
      <span className="decoration-workshop-note">{note}</span><span className="decoration-workshop-card-action">{level === 10 ? '查看装饰' : ready ? level ? `升级至 Lv.${level + 1}` : '查看并制作' : level ? '查看升级材料' : '查看制作材料'}<ArrowRight size={16} aria-hidden="true" /></span>
    </button>)}</div>
    {!shown.length && <div className="decoration-workshop-empty"><Sparkles size={30} aria-hidden="true" /><h3>{filter === 'owned' ? '第一件装饰，等你带回家' : filter === 'craft' ? '先为喜欢的装饰备好材料' : '看看装饰的下一步成长'}</h3><p>{filter === 'owned' ? '每件装饰都有永久效果，先挑一件喜欢的，看看需要哪些珍宝。' : '打开装饰详情，可以查看缺少的材料和探索去向；伙伴空闲、材料齐备后即可操作。'}</p><button type="button" className="secondary-button" onClick={() => setFilter('all')}>浏览全部装饰</button></div>}
    <details className="decoration-workshop-benefits"><summary><Sparkles size={16} aria-hidden="true" />已生效的永久加成<span>{owned.length} 项</span></summary>{owned.length ? <dl>{owned.map(({ id, level, definition }) => <div key={id}><dt>{definition.name} · Lv.{level}</dt><dd>{effectText(id, level)}</dd></div>)}</dl> : <p>制作第一件装饰后，可以在这里查看农场获得的永久加成。</p>}</details>
  </section>;
};
