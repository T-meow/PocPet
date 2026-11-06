import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Hammer, NotebookPen, PackagePlus, Store } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';
import { marketHelp, getMarketItemHelp } from '../help/marketHelp';
import type { ItemId } from '../../core/petTypes';
import { configureMarketSlot, getCommunitySaleable, getMarketBuyoutBonus, getMarketCapacity, getMarketListingOffer, getMarketQuote, getMarketTrafficBonus, getMarketVariety, listCommunityGoods, setCommunityMarketOpen, setMarketAutoRestock, unlistCommunityGoods } from '../../core/communityMarket';
import { isMarketItemAllowed } from '../../core/marketValuation';
import { canDoFarmWork, getFarmNeighborStatus } from '../../core/farmNeighbor';
import { CommunityUpgradeDialog } from './CommunityUpgradeTask';
import { marketStackLimit } from '../../core/communityMarketRules';
import type { MarketReceipt } from '../../core/communityTypes';
import { createBuiltinItemRegistry, getInventoryDefinitions, getInventoryItem } from '../../core/items';
import { itemIcons, unknownItemIcon } from '../../assets';
import { ItemStorageModal } from '../ItemStorageModal';
import { createItemBrowseState } from '../itemBrowse';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import { CommunityMarketArt } from './CommunityMarketArt';
import { DishValueBadge } from '../DishValueBadge';
import type { CommunityPanelProps } from './types';
import { resolveNeighborPortrait, type CompanionPortrait } from '../companionRoster';
import { CompanionDuty } from './CompanionDuty';

const customerNames = { ordinary: '邻里客人', foodie: '美食客人', collector: '收藏客人', generous: '慷慨游客', legacy: '成交记录' };

export const CommunityMarket = ({ pet, update, onShop, registry, itemIconMap, onToggleItemFavorite, currentCompanion, favoriteFoodIds, substituting, companionRoster = [] }: CommunityPanelProps & { currentCompanion: CompanionPortrait; favoriteFoodIds?: readonly ItemId[]; substituting: boolean; companionRoster?: readonly CompanionPortrait[] }) => {
  const help = getFarmNeighborStatus(pet);
  const dutyCompanion = help.active ? resolveNeighborPortrait(companionRoster, pet.community.farmNeighbor?.neighbor) : currentCompanion;
  const name = (id: string) => registry?.get(id)?.name ?? getInventoryItem(id as ItemId)?.name ?? id;
  const icons: Partial<Record<string, string>> = itemIconMap ?? itemIcons;
  const icon = (id: string) => icons[id] ?? registry?.get(id)?.imageUrl ?? unknownItemIcon;
  const [panel, setPanel] = useState<'slot' | 'choose' | 'ledger' | 'traffic' | 'construction' | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [quantity, setQuantity] = useState(marketStackLimit);
  const [browse, setBrowse] = useState(createItemBrowseState);
  const [visitor, setVisitor] = useState<MarketReceipt>();
  const m = pet.community.market, free = canDoFarmWork(pet);
  const observed = useRef({ visitors: m.visitors, at: Date.now(), visible: false });
  useEffect(() => {
    const now = Date.now(), visible = document.visibilityState === 'visible', previous = observed.current;
    const receipt = m.log[0];
    if (!panel && m.open && visible && previous.visible && now - previous.at < 10_000
      && m.visitors === previous.visitors + 1 && receipt?.visit === m.visitors && now >= receipt.at && now - receipt.at < 10_000) setVisitor(receipt);
    if (panel || !m.open || !visible) setVisitor(undefined);
    observed.current = { visitors: m.visitors, at: now, visible };
  }, [m, pet.lastUpdatedAt, panel]);
  useEffect(() => {
    if (!visitor) return;
    const timer = window.setTimeout(() => setVisitor(undefined), 8000);
    return () => window.clearTimeout(timer);
  }, [visitor]);
  useEffect(() => {
    const hide = () => { observed.current.visible = false; setVisitor(undefined); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const goods = useMemo(() => getInventoryDefinitions(registry ?? createBuiltinItemRegistry(), pet.inventory).filter(item => isMarketItemAllowed(item.id)), [registry, pet.inventory]);
  const capacity = getMarketCapacity(pet), buyout = getMarketBuyoutBonus(pet), traffic = getMarketTrafficBonus(pet), variety = getMarketVariety(m);
  const stock = m.listings.reduce((n, listing) => n + listing.quantity, 0);
  const slot = m.listings.find(listing => listing.slotIndex === selectedSlot);
  const offer = slot ? getMarketListingOffer(pet, slot.itemId, selectedSlot, registry) : undefined;
  const refillQuantity = Math.max(0, Math.min(quantity, offer?.quantityLimit ?? 0));
  const rowHeight = 252 / Math.max(2, capacity / 3);
  const openSlot = (index: number) => { setSelectedSlot(index); setQuantity(marketStackLimit); setPanel('slot'); };
  const visitorQuantity = visitor?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  return <>
    <HelpButton {...marketHelp} />
    <section className="community-production-scene community-market-scene" data-production-scene="market" data-open={m.open} aria-label="溪畔小摊场景">
      <button type="button" className="community-market-notebook icon-button" aria-label="查看营业记事本" title="营业记事本" aria-haspopup="dialog" onClick={() => setPanel('ledger')}><NotebookPen size={24} /></button>
      <header className="community-production-heading"><div><small>溪畔小摊 · Lv.{m.level}</small><h3>{m.open ? '把今天的好东西，摆出来' : '小摊在这里，等你开张'}</h3></div><span className="community-scene-status"><i />{m.open ? '开门迎客' : '收摊休息'}</span></header>
      <button type="button" className="community-market-info" data-reduced={variety.count < 6} aria-haspopup="dialog" onClick={() => setPanel('traffic')}>
        <span className="community-market-info-stock"><Store size={16} /><span>货架 {m.listings.length}/{capacity} 槽 · {stock} 件</span></span>
        <span className="community-market-info-traffic">{variety.count < 6 && <AlertTriangle size={15} />}<span>{stock ? `${variety.count} 种商品 · 客流 ${Math.round(variety.multiplier * 100)}%` : '货架缺货 · 暂无客流'}</span></span>
      </button>
      <div className="community-production-view">
        <div className="community-market-stage"><div className="community-market-canvas"><CommunityMarketArt market={m} iconFor={icon} nameFor={name} visitor={visitor} />
          {Array.from({ length: capacity }, (_, index) => {
            const entry = m.listings.find(listing => listing.slotIndex === index);
            return <button key={index} type="button" className="community-market-slot-target" aria-haspopup="dialog" aria-label={`第 ${index + 1} 格：${entry ? `${name(entry.itemId)}，${entry.quantity ? `${entry.quantity} 件` : '缺货'}` : '选择商品'}`} onClick={() => openSlot(index)} style={{ left: `${(296 + index % 3 * 134) / 10}%`, top: `${(270 + Math.floor(index / 3) * rowHeight) / 7}%`, width: '13%', height: `${(rowHeight - 5) / 7}%` }} />;
          })}
          {m.open && <CompanionDuty actor={dutyCompanion} label={help.active ? substituting ? '代班中' : '帮忙中' : '执勤中'} className="community-market-duty" />}
        </div></div>
        <div className="community-market-announcement" role="status" aria-live="polite">{visitor && <span data-generous={visitor.customer === 'generous'}><b>{visitor.buyout ? '全部买下！' : customerNames[visitor.customer]}</b>{visitor.buyout ? '慷慨游客包场，货架售空' : `带走 ${visitorQuantity} 份好东西`}<small>+{visitor.coins} 金币</small></span>}</div>
      </div>
      <footer className="community-production-footer"><div className="community-production-caption"><span>本次摆摊收入 {m.sessionRevenue} 金币</span></div><div className="community-production-dock">
        <button type="button" className="primary-button" disabled={!m.level} aria-haspopup="dialog" onClick={() => openSlot(Array.from({ length: capacity }, (_, index) => index).find(index => !m.listings.some(entry => entry.slotIndex === index)) ?? 0)}><PackagePlus size={20} />管理槽位</button>
        <button type="button" className="secondary-button" disabled={!m.level || Boolean(pet.timePause)} onClick={() => update(p => setCommunityMarketOpen(p, !m.open))}><Store size={20} />{m.open ? '收摊休息' : '开店营业'}</button>
        <button type="button" className="secondary-button" disabled={!m.level} aria-haspopup="dialog" onClick={() => setPanel('construction')}><Hammer size={20} />建设</button>
      </div></footer>
    </section>
    {panel === 'slot' && <CommunityDetailDialog title={`第 ${selectedSlot + 1} 格`} eyebrow={`固定选品 · 每格最多 ${marketStackLimit} 件`} onClose={() => setPanel(null)}>
      <div className="community-market-slot-tabs">{Array.from({ length: capacity }, (_, index) => <button type="button" key={index} className="secondary-button" aria-pressed={index === selectedSlot} onClick={() => openSlot(index)}>{index + 1}</button>)}</div>
      {slot ? <>
        <div className="community-market-slot-summary"><img src={icon(slot.itemId)} alt="" /><div><h3>{name(slot.itemId)}</h3><p>{slot.quantity ? `在售 ${slot.quantity}/${marketStackLimit} 件` : '缺货 · 选品已保留'} · {slot.unitPrice} 金币／件</p><DishValueBadge itemId={slot.itemId} /></div></div>
        <p>仓库可用 {getCommunitySaleable(pet, slot.itemId)} 件；售罄后仍保留此商品，补货沿用当前挂牌价。</p>
        <label className="community-market-quantity">补货数量<input type="number" min={1} max={offer?.quantityLimit || 1} value={refillQuantity || 1} disabled={!free || !offer?.quantityLimit} onChange={event => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></label>
        <div className="community-market-slot-actions"><button type="button" className="primary-button" disabled={!free || !refillQuantity} onClick={() => update(p => listCommunityGoods(p, slot.itemId, refillQuantity, m.nextListingId, Date.now(), selectedSlot, registry))}>补货 {refillQuantity} 件</button><button type="button" className="secondary-button" disabled={!free} onClick={() => setPanel('choose')}>修改商品</button><button type="button" className="secondary-button" disabled={!free} onClick={() => update(p => unlistCommunityGoods(p, slot.id))}>清空槽位并退货</button></div>
        <label className="community-market-auto"><input type="checkbox" checked={Boolean(slot.autoRestock)} disabled={!free || !help.active && !slot.autoRestock} onChange={event => update(p => setMarketAutoRestock(p, selectedSlot, event.target.checked))} />每 5 分钟自动补至 {marketStackLimit} 件</label>
        <p>{!help.active ? '雇佣邻居后可自动补货；已有设置会保留。' : !m.open ? '收摊期间暂停自动补货。' : slot.autoRestock ? '邻居会按槽位顺序从仓库补货，缺货时保留选品等待补充。' : '开启后由邻居定期补货，离线也有效。'}</p>
      </> : <><p>选择商品后，这个槽位会持续保留选品。</p><button type="button" className="primary-button" disabled={!free} onClick={() => setPanel('choose')}>选择商品</button></>}
      {!free && <p>伙伴空闲或雇佣邻居后可管理货架；时间冻结时暂停操作。</p>}
      <button type="button" className="text-button" onClick={onShop}>去商店补充用品</button>
    </CommunityDetailDialog>}
    {panel === 'choose' && <ItemStorageModal onToggleItemFavorite={onToggleItemFavorite} mode="bag" pet={pet} actorId={currentCompanion.id} favoriteFoodIds={favoriteFoodIds} items={goods} itemIconMap={itemIconMap ?? itemIcons} browse={browse} onBrowseChange={setBrowse} onClose={() => setPanel('slot')} quantityDisabled={!free}
      context={{ title: `第 ${selectedSlot + 1} 格 · 选择商品`, inventory: pet.inventory, quantityLimit: item => Math.min(marketStackLimit, getCommunitySaleable(pet, item.id)), countLabel: '持有', showStats: false, showRecovery: false, help: item => getMarketItemHelp(pet, item.id, registry) }}
      footer={<span>每格最多 {marketStackLimit} 件 · 改品时剩余商品退回仓库</span>}
      tileInfo={item => ({ price: <span>{getMarketQuote(pet, item.id, registry)!.price} 金币／件</span> })}
      renderActions={(item, amount) => <><div className="storage-total"><span>售出后可得</span><strong>{getMarketQuote(pet, item.id, registry)!.price * amount} 金币</strong></div><button type="button" className="storage-primary" disabled={!free || amount < 1 || amount > Math.min(marketStackLimit, getCommunitySaleable(pet, item.id))} onClick={() => {
        update(p => {
          const now = Date.now(), configured = configureMarketSlot(p, selectedSlot, item.id, registry, now);
          if (configured.community.market.nextListingId === p.community.market.nextListingId || configured.community.market.listings.find(entry => entry.slotIndex === selectedSlot)?.itemId !== item.id) return configured;
          return listCommunityGoods(configured, item.id, amount, configured.community.market.nextListingId, now, selectedSlot, registry);
        });
        setPanel('slot');
      }}>选定并上架 {item.displayName} ×{amount}</button></>} />}
    {panel === 'ledger' && <CommunityDetailDialog title="营业记事本" eyebrow="收益与访客" onClose={() => setPanel(null)}>
      <p>本次摆摊收入 {m.sessionRevenue} 金币，再次开店归零。</p><p>历史总收入 {m.revenue} 金币 · 累计售出 {m.sold} 件 · 接待 {m.visitors} 位客人。</p>
      <div className="community-market-details">{m.log.length ? <ul className="community-ledger">{m.log.map((entry, index) => <li key={`${entry.visit}:${entry.at}:${index}`}><span><strong>{entry.buyout ? '慷慨游客 · 全部买下' : customerNames[entry.customer]}</strong><span>{entry.items.map(item => `${name(item.itemId)} ×${item.quantity}`).join('、')}</span><small>{new Date(entry.at).toLocaleString('zh-CN', { hour12: false })}</small></span><b>+{entry.coins} 金币</b></li>)}</ul> : <p>还没有成交，备好商品开张吧。</p>}</div>
    </CommunityDetailDialog>}
    {panel === 'traffic' && <CommunityDetailDialog title="商品种类与客流" eyebrow={`当前有货 ${variety.count} 种 · 种类客流 ${Math.round(variety.multiplier * 100)}%`} onClose={() => setPanel(null)}>
      <p>至少摆出 6 种有货商品，客流恢复正常。相同商品摆在多个槽位只算一种，缺货槽位暂不计入。</p><p>1–6 种商品分别约为正常客流的 33%、47%、60%、73%、87%、100%。正常基础客流为每 4–8 分钟一位，无货时暂停来客。</p><p>装饰客流 +{traffic.total}%：铭牌 +{traffic.sign}%、叶影灯 +{traffic.lantern}%、水景 +{traffic.fountain}%，在种类客流上继续加成。包场机会加成 +{buyout.total}%。</p>
    </CommunityDetailDialog>}
    {panel === 'construction' && <CommunityUpgradeDialog pet={pet} update={update} id="stall" registry={registry} itemIconMap={itemIconMap} onClose={() => setPanel(null)} />}
  </>;
};
