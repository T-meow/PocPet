import { marketStackLimit, marketMinVisitMs, marketMaxVisitMs } from '../../core/communityMarketRules';
import type { HelpContent } from './HelpButton';
import type { ItemId, PetState } from '../../core/petTypes';
import { getInventoryItem } from '../../core/items';
import { getMarketQuote } from '../../core/communityMarket';
import { getCuisineSaleNote } from '../../core/communityEconomy';

export const marketHelp: HelpContent = {
  title: '小摊经营',
  overview: <><p>选择数量上架，等待客人购买；当前报价与预计收入在上架时显示。未售商品可从管理货架中取回。</p><p>每格最多 {marketStackLimit} 份。同类商品优先补入未满栏位，并沿用该栏位的原售价。</p><p>闭店暂停客流，离线期间仍会售卖已上架商品。扩建可以增加栏位并提高新栏位报价。</p></>,
  details: <><p>每隔 {marketMinVisitMs / 60000}–{marketMaxVisitMs / 60000} 分钟来一位客人：普通客人 50%、美食客人 25%、收藏客人 15%、慷慨游客 10%。</p><p>基础食材每次 2–4 份，特产 1–2 份；珍稀食材与高级料理由美食客人购买 1 份，收藏品每次 1–3 份。慷慨游客通常购买 8–20 份，其中 2% 会买下全部余货。</p><p>每级扩建增加 3 格，新上架报价增加 5 个百分点；补货仍沿用原价。实际售价受商品买卖价差限制。</p></>,
};
export const getMarketItemHelp = (pet: PetState, itemId: ItemId): HelpContent => {
  const quote = getMarketQuote(pet, itemId), saleNote = getCuisineSaleNote(itemId);
  return { title: (getInventoryItem(itemId)?.name ?? '商品') + '上架', overview: <>{marketHelp.overview}{saleNote && <p>{saleNote}</p>}</>, details: <>{quote && <p>每份回收 {quote.base} 金币 · 新上架报价 {quote.price} 金币。补货报价以原栏位为准。</p>}{marketHelp.details}</> };
};
