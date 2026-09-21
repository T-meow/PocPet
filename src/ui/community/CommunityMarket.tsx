import { useEffect, useMemo, useRef, useState } from 'react';
import { Hammer, PackagePlus, Store } from 'lucide-react';
import type { ItemId } from '../../core/petTypes';
import { getCommunitySale, getCuisineSaleNote } from '../../core/communityEconomy';
import { getMarketCapacity, getMarketListingOffer, getMarketQuote, listCommunityGoods, setCommunityMarketOpen, unlistCommunityGoods } from '../../core/communityMarket';
import { CommunityUpgradeDialog } from './CommunityUpgradeTask';
import { marketStackLimit } from '../../core/communityMarketRules';
import type { MarketReceipt } from '../../core/communityTypes';
import { createBuiltinItemRegistry, getInventoryDefinitions, getInventoryItem } from '../../core/items';
import { canSpendCompanionTime } from '../../core/kitchen';
import { itemIcons, unknownItemIcon } from '../../assets';
import { ItemStorageModal } from '../ItemStorageModal';
import { createItemBrowseState } from '../itemBrowse';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import { CommunityMarketArt } from './CommunityMarketArt';
import type { CommunityPanelProps } from './types';
import { demandNames } from '../../core/foodCatalog';

const customerNames = { ordinary: '邻里客人', foodie: '美食客人', collector: '收藏客人', generous: '慷慨游客', legacy: '成交记录' };

export const CommunityMarket = ({ pet, update, onShop, registry, itemIconMap }: CommunityPanelProps) => {
  const name = (id: string) => registry?.get(id)?.name ?? getInventoryItem(id as ItemId)?.name ?? id;
  const icons: Partial<Record<string, string>> = itemIconMap ?? itemIcons;
  const icon = (id: string) => icons[id] ?? registry?.get(id)?.imageUrl ?? unknownItemIcon;
  const [panel, setPanel] = useState<'stock' | 'manage' | 'construction' | null>(null);
  const [browse, setBrowse] = useState(createItemBrowseState);
  const [visitor, setVisitor] = useState<MarketReceipt>();
  const m = pet.community.market, free = canSpendCompanionTime(pet);
  const observed = useRef({ visitors: m.visitors, at: Date.now(), visible: false });
  useEffect(() => {
    const now = Date.now(), visible = document.visibilityState === 'visible', previous = observed.current;
    const receipt = m.log[0];
    // Only a single, freshly observed live visit animates. Mounting the scene,
    // returning from the background and bulk offline settlement never replay it.
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
  const goods = useMemo(() => getInventoryDefinitions(registry ?? createBuiltinItemRegistry(), pet.inventory).filter(item => { const sale = getCommunitySale(item.id); return sale && !sale.exchangeOnly; }), [registry, pet.inventory]);
  const capacity = getMarketCapacity(pet);
  const occupied = m.listings.length, room = Math.max(0, capacity - occupied);
  const stock = m.listings.reduce((n, listing) => n + listing.quantity, 0);
  const visitorQuantity = visitor?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  return <>
    <section className="community-production-scene community-market-scene" data-production-scene="market" data-open={m.open} aria-label="溪畔小摊场景">
      <header className="community-production-heading"><div><small>溪畔小摊 · Lv.{m.level}</small><h3>{m.open ? '把今天的好东西，摆出来' : '小摊在这里，等你开张'}</h3></div><span className="community-scene-status"><i />{m.open ? '开门迎客' : '收摊休息'}</span></header>
      <div className="community-production-view"><CommunityMarketArt market={m} iconFor={icon} nameFor={name} visitor={visitor} />
        <div className="community-market-announcement" role="status" aria-live="polite">{visitor && <span data-generous={visitor.customer === 'generous'}><b>{visitor.buyout ? '全部买下！' : customerNames[visitor.customer]}</b>{visitor.buyout ? '慷慨游客包场，货架售空' : `带走 ${visitorQuantity} 份好东西`}<small>+{visitor.coins} 金币</small></span>}</div>
        <div className="community-harvest-sign"><Store size={18} /><span>{occupied ? `货架 ${occupied}/${capacity} 格 · 共 ${stock} 份` : '货架空着，挑一点收获摆上来'}</span></div></div>
      <footer className="community-production-footer"><div className="community-production-caption"><span>累计售出 {m.sold} 份 · 收入 {m.revenue} 金币</span><span>{m.open ? '客人随机到访，偶尔还有慷慨游客的大单' : '准备好货品，再开店迎接邻居'}</span></div><div className="community-production-dock">
        <button type="button" className="primary-button" disabled={!m.level} aria-haspopup="dialog" onClick={() => setPanel('stock')}><PackagePlus size={20} />手动上架</button>
        <button type="button" className="secondary-button" disabled={!m.level} onClick={() => update(p => setCommunityMarketOpen(p, !m.open))}><Store size={20} />{m.open ? '收摊休息' : '开店营业'}</button>
        <button type="button" className="secondary-button" disabled={!m.level} aria-haspopup="dialog" onClick={() => setPanel('construction')}><Hammer size={20} />建设</button>
      </div></footer>
    </section>
    {panel === 'stock' && <ItemStorageModal mode="bag" pet={pet} items={goods} itemIconMap={itemIconMap ?? itemIcons} browse={browse} onBrowseChange={setBrowse} onClose={() => setPanel(null)} quantityDisabled={!free}
      context={{ title: '手动上架', inventory: pet.inventory, quantityLimit: item => getMarketListingOffer(pet, item.id)?.quantityLimit ?? 0, countLabel: '持有', showStats: false, showRecovery: false, note: '每格最多 20 份，同类商品优先补入未满栏位并沿用原售价。未售商品可在管理货架中取回。' }}
      footer={<><span>货架 {occupied}/{capacity} 格 · 共 {stock} 份</span><button className="storage-switch" onClick={() => setPanel('manage')}>管理货架</button></>}
      tileInfo={item => { const offer = getMarketListingOffer(pet, item.id), quote = getMarketQuote(pet, item.id)!; return { price: <span>{offer ? `${offer.unitPrice} 金币／份` : '暂无可用栏位'}</span>, mark: offer?.listingId !== undefined ? '原价补货' : quote.collector ? '收藏品' : undefined }; }}
      renderActions={(item, quantity) => {
        const offer = getMarketListingOffer(pet, item.id);
        return <><p className="storage-transaction-note">基础回收 {getMarketQuote(pet, item.id)?.base} 金币／份 · {demandNames[getCommunitySale(item.id)!.demand]}</p>{getCuisineSaleNote(item.id) && <small className="storage-transaction-note">{getCuisineSaleNote(item.id)}</small>}{offer ? <><div className="storage-total"><span>售出后可得</span><strong>{offer.unitPrice * quantity} 金币</strong></div><small className="storage-transaction-note">第 {offer.slotIndex + 1} 格 · {offer.listingId !== undefined ? '沿用原价补货' : '新栏位上架'} · {offer.unitPrice} 金币／份{offer.collector ? ' · 收藏客人和慷慨游客选购' : ''}</small></> : <small className="storage-transaction-note">该商品没有可补货的栏位，请先下架其他商品或扩建。</small>}{!free && <small className="storage-transaction-note">伙伴空闲后可以上架商品。</small>}<button className="storage-primary" disabled={!free || !offer || quantity < 1 || quantity > offer.quantityLimit} onClick={() => update(p => listCommunityGoods(p, item.id, quantity, m.nextListingId))}>{!offer ? '货架已满' : `${offer.listingId !== undefined ? '补货' : '上架'} ${item.displayName} ×${quantity}`}</button></>;
      }} />}
    {panel === 'manage' && <CommunityDetailDialog title="管理货架" eyebrow={`货架 ${occupied}/${capacity} 格 · 空栏位 ${room} 个 · 每格最多 ${marketStackLimit} 份`} onClose={() => setPanel('stock')}>
      <div className="community-market-stock">{Array.from({ length: capacity }, (_, slotIndex) => {
        const listing = m.listings.find(listing => listing.slotIndex === slotIndex);
        return <article key={slotIndex} data-slot={slotIndex}><small>第 {slotIndex + 1} 格</small>{listing ? <><img src={icon(listing.itemId)} alt="" /><strong>{name(listing.itemId)} ×{listing.quantity}</strong><small>{listing.unitPrice} 金币／份{listing.collector ? ' · 收藏品' : ''}</small><button className="secondary-button" disabled={!free} onClick={() => update(p => unlistCommunityGoods(p, listing.id))}>下架剩余</button></> : <strong>空栏位</strong>}</article>;
      })}</div>
      <button type="button" className="secondary-button" aria-haspopup="dialog" onClick={() => setPanel('construction')}>货架建设与扩建</button>
      <details className="community-market-details"><summary>整理小摊与经营</summary><p>每隔 5–20 分钟随机来一位客人：50% 为普通客人，25% 为美食客人，15% 为收藏客人，10% 为慷慨游客。基础食材每次 2–4 份，特产 1–2 份，珍稀食材与高级料理由美食客人购买 1 份；收藏品沿用每次 1–3 份。慷慨游客通常一次购买 8–20 份。</p><p>慷慨游客中有 2% 会包下全部余货。闭店暂停客流，离线继续售卖已经上架的商品。</p><p>扩建每级增加 3 个栏位，新栏位上架报价增加 5 个百分点；未满栏位补货仍沿用原价。</p><button className="text-button" onClick={onShop}>去商店补充用品</button></details>
      <details className="community-market-details"><summary>翻看营业账本</summary><p>累计收入 {m.revenue} 金币，其中增值收入 {m.premium} 金币 · 接待 {m.visitors} 位客人。</p>{m.log.length ? <ul className="community-ledger">{m.log.map((entry, index) => <li key={`${entry.visit}:${entry.at}:${index}`}><span><strong>{entry.buyout ? '慷慨游客 · 全部买下' : customerNames[entry.customer]}</strong><span>{entry.items.map(item => `${name(item.itemId)} ×${item.quantity}`).join('、')}</span><small>{new Date(entry.at).toLocaleString('zh-CN', { hour12: false })}</small></span><b>+{entry.coins} 金币</b></li>)}</ul> : <p>还没有成交，下一位客人正在路上。</p>}</details>
    </CommunityDetailDialog>}
    {panel === 'construction' && <CommunityUpgradeDialog pet={pet} update={update} id="stall" registry={registry} itemIconMap={itemIconMap} onClose={() => setPanel(null)} />}
  </>;
};
