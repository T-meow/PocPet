import { useState } from 'react';
import type { ItemId } from '../../core/petTypes';
import { getCommunitySale } from '../../core/communityEconomy';
import { getCommunitySaleable, getMarketCapacity, getMarketQuote, listCommunityGoods, sellCommunityGuild, setCommunityMarketOpen, setCommunityReserve, unlistCommunityGoods, upgradeCommunityMarket } from '../../core/communityMarket';
import { getInventoryItem } from '../../core/items';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { CommunityPanelProps } from './types';

export const CommunityMarket = ({ pet, update, onShop, registry }: CommunityPanelProps) => {
  const name = (id: string) => registry?.get(id)?.name ?? getInventoryItem(id as ItemId)?.name ?? id;
  const [selection, setSelection] = useState(''), [quantity, setQuantity] = useState(1), [reserve, setReserve] = useState<{ id: string; value: number }>(), [sellReview, setSellReview] = useState<{ id: string; quantity: number; stock: number }>();
  const m = pet.community.market, free = canSpendCompanionTime(pet);
  const goods = Object.keys(pet.inventory).filter(id => (pet.inventory[id] ?? 0) > 0 && getCommunitySale(id)), id = goods.includes(selection) ? selection : goods[0] ?? '';
  const quote = getMarketQuote(pet, id), held = pet.inventory[id] ?? 0, available = getCommunitySaleable(pet, id), occupied = m.listings.reduce((n, listing) => n + listing.quantity, 0);
  const choose = (id: string) => { setSelection(id); setQuantity(1); setReserve(undefined); setSellReview(undefined); };
  return <>
    <section className="community-card"><div className="community-section-heading"><h3>🧺 溪畔小摊</h3><span className="community-tag">{m.level ? `Lv.${m.level} · ${m.open ? '营业中' : '已闭店'}` : '建设后开放'}</span></div><p>普通客人每 30 分钟购买 1 份；每第 6 位有珍品收藏需求。闭店不累计来客，离线最多售出货架上的余量。知识只提高报价，扩建另增加货架容量。</p>
      {m.level > 0 ? <><div className="community-production"><div><b>{occupied}/{getMarketCapacity(pet)}</b><small>货架占用</small></div><div><b>{m.revenue}</b><small>累计营业收入</small></div><div><b>{m.premium}</b><small>其中增值收入</small></div></div><div className="community-actions"><button className="primary-button" onClick={() => update(p => setCommunityMarketOpen(p, !m.open))}>{m.open ? '闭店，保留货品' : '开店营业'}</button>{m.level < 3 && <button className="secondary-button" disabled={!free || pet.coins < (m.level === 1 ? 300 : 500) || (pet.inventory.community_wood ?? 0) < 4 || (pet.inventory.community_stone ?? 0) < 2} onClick={() => update(p => upgradeCommunityMarket(p, m.level))}>扩建：{m.level === 1 ? 300 : 500} 金币＋木 4＋石 2</button>}</div><p className="community-muted">扩建每级容量 +3，新上架报价 +5 个百分点；已有批次不变。累计售出 {m.sold} 份，客流 {m.visitors} 人。</p>
        <div className="community-shelves">{m.listings.length ? m.listings.map(listing => <article key={listing.id}><div><b>{name(listing.itemId)} ×{listing.quantity}</b><small>固定单价 {listing.unitPrice} · 上架时增值 {listing.bonus}%{listing.collector ? ' · 等待收藏买家' : ''}</small></div><button className="secondary-button" disabled={!free} onClick={() => update(p => unlistCommunityGoods(p, listing.id))}>下架剩余</button></article>) : <p>货架还是空的，挑一些余量上架吧。</p>}</div>
      </> : <p className="community-note">菜地或钓鱼小屋开放后，可在“社区建设”修复小摊。工会回收和保留设置现在就能使用。</p>}
    </section>
    <section className="community-card"><h3>仓库余量与自用保留</h3><p>保留量限制上架和工会回收；做饭、喂食与明确交付仍可使用。已上架货品需要先下架，才会回到自用库存。</p>{id && quote ? <>
      <div className="community-form-row"><label>选择物品<select value={id} onChange={e => choose(e.target.value)}>{goods.map(itemId => <option key={itemId} value={itemId}>{name(itemId)} ×{pet.inventory[itemId]}</option>)}</select></label><label>本次数量<input type="number" min={1} max={99} value={quantity} onChange={e => { setQuantity(Math.max(1, Math.min(99, Math.floor(Number(e.target.value)) || 1))); setSellReview(undefined); }} /></label></div>
      <p>仓库 {held} · 已保留 {m.reserve[id] ?? 0} · 可售 {available} · 工会基价 {quote.base} 金币／份</p>
      <div className="community-form-row"><label>保留数量<input aria-label="自用保留数量" type="number" min={0} max={9999} value={reserve?.id === id ? reserve.value : m.reserve[id] ?? 0} onChange={e => setReserve({ id, value: Math.max(0, Math.min(9999, Math.floor(Number(e.target.value)) || 0)) })} /></label><button className="secondary-button" onClick={() => { update(p => setCommunityReserve(p, id, reserve?.id === id ? reserve.value : m.reserve[id] ?? 0)); setSellReview(undefined); }}>保存保留量</button></div>
      {!quote.exchangeOnly && <p className="community-note">新上架 {quote.price} 金币／份 = 基价 {quote.base} ×（100%＋基础 20%＋知识 {quote.knowledge}%＋建设 {quote.building}%），向下取整。{quote.collector ? '需要收藏买家。' : ''}食物恢复加成不乘入售价。</p>}
      <div className="community-actions">{!quote.exchangeOnly && <button className="primary-button" disabled={!free || !m.level || quantity > available || quantity + occupied > getMarketCapacity(pet)} onClick={() => update(p => listCommunityGoods(p, id, quantity, m.nextListingId))}>按 {quote.price}／份上架 ×{quantity}</button>}<button className="secondary-button" disabled={!free || quantity > available} onClick={() => setSellReview({ id, quantity, stock: held })}>{quote.exchangeOnly ? '查看金币堆兑换' : '查看工会回收'} · {quote.base * quantity} 金币</button></div>
      {sellReview && sellReview.id === id && <div className="community-sale-review"><p>将消耗 {name(id)} ×{sellReview.quantity}，得到 {quote.base * sellReview.quantity} 金币。出售后余量 {held - sellReview.quantity}，自用保留 {m.reserve[id] ?? 0}。</p><button className="primary-button" disabled={!free || held !== sellReview.stock || sellReview.quantity > available} onClick={() => { update(p => sellCommunityGuild(p, id, sellReview.quantity, sellReview.stock)); setSellReview(undefined); }}>确认{quote.exchangeOnly ? '兑换' : '回收'}</button><button className="text-button" onClick={() => setSellReview(undefined)}>取消</button></div>}
    </> : <p>暂无可出售余量。收获种养产物或鱼获后再来；免费赠品、关键发现、工具与未定义回收价的物品不参与交易。</p>}<button className="text-button" onClick={onShop}>去商店补充生产用品</button></section>
    <section className="community-card"><h3>最近的营业记录</h3>{m.log.length ? <ul className="community-ledger">{m.log.map((entry, index) => <li key={`${entry.at}:${index}`}><span>{name(entry.itemId)} ×{entry.quantity}<small>{new Date(entry.at).toLocaleString('zh-CN', { hour12: false })}</small></span><b>+{entry.coins} 金币</b></li>)}</ul> : <p>还没有成交。收入直接进入钱包，这里保留最近 8 笔。</p>}</section>
  </>;
};
