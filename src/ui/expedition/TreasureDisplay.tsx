import { decorationIcons } from '../../decorationAssets';
import { buildCommunityDecoration } from '../../core/communityDecorations';
import { communityDecorations, communityDecorationIds } from '../../core/regionalTreasures';
import { getCommunitySale } from '../../core/communityEconomy';
import { getInventoryItem } from '../../core/items';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';

export const TreasureDisplay = ({ pet, update }: Pick<ExpeditionProps, 'pet' | 'update'>) => <section className="exp-card exp-collection">
  <h3>珍宝展台 · {pet.community.decorations.length}/{communityDecorationIds.length}</h3>
  <p>把旅途中的闪光留在社区。每款装饰建造一次，永久陈列；提交会消耗实物，也可以把珍宝留着收藏、回收或摆摊。</p>
  <div>{communityDecorationIds.map(id => {
    const d = communityDecorations[id], built = pet.community.decorations.includes(id);
    const ready = Object.entries(d.items).every(([item, count]) => (pet.inventory[item] ?? 0) >= count);
    return <article key={id} data-built={built} style={{ alignItems: 'start' }}>
      <img src={decorationIcons[id]} alt="" width={56} height={56} style={{ opacity: built ? 1 : .55 }} />
      <div><b>{built ? '✦ 已陈列 · ' : ''}{d.name}</b><small>{d.description}</small>
        {built ? <small>永久装饰 · 同类珍宝仍可出售</small> : <><small>{Object.entries(d.items).map(([item, count]) => `${getInventoryItem(item as ItemId)?.name} ${pet.inventory[item] ?? 0}/${count}`).join(' · ')}</small>
          <small>珍宝回收价 {getCommunitySale(d.material)?.base} 金币；建造后实物转为永久装饰。</small>
          <button className="exp-secondary" disabled={!ready || pet.timePause !== undefined || !canSpendCompanionTime(pet)} onClick={() => update(p => buildCommunityDecoration(p, id))}>提交材料，建造{d.name}</button></>}
      </div>
    </article>;
  })}</div>
</section>;
