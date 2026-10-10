import { Backpack, Heart } from 'lucide-react';
import { currencyIcon, unknownItemIcon } from '../assets';
import { claimAdventureResult } from '../core/adventure';
import { adventureJourneyName } from '../core/adventureData';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import { getAdventureRouteNode } from '../core/valleyQuests';
import type { AdventureResult } from '../core/adventureTypes';
import type { ItemRegistry, PetState } from '../core/petTypes';
import { AdventureReturnSelection } from './AdventureReturnSelection';
import { AdventureLandscape } from './AdventurePresentation';
import { formatInteger } from './numberFormat';

export const AdventureReceipt = ({ pet, result, portrait, registry, icons, update }: {
  pet: PetState; result: AdventureResult; portrait: string; registry: ItemRegistry; icons: Record<string,string>; update: (fn: (pet: PetState) => PetState) => void;
}) => {
  const shortVisit = Boolean(result.campaignVisit || result.museumVisit);
  const title = result.returnReason === 'health' ? '健康不足，已安全返程' : result.museumVisit ? result.complete ? '纪念馆回访已记录' : '平安回来，下次接着记录' : result.campaignVisit ? result.complete ? '这几件事办妥了' : '平安回来，下次接着准备' : result.complete ? '探险成功，欢迎回来' : '平安归来';
  const items = Object.entries(result.items).filter(([,n])=>n>0);
  return <div className="exploration-receipt-layout"><div className="exploration-prep-main">
    <section className="exploration-panel exploration-receipt-hero"><AdventureLandscape region={result.region === 'tutorial' ? 'valley' : result.region} node={getAdventureRouteNode(result.purpose)} portrait={portrait} label="旅途已记下 · 欢迎回家" /><h3>{title}</h3><p>{adventureJourneyName(result.region,result.purpose)} · {result.museumVisit ? `纪念馆回访 ${result.steps}/${result.museumTotal}` : result.campaignVisit ? `聚餐准备 ${result.steps}/${result.campaignTotal}` : `${result.steps} 个阶段`}{result.first ? ' · 首次完成' : ''}</p></section>
    <section className="exploration-panel"><h3>{result.salvage ? '整理返程行囊' : shortVisit ? '这一趟带回的行囊' : '这一趟带回的发现'}</h3>{result.salvage ? <AdventureReturnSelection key={result.id} capacity={getExplorationBagCapacity(pet)} result={result} registry={registry} update={update} /> : <div className="exploration-receipt-items">{items.map(([id,n]) => <div key={id}><img src={icons[id] ?? unknownItemIcon} alt="" /><strong>{registry.get(id)?.name ?? id}</strong><span>×{n}</span></div>)}{!items.length && <p>这次行囊里没有待领取物品，新的经历已经记下了。</p>}</div>}</section>
  </div><aside className="exploration-panel exploration-receipt-summary"><span className="exploration-tag">{result.rewardsClaimed ? '剩余物资' : '待领取'}</span><h3>收好这趟的收获</h3><p>{result.museumVisit ? '回访进度与已交料理已经保存。完成委托后，展品会自动加入纪念馆。' : result.campaignVisit ? '办好的事已经记下。小心心和金苹果到「任务」页领取。' : '旅途成果与地标记录已保存。'}</p>
    {!shortVisit && <div className="exploration-receipt-currency"><div><img src={currencyIcon} alt="" /><span>金币<strong>+{formatInteger(result.rewardsClaimed ? result.coinsRemaining ?? 0 : result.coins)}</strong></span></div><div><Heart size={35} /><span>心心<strong>+{formatInteger(result.rewardsClaimed ? 0 : result.hearts)}</strong></span></div></div>}
    <div className="exploration-receipt-companion"><img src={portrait} alt="" /><strong>{result.actorName}</strong><p>{result.museumVisit ? '一起留下的纪念，会在展柜里慢慢积累。' : result.campaignVisit ? '一起准备的事，还可以在任务册里翻看。' : '一起走过的路，都留在旅行手册里。'}</p></div>{!result.salvage && <button className="primary-button" onClick={() => update(p=>claimAdventureResult(p,result.id))}><Backpack size={22} />{result.rewardsClaimed ? '领取剩余物品' : shortVisit ? '收好返程行囊' : '领取全部收获'}</button>}<p>{result.salvage ? '先选好带回的物资，再领取收获。' : '仓库暂时装不下的物品会继续保留。'}</p>
  </aside></div>;
};
