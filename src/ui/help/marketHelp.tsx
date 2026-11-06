import { marketStackLimit, marketMinVisitMs, marketMaxVisitMs, getMarketBuyoutChance } from '../../core/communityMarketRules';
import type { HelpContent } from './HelpButton';
import type { ItemId, ItemRegistry, PetState } from '../../core/petTypes';
import { getInventoryItem } from '../../core/items';
import { getMarketBuyoutBonus, getMarketQuote, getMarketTrafficBonus } from '../../core/communityMarket';
import { getCuisineSaleNote } from '../../core/communityEconomy';
import { formatProbabilityPercent } from '../numberFormat';

export const marketHelp: HelpContent = {
  title: '小摊经营',
  overview: <><p>点击货架槽位选品、补货或改品。小摊初始 6 槽，可扩建至 9 槽，每槽最多 {marketStackLimit} 件；售罄保留选品，补货沿用挂牌价，改品或清空时剩余商品退回仓库。</p><p>金苹果和地图手册不可售卖，其他仓库道具均可上架。右上角的记事本记录营业收入和最近访客，收摊后也能查看。</p><p>雇佣邻居后，伙伴忙碌也能管理货架，并可按槽开启每 5 分钟补满的自动补货。只消耗仓库可用库存，不自动购买；离线继续执行，到期、收摊或冻结时暂停，恢复后重新计时。</p></>,
  details: <><p>至少 6 种有货商品时，正常基础客流为每隔 {marketMinVisitMs / 60000}–{marketMaxVisitMs / 60000} 分钟一位。1–6 种商品分别约为正常客流的 33%、47%、60%、73%、87%、100%；同物品多槽算一种，缺货不计入，无货时暂停来客。</p><p>鎏金社区铭牌、琥珀叶影灯、溪光水景每级分别增加客流 5%、3%、2%，叠加最高 +100%。到访间隔除以「种类倍率 ×（1＋装饰加成）」，种类变化保留已等待比例。</p><p>普通客人 50%、美食客人 25%、收藏客人 15%、慷慨游客 10%。常规购买 1–3 件，收藏客人优先挑选收藏品；慷慨游客购买 4–10 件，其中基础 2% 的机会买下全部余货。</p><p>烹饪从 Lv.2 起每级提高包场机会 5%，最高 +45%；铭牌每级再提高 5%，最高 +50%。两项相加后乘入慷慨游客的基础包场概率。</p><p>已有商品保留基础估值；新增商店用品按正常购买价的 40% 向下取整，至少 1 金币，再叠加售卖加成。最终售价不超过正常商店购买价。饼干按整箱价格除以份数，目前 280÷40＝7 金币／份，基础价与上限都是 7 金币。</p><p>每级扩建增加 3 格，新选品报价增加 5 个百分点；补货沿用原价。采购、自产与免费获得的同名商品使用相同报价。</p></>,
};
export const getMarketItemHelp = (pet: PetState, itemId: ItemId, registry?: ItemRegistry): HelpContent => {
  const quote = getMarketQuote(pet, itemId, registry), saleNote = getCuisineSaleNote(itemId), buyout = getMarketBuyoutBonus(pet), traffic = getMarketTrafficBonus(pet);
  return { title: (getInventoryItem(itemId)?.name ?? '商品') + '上架', overview: <>{marketHelp.overview}{saleNote && <p>{saleNote}</p>}</>, details: <>{quote && <p>每份基础售价 {quote.base} 金币 · 新上架报价 {quote.price} 金币。补货报价以原栏位为准。</p>}<p>当前客流 +{traffic.total}%：铭牌 +{traffic.sign}% · 叶影灯 +{traffic.lantern}% · 水景 +{traffic.fountain}%。</p><p>当前包场机会加成：烹饪 +{buyout.cooking}% · 铭牌 +{buyout.decoration}%，合计 +{buyout.total}%；慷慨游客包场概率约 {formatProbabilityPercent(getMarketBuyoutChance(buyout.total) * 100)}。</p>{marketHelp.details}</> };
};
