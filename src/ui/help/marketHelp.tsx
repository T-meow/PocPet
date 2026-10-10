import { marketStackLimit, marketMinVisitMs, marketMaxVisitMs, getMarketBuyoutChance } from '../../core/communityMarketRules';
import type { HelpContent } from './HelpButton';
import type { ItemId, PetState } from '../../core/petTypes';
import { getInventoryItem } from '../../core/items';
import { getMarketBuyoutBonus, getMarketQuote, getMarketTrafficBonus } from '../../core/communityMarket';
import { getCuisineSaleNote } from '../../core/communityEconomy';
import { formatProbabilityPercent } from '../numberFormat';

export const marketHelp: HelpContent = {
  title: '小摊经营',
  overview: <><p>选择数量上架，等待客人购买；当前报价与预计收入在上架时显示。未售商品可从管理货架中取回。</p><p>每格最多 {marketStackLimit} 份。同类商品优先补入未满栏位，并沿用该栏位的原售价。</p><p>闭店暂停客流，离线期间仍会售卖已上架商品。扩建可以增加栏位并提高新栏位报价。</p><p>营业时，场景右下角默认由当前伙伴执勤；伙伴忙碌且邻居服务有效时，改由随机伙伴代班，同次打开期间保持同一位代班伙伴。伙伴空闲或服务到期后恢复当前伙伴，收摊后隐藏。执勤展示不改变营业收益；上架、补货和下架仍需伙伴空闲。</p></>,
  details: <><p>基础每隔 {marketMinVisitMs / 60000}–{marketMaxVisitMs / 60000} 分钟来一位客人：普通客人 50%、美食客人 25%、收藏客人 15%、慷慨游客 10%。</p><p>鎏金社区铭牌、琥珀叶影灯、溪光水景每级分别增加客流 5%、3%、2%，叠加最高 +100%。到访间隔除以「1＋客流加成」，全部满级时为 2–4 分钟。新加成用于下一轮等待，已经在途的客人及闭店保留的等待时间不重排。</p><p>每位客人选好商品后直接按挂牌价购买，价格不影响成交速度。常规购买 1–3 份，收藏客人优先挑选收藏品；慷慨游客购买 4–10 份，其中基础 2% 的机会买下全部余货。</p><p>烹饪从 Lv.2 起每级提高包场机会 5%，最高 +45%；铭牌每级再提高 5%，最高 +50%。两项相加后乘入慷慨游客的基础包场概率，普通购买和大单同样不受货品金额限制。</p><p>每级扩建增加 3 格，新上架报价增加 5 个百分点；补货沿用原价。招牌加价在摆摊报价上额外计算，采购转售与自产同名商品使用相同报价。</p></>,
};
export const getMarketItemHelp = (pet: PetState, itemId: ItemId): HelpContent => {
  const quote = getMarketQuote(pet, itemId), saleNote = getCuisineSaleNote(itemId), buyout = getMarketBuyoutBonus(pet), traffic = getMarketTrafficBonus(pet);
  return { title: (getInventoryItem(itemId)?.name ?? '商品') + '上架', overview: <>{marketHelp.overview}{saleNote && <p>{saleNote}</p>}</>, details: <>{quote && <p>每份基础售价 {quote.base} 金币 · 新上架报价 {quote.price} 金币。补货报价以原栏位为准。</p>}<p>当前客流 +{traffic.total}%：铭牌 +{traffic.sign}% · 叶影灯 +{traffic.lantern}% · 水景 +{traffic.fountain}%。</p><p>当前包场机会加成：烹饪 +{buyout.cooking}% · 铭牌 +{buyout.decoration}%，合计 +{buyout.total}%；慷慨游客包场概率约 {formatProbabilityPercent(getMarketBuyoutChance(buyout.total) * 100)}。</p>{marketHelp.details}</> };
};
