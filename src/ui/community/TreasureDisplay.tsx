import { useState, type CSSProperties } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { decorationIcons } from '../../decorationAssets';
import { buildCommunityDecoration, getDecorationUpgradeQuote, upgradeCommunityDecoration } from '../../core/communityDecorations';
import { communityDecorations, communityDecorationIds, regionalTreasures, regionalTreasureIds, type CommunityDecorationId, type RegionalTreasureId } from '../../core/regionalTreasures';
import { decorationEffects, getDecorationEffects, getDecorationLevel, getDecorationValue } from '../../core/decorationEffects';
import { adventureTreasureIds } from '../../core/adventureItems';
import { getInventoryItem } from '../../core/items';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { Inventory, ItemId, PetState } from '../../core/petTypes';
import type { CommunityPanelProps } from './types';
import type { OutpostRequest } from '../outpostNavigation';
import { DialogShell } from '../DialogShell';

const effectText = (id: CommunityDecorationId, level: number) => `${decorationEffects[id].label} ${getDecorationValue(id, level)}${decorationEffects[id].unit}`;
const stage = (level: number) => level >= 10 ? 'complete' : level >= 5 ? 'grown' : 'first';
const itemName = (item: string) => getInventoryItem(item as ItemId)?.name ?? item;
export const DecorationSources = ({ treasure, onNavigate }: { treasure?: RegionalTreasureId; onNavigate: (request: OutpostRequest) => void }) => {
  const region = treasure ? regionalTreasures[treasure].region : 'valley';
  return <section className="decoration-sources"><h3>去收集材料</h3><div><button className="secondary-button" onClick={() => onNavigate({ view: 'route', region, ...(treasure === 'creek_aquamarine' ? { target: 'aquamarine' } : {}) })}>去{treasure ? regionalTreasures[treasure].name : '通用物品'}产地探索</button><button className="secondary-button" onClick={() => onNavigate({ view: 'idle', region })}>安排当地挂机</button><button className="secondary-button" onClick={() => onNavigate({ view: 'route', region: 'valley', target: 'materials' })}>去溪谷收集建材</button></div><small>金币堆、琥珀与金条各地均可发现；挂机珍宝每两小时判定一次，配餐基础概率 5%～20%，另加星辉穹顶效果。</small></section>;
};
export const DecorationArt = ({ id, level }: { id: CommunityDecorationId; level: number }) => <span className="decoration-art" data-stage={stage(level)} data-owned={level > 0}><img src={decorationIcons[id]} alt="" />{level >= 5 && <span className="decoration-art-trim" aria-hidden="true">{level >= 10 ? '✦' : '◇'}</span>}</span>;

export const TreasureDisplay = ({ pet, onSelect }: { pet: PetState; onSelect: (id: CommunityDecorationId) => void }) => {
  const effects = getDecorationEffects(pet);
  return <section className="community-card community-decorations" aria-label="装饰与永久加成">
    <header><div><small>让旅途的发现，留在日常里</small><h3>我的装饰</h3></div><span>{pet.community.decorations.length}/{communityDecorationIds.length} 件</span></header>
    <div className="decoration-summary"><p><b>经营</b><span>订单 +{effects.amber_lantern}% · 上架 +{effects.golden_sign}%</span></p><p><b>种植与生产</b><span>生长 −{effects.creek_fountain}% · 生产 −{effects.sun_weather_vane}%</span></p><p><b>探索与垂钓</b><span>额外采集 {effects.emerald_pendant}% · 珍宝 +{effects.star_dome} 个百分点 · 咬钩等待 −{effects.pearl_lamp}%</span></p></div>
    <p>制作后永久生效，所有装饰同时提供加成。每件最高十级，材料可以慢慢攒。</p>
    <div className="decoration-list">{communityDecorationIds.map(id => {
      const level = getDecorationLevel(pet, id), quote = level ? getDecorationUpgradeQuote(pet, id) : undefined;
      const craftReady = !pet.timePause && canSpendCompanionTime(pet) && Object.entries(communityDecorations[id].items).every(([item, n]) => (pet.inventory[item] ?? 0) >= n);
      return <button type="button" key={id} className="decoration-row" onClick={() => onSelect(id)} aria-haspopup="dialog"><DecorationArt id={id} level={level} /><span><strong>{communityDecorations[id].name}<small>{level ? `Lv.${level}${level === 10 ? ' · 满级' : ''}` : '待制作'}</small></strong><span>{effectText(id, level || 1)}</span><small>{level === 10 ? `已陈列 · ${decorationEffects[id].place}` : level ? quote?.ready ? '材料齐备，可以升级' : '继续收集升级材料' : craftReady ? '材料齐备，可以制作' : '查看制作材料'}</small></span><ArrowRight size={18} /></button>;
    })}</div>
  </section>;
};

export const DecorationDetail = ({ pet, update, id, onClose, onOpenOutpost }: Pick<CommunityPanelProps, 'pet' | 'update' | 'onOpenOutpost'> & { id: CommunityDecorationId; onClose: () => void }) => {
  const level = getDecorationLevel(pet, id), definition = communityDecorations[id];
  const [selection, setSelection] = useState<Inventory>();
  const quote = getDecorationUpgradeQuote(pet, id, selection), full = level === 10;
  const items = level ? quote.items : definition.items;
  const missing = Object.fromEntries(Object.entries(items).flatMap(([item, n]) => n > (pet.inventory[item] ?? 0) ? [[item, n - (pet.inventory[item] ?? 0)]] : []));
  const reason = level ? quote.reason : pet.timePause ? '时间冻结中，恢复后可制作' : !canSpendCompanionTime(pet) ? '等伙伴回家并空闲后再制作' : Object.keys(missing).length ? '制作材料尚未备齐' : '';
  const treasure = level ? decorationEffects[id].treasure : regionalTreasureIds.includes(definition.material as RegionalTreasureId) ? definition.material as RegionalTreasureId : undefined;
  const selectedCount = Object.values(quote.common).reduce((sum, n) => sum + n, 0);
  return <DialogShell fullscreen className="decoration-dialog" backdropClassName="decoration-backdrop" labelId="decoration-title" onClose={onClose}>
    <header><div><small>旅途与日常 · {level ? `Lv.${level} / 10` : '制作永久装饰'}</small><h2 id="decoration-title">{definition.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭装饰详情，返回原位置"><X size={22} /></button></header>
    <div className="decoration-detail-scroll"><div className="decoration-hero"><DecorationArt id={id} level={level} /><p>{definition.description}</p><small>陈列在{decorationEffects[id].place} · 设施未开放时暂放旅途角</small></div>
      <section className="decoration-effect-card"><h3><Sparkles size={18} />{level ? '当前永久效果' : '制作后获得'}</h3><strong>{effectText(id, level || 1)}</strong>{level > 0 && !full && <p>下一级 · {effectText(id, level + 1)}</p>}<small>订单接取、商品上架、播种、抛竿和出发时锁定效果；牲畜下一生产周期生效。{id === 'golden_sign' && '实际售价受商品买卖价差限制，以小摊报价为准。'}</small></section>
      {!full && <section className="decoration-materials"><h3>{level ? `升至 Lv.${level + 1}` : '制作材料'}</h3>{level > 0 && <p>金币 <b>{pet.coins}/{quote.coins}</b>{pet.coins < quote.coins && <em>还差 {quote.coins - pet.coins}</em>}</p>}
        {Object.entries(items).filter(([item]) => !level || !adventureTreasureIds.includes(item as typeof adventureTreasureIds[number])).map(([item, n]) => <p key={item}><span>{itemName(item)}</span><b>{pet.inventory[item] ?? 0}/{n}</b>{missing[item] > 0 && <em>还差 {missing[item]}</em>}</p>)}
        {level > 0 && <fieldset><legend>通用探索物品 · 已选 {selectedCount}/{quote.commonCount} 件</legend><small>三种物品可混用，默认先使用兑换价值较低的物品。</small>{adventureTreasureIds.map(item => <label key={item}><span>{itemName(item)}<small>库存 {pet.inventory[item] ?? 0}</small></span><input type="number" min={0} max={Math.min(quote.commonCount, pet.inventory[item] ?? 0)} aria-label={`升级消耗${itemName(item)}`} value={quote.common[item] ?? 0} onChange={event => setSelection({ ...quote.common, [item]: Math.max(0, Math.min(quote.commonCount, pet.inventory[item] ?? 0, Math.floor(Number(event.target.value)) || 0)) })} /></label>)}{selectedCount !== quote.commonCount && <p className="decoration-shortage">{selectedCount < quote.commonCount ? `还需选择 ${quote.commonCount - selectedCount} 件` : `请减少 ${selectedCount - quote.commonCount} 件`}</p>}</fieldset>}
        <p className="decoration-deduction">本次提交：{level ? `${quote.coins} 金币；` : ''}{Object.entries(items).map(([item, n]) => `${itemName(item)} ×${n}`).join('、')}。实物提交后消耗。</p>
      </section>}
      {!full && onOpenOutpost && <DecorationSources treasure={treasure} onNavigate={onOpenOutpost} />}
      {full && <p className="decoration-complete">这件装饰已经完成。它会一直陪伴农场的日常。</p>}
    </div>
    <footer className="decoration-action-bar"><div role="status">{full ? 'Lv.10 · 已满级' : reason || '材料齐备，提交后立即完成'}</div><button className="primary-button" disabled={full || Boolean(reason)} onClick={() => update(p => level ? upgradeCommunityDecoration(p, id, level, quote.common) : buildCommunityDecoration(p, id))}>{full ? '已达到最高等级' : level ? `升级至 Lv.${level + 1}` : '制作并陈列'}</button></footer>
  </DialogShell>;
};

const decorationPositions = (pet: PetState): Record<CommunityDecorationId, [number, number, boolean]> => {
  const c = pet.community;
  return {
    amber_lantern: [61, 73, true], golden_sign: [16, 72, c.facilities.stall.built], creek_fountain: [33, 53, c.gardenBuilt],
    sun_weather_vane: [65, 18, c.facilities.coop.built || c.facilities.barn.built], emerald_pendant: [61, 49, true],
    pearl_lamp: [59, 67, c.facilities.fishing_hut.built], star_dome: [72, 92, true],
  };
};
export const DecorationScene = ({ pet, fishing, onSelect }: { pet: PetState; fishing: boolean; onSelect: (id: CommunityDecorationId) => void }) => {
  const positions = decorationPositions(pet);
  return <>{communityDecorationIds.flatMap(id => {
    const level = getDecorationLevel(pet, id);
    const [x, y, host] = positions[id];
    if (!level || !host || id === 'star_dome') return [];
    if (fishing !== (id === 'pearl_lamp' && host)) return [];
    return [<button key={id} type="button" className="decoration-scene-object" style={{ '--decoration-x': `${x}%`, '--decoration-y': `${y}%` } as CSSProperties} aria-label={`${communityDecorations[id].name} Lv.${level}，查看效果与升级`} aria-haspopup="dialog" onClick={() => onSelect(id)}><DecorationArt id={id} level={level} /></button>];
  })}</>;
};
export const DecorationCorner = ({ pet, onSelect }: { pet: PetState; onSelect: (id: CommunityDecorationId) => void }) => {
  const positions = decorationPositions(pet);
  const ids = communityDecorationIds.filter(id => getDecorationLevel(pet, id) && (id === 'star_dome' || !positions[id][2]));
  return ids.length ? <div className="decoration-corner" aria-label="农场旅途角"><small>旅途角</small><div>{ids.map(id => <button type="button" key={id} aria-haspopup="dialog" aria-label={`${communityDecorations[id].name}，查看效果与升级`} onClick={() => onSelect(id)}><DecorationArt id={id} level={getDecorationLevel(pet, id)} /><span>{communityDecorations[id].name}</span></button>)}</div></div> : null;
};
