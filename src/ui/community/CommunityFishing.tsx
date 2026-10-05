import { Crown } from 'lucide-react';
import { fishingCatchHearts } from '../../core/activityHearts';
import { fish, fishIds, isWaterOpen, waterIds, waters } from '../../core/communityData';
import type { WaterId } from '../../core/communityTypes';
import { rarityNames } from '../../core/foodCatalog';
import { canSpendCompanionTime } from '../../core/kitchen';
import { communityItemIcons } from '../../communityAssets';
import type { CommunityPanelProps } from './types';
import { getFishingLevelEffects } from '../../core/communityUpgradeData';
import { getFishCrownThreshold } from '../../core/fishingRules';
import { CommunityUpgradeTask } from './CommunityUpgradeTask';
import '../../styles/fishing.css';
import { HelpButton } from '../help/HelpButton';
import { fishingHelp } from '../help/fishingHelp';

// The operation dialog lives in FishingDialog; this component contains the separate hut pages.
export const CommunityFishing = ({ pet, update, onAdventure, onFishing, registry, itemIconMap, view = 'all' }: CommunityPanelProps & { view?: 'all' | 'management' | 'journal'; onFishing?: (water: WaterId) => void }) => {
  const c = pet.community, f = c.fishing, free = canSpendCompanionTime(pet) && !pet.timePause;
  const level = c.upgrades.fishing_hut, effects = getFishingLevelEffects(level);
  return <>
    <HelpButton {...fishingHelp} />
    {(view === 'all' || view === 'management') && <section className="community-card">
      <h3>钓鱼小屋 · Lv.{level}</h3><p>手动每竿体力 {effects.energy}、饱食 {effects.hunger}，基础等待 {effects.waitSeconds} 秒。所有已开放水域通用；手动和挂机每条鱼另得 {fishingCatchHearts} 心心，随鱼获领取。</p>
      <CommunityUpgradeTask pet={pet} update={update} id="fishing_hut" registry={registry} itemIconMap={itemIconMap} />
      <h3>水域开放</h3><p>钓鱼小屋建成后，已通关的对应水域永久直通，无需另交金币或建材。</p>
      {waterIds.map(id => {
        const open = isWaterOpen(pet, id), water = waters[id];
        return <article className="community-card" key={id}><b>{water.name} · {open ? '已永久直通' : '待通关开放'}</b><p>{water.discovery}</p>{open && onFishing && <button className="primary-button" onClick={() => onFishing(id)}>去{water.name}钓鱼</button>}</article>;
      })}
      {onAdventure && <button className="secondary-button" disabled={!free} onClick={onAdventure}>去前哨探索新水域</button>}
    </section>}
    {(view === 'all' || view === 'journal') && <section className="community-card"><div className="community-section-heading"><h3>鱼类手账 · {Object.keys(f.journal).length}/{fishIds.length}</h3><span className="fish-journal-crown"><Crown size={18} />金冠 {Object.values(f.journal).filter(entry => entry?.goldCrown).length}/{fishIds.length}</span></div><div className="community-fish-book">{fishIds.map(id => {
      const record = f.journal[id];
      return <article key={id} data-known={Boolean(record)} data-crown={record?.goldCrown === true}><img src={communityItemIcons[id]} alt="" /><b>{record ? fish[id].name : '尚未遇见'}</b><small>{waters[fish[id].water].name} · {rarityNames[fish[id].rarity]} · {fish[id].rare ? '观赏收藏' : '料理食材'}</small><span>个人最大：{record ? record.largest + ' cm' : '—'}</span><small>金冠门槛：超过 {getFishCrownThreshold(id)} cm</small>{record?.goldCrown && <span className="fish-journal-crown"><Crown size={18} />已获金冠</span>}{record && <small>累计 {record.count} 条 · 初见 {new Date(record.firstAt).toLocaleDateString('zh-CN')}</small>}</article>;
    })}</div></section>}
  </>;
};
