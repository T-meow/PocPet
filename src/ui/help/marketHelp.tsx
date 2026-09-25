import { marketStackLimit, marketMinVisitMs, marketMaxVisitMs } from '../../core/communityMarketRules';
import type { HelpContent } from './HelpButton';
import type { ItemId, PetState } from '../../core/petTypes';
import { getInventoryItem } from '../../core/items';
import { getMarketBuyoutBonus, getMarketQuote } from '../../core/communityMarket';
import { getCuisineSaleNote } from '../../core/communityEconomy';

export const marketHelp: HelpContent = {
  title: '小摊经营',
  overview: <><p>选择数量上架，等待客人购买；当前报价与预计收入在上架时显示。未售商品可从管理货架中取回。</p><p>每格最多 {marketStackLimit} 份。同类商品优先补入未满栏位，并沿用该栏位的原售价。</p><p>闭店暂停客流，离线期间仍会售卖已上架商品。扩建可以增加栏位并提高新栏位报价。</p></>,
  details: <><p>每隔 {marketMinVisitMs / 60000}–{marketMaxVisitMs / 60000} 分钟来一位客人：普通客人 50%、美食客人 25%、收藏客人 15%、慷慨游客 10%。</p><p>低价货更容易成交，高价料理、食材和珍宝需要多等一会；客人也可能逛一逛就离开。常规成交购买 1–3 份，收藏客人优先挑选收藏品。慷慨游客有机会一次购买 8–20 份，也偶尔会全部买下；整批货品价值越高，大单和包场越难遇到。</p><p>烹饪技能从 Lv.2 起每级提高包场成交机会 5%，最高 +45%；鎏金社区铭牌每级再提高 5%，最高 +50%。两项相加，最高 +95%，用于提高高价值整摊货品的包场机会；实际成交概率最多 100%。</p><p>每级扩建增加 3 格，新上架报价增加 5 个百分点；补货仍沿用原价。招牌加价在摆摊报价上额外计算，采购转售与自产同名商品使用相同报价。成交速度按加成前的基础售价计算，提高报价加成不会减慢销售。</p></>,
};
export const getMarketItemHelp = (pet: PetState, itemId: ItemId): HelpContent => {
  const quote = getMarketQuote(pet, itemId), saleNote = getCuisineSaleNote(itemId), buyout = getMarketBuyoutBonus(pet);
  return { title: (getInventoryItem(itemId)?.name ?? '商品') + '上架', overview: <>{marketHelp.overview}{saleNote && <p>{saleNote}</p>}</>, details: <>{quote && <p>每份基础售价 {quote.base} 金币 · 新上架报价 {quote.price} 金币。补货报价以原栏位为准。</p>}<p>当前包场机会加成：烹饪 +{buyout.cooking}% · 鎏金社区铭牌 +{buyout.decoration}%，合计 +{buyout.total}%。</p>{marketHelp.details}</> };
};
