import { Crown } from 'lucide-react';
import { fish, fishIds, waters } from '../../core/communityData';
import { buildWaterBoardwalk } from '../../core/communityFishing';
import { rarityNames } from '../../core/foodCatalog';
import { canSpendCompanionTime } from '../../core/kitchen';
import { communityItemIcons } from '../../communityAssets';
import type { CommunityPanelProps } from './types';
import { getFishingLevelEffects } from '../../core/communityUpgradeData';
import { getFishCrownThreshold } from '../../core/fishingRules';
import { CommunityUpgradeTask } from './CommunityUpgradeTask';
import '../../styles/fishing.css';

// The operation dialog lives in FishingDialog; this component contains the separate hut pages.
export const CommunityFishing = ({ pet, update, onKitchen, onAdventure, registry, itemIconMap, view = 'all' }: CommunityPanelProps & { view?: 'all' | 'management' | 'journal' | 'recipes' }) => {
  const c = pet.community, f = c.fishing, free = canSpendCompanionTime(pet) && !pet.timePause;
  const level = c.upgrades.fishing_hut, effects = getFishingLevelEffects(level);
  return <>
    {(view === 'all' || view === 'management') && <section className="community-card">
      <h3>钓鱼小屋 · Lv.{level}</h3><p>手动每竿体力 {effects.energy}、饱食 {effects.hunger}，基础等待 {effects.waitSeconds} 秒。所有已开放水域通用。</p>
      <CommunityUpgradeTask pet={pet} update={update} id="fishing_hut" registry={registry} itemIconMap={itemIconMap} />
      <h3>水域与栈道</h3><p>亲自探索发现水域，回小屋修好栈道后永久直通。</p>
      {(['forest_pool', 'coast_pier'] as const).map(id => {
        const access = c.waterAccess[id], cost = waters[id];
        return <article className="community-card" key={id}><b>{cost.name} · {access.built ? '已永久直通' : access.found ? '已发现，待修建' : '尚未发现'}</b><p>{cost.discovery}</p>{access.found && !access.built && <><p>{cost.coins} 金币 · 木料 {cost.wood}（持有 {pet.inventory.community_wood ?? 0}）· 石料 {cost.stone}（持有 {pet.inventory.community_stone ?? 0}）</p><button className="secondary-button" disabled={!free || !c.facilities.fishing_hut.built || !c.expedition.regions[cost.region].surveyed || pet.coins < cost.coins || (pet.inventory.community_wood ?? 0) < cost.wood || (pet.inventory.community_stone ?? 0) < cost.stone} onClick={() => update(p => buildWaterBoardwalk(p, id))}>提交材料，修好栈道</button></>}</article>;
      })}
      {onAdventure && <button className="secondary-button" disabled={!free} onClick={onAdventure}>去前哨探索新水域</button>}
      <details><summary>钓鱼与挂机说明</summary><p>上钩后，普通钓竿收线 4 次、柔韧竿 3 次；抄网减少 1 次，浮漂缩短等待 2 秒。没有限时和脱钩，关闭操作窗保留当前进度，主动收竿不退已用耗材。</p><p>挂机每 15 分钟收获一条鱼，支持 2／4／8 小时。带食物、鱼饵和足够的钓竿耐久，离线也会结算。提前返回会先吃剩余食物，吃不完分给邻居，未用鱼饵保留待领。</p><p>手动和挂机共用鱼池和金冠概率。普通鱼饵在总竿数第 1、4、7……竿遇到当前水域的基础料理鱼；溪流鱼饵提高珍稀鱼抽取权重。图鉴和金冠永久保留。</p></details>
    </section>}
    {(view === 'all' || view === 'recipes') && <section className="community-card"><h3>水边的料理</h3><p>鱼获可以自用、交单，或做成料理。</p><div className="community-actions"><button className="secondary-button" disabled={!free || !c.facilities.fishing_hut.built || !c.herbDiscovered} onClick={() => onKitchen('creek_fish_soup')}>鲫鱼＋香草 → 鲜鱼汤</button><button className="secondary-button" disabled={!free || !c.facilities.fishing_hut.built} onClick={() => onKitchen('carp_rice')}>鲤鱼＋大米 → 焖饭</button><button className="secondary-button" disabled={!free || !c.facilities.upstream.built} onClick={() => onKitchen('river_grill')}>鳟鱼＋胡萝卜 → 烤鱼</button></div></section>}
    {(view === 'all' || view === 'journal') && <section className="community-card"><div className="community-section-heading"><h3>鱼类手账 · {Object.keys(f.journal).length}/{fishIds.length}</h3><span className="fish-journal-crown"><Crown size={18} />金冠 {Object.values(f.journal).filter(entry => entry?.goldCrown).length}/{fishIds.length}</span></div><p>超过每种鱼的金冠门槛，即可永久点亮金冠。首次钓获、累计数量和个人最大长度不会因做菜或出售消失。</p><div className="community-fish-book">{fishIds.map(id => {
      const record = f.journal[id];
      return <article key={id} data-known={Boolean(record)} data-crown={record?.goldCrown === true}><img src={communityItemIcons[id]} alt="" /><b>{record ? fish[id].name : '尚未遇见'}</b><small>{waters[fish[id].water].name} · {rarityNames[fish[id].rarity]} · {fish[id].rare ? '观赏收藏' : '料理食材'}</small><span>个人最大：{record ? record.largest + ' cm' : '—'}</span><small>金冠门槛：超过 {getFishCrownThreshold(id)} cm</small>{record?.goldCrown && <span className="fish-journal-crown"><Crown size={18} />已获金冠</span>}{record && <small>累计 {record.count} 条 · 初见 {new Date(record.firstAt).toLocaleDateString('zh-CN')}</small>}</article>;
    })}</div></section>}
  </>;
};
