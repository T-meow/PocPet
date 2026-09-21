import { itemIcons, unknownItemIcon } from '../../assets';
import { getInventoryItem } from '../../core/items';
import { canSpendCompanionTime } from '../../core/kitchen';
import { facilities } from '../../core/communityData';
import { getCommunityUpgradeQuote, upgradeRegionNames, type CommunityUpgradeId } from '../../core/communityUpgradeData';
import { upgradeCommunityFacility } from '../../core/communityUpgrades';
import { regionalTreasures, type RegionalTreasureId } from '../../core/regionalTreasures';
import type { ItemId } from '../../core/petTypes';
import type { CommunityPanelProps } from './types';
import { CommunityDetailDialog } from './CommunityDetailDialog';

type UpgradeProps = Pick<CommunityPanelProps, 'pet' | 'update' | 'registry' | 'itemIconMap'> & { id: CommunityUpgradeId };

export const CommunityUpgradeDialog = ({ onClose, ...props }: UpgradeProps & { onClose: () => void }) => <CommunityDetailDialog
  title={`${props.id === 'garden' ? '菜地' : facilities[props.id].name}建设`} eyebrow="建设与扩建 · 永久保留" onClose={onClose}>
  <CommunityUpgradeTask {...props} />
</CommunityDetailDialog>;

export const CommunityUpgradeTask = ({ pet, update, id, registry, itemIconMap }: UpgradeProps) => {
  const quote = getCommunityUpgradeQuote(pet, id), { task } = quote;
  if (!task) return <p className="community-note">已完成全部扩建 · Lv.{quote.level}</p>;
  const source = (item: string) => item === 'community_wood' || item === 'community_stone' ? '商店购买／溪谷建材采集'
    : item in regionalTreasures ? `${upgradeRegionNames[regionalTreasures[item as RegionalTreasureId].region]} · 宝石勘探`
      : `${upgradeRegionNames[task.region]} · ${item === 'bamboo_shoot' || item === 'wild_onion' ? '食材调查' : '定向采集'}`;
  return <section className="community-upgrade-task" aria-label={task.name}>
    <div className="community-section-heading"><h3>{task.name}</h3><span className="community-tag">一次性建设</span></div>
    <p>{task.effect}。</p><p className="community-muted">完成{upgradeRegionNames[task.region]}故事后可交付；物资可提前收集，不占每日委托名额。</p>
    <div className="community-upgrade-materials">
      <div data-enough={pet.coins >= task.coins}><span aria-hidden="true">🪙</span><strong>金币</strong><b>{pet.coins} / {task.coins}</b><small>委托／探索／经营</small></div>
      {Object.entries(task.items).map(([item, amount]) => <div key={item} data-enough={(pet.inventory[item] ?? 0) >= amount}>
        <img src={itemIconMap?.[item] ?? itemIcons[item as keyof typeof itemIcons] ?? unknownItemIcon} alt="" />
        <strong>{registry?.get(item)?.name ?? getInventoryItem(item as ItemId)?.name ?? item}</strong><b>{pet.inventory[item] ?? 0} / {amount}</b><small>{source(item)}</small>
      </div>)}
    </div>
    {quote.reason && <p className="community-note">{quote.reason}</p>}
    <button className="primary-button" disabled={Boolean(pet.timePause) || !canSpendCompanionTime(pet) || !quote.ready} onClick={() => update(p => upgradeCommunityFacility(p, id, quote.level))}>交付全部物资 · 完成建设</button>
  </section>;
};
