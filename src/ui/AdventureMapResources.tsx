import { useState } from 'react';
import type { AdventureRegionId } from '../core/adventureTypes';
import { getAdventureMapResources } from '../core/adventureMapResources';
import { expeditionRegionForMap, getLandmarkReason, getRegionUnlockReason, landmarkNames, type LandmarkNode } from '../core/landmarkProgress';
import type { ItemRegistry, PetState } from '../core/pet';

export const AdventureMapResources = ({ pet, region, node, mode, icons, registry }: {
  pet: PetState; region: AdventureRegionId; node?: LandmarkNode; mode: 'manual' | 'idle'; icons: Record<string, string>; registry: ItemRegistry;
}) => {
  const [selected, setSelected] = useState<string>();
  const resources = getAdventureMapResources(pet, region, node, mode);
  const active = resources.find(item => item.id === selected);
  const progress = pet.community.expedition.regions[expeditionRegionForMap[region]];
  const locked = mode === 'manual' && node ? getLandmarkReason(pet.adventure, region, node) : getRegionUnlockReason(pet.adventure, region);
  const availability = locked ? '解锁后可获' : mode === 'idle' && (!progress.surveyed || !progress.base) ? '建好营地后可获' : '可获物品';
  return <div className="adventure-map-resources">
    <div className="adventure-map-resources-heading"><strong>{mode === 'manual' ? '手动' : '挂机'} · {availability}</strong><span>{mode === 'manual' && node ? landmarkNames[region][node] : '当前地区'}</span></div>
    <div className="adventure-map-resource-list" role="group" aria-label="探索物产">
      {resources.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} aria-label={`${registry.get(item.id)?.name ?? item.id}：${item.hint}`} title={`${registry.get(item.id)?.name ?? item.id}：${item.hint}`} onClick={() => setSelected(item.id)}>
        {icons[item.id] ? <img src={icons[item.id]} alt="" draggable={false} /> : <span aria-hidden="true">📦</span>}
      </button>)}
    </div>
    <div className="adventure-map-resource-hint" aria-live="polite">{active ? `${registry.get(active.id)?.name ?? active.id} · ${active.hint}` : '点击道具查看获取方式；向左右滑动查看更多'}</div>
  </div>;
};
