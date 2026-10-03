import { useState } from 'react';
import type { AdventureRegionId } from '../core/adventureTypes';
import { getAdventureMapResources } from '../core/adventureMapResources';
import { expeditionRegionForMap, getLandmarkReason, getRegionUnlockReason, landmarkNames, type LandmarkNode } from '../core/landmarkProgress';
import type { ItemRegistry, PetState } from '../core/pet';
import { DialogShell } from './DialogShell';
import { X } from 'lucide-react';
import { getExplorationResources } from '../core/explorationResources';
import type { OutpostRequest } from './outpostNavigation';

export const AdventureMapResources = ({ pet, region, node, mode, icons, registry, onOutpost }: {
  pet: PetState; region: AdventureRegionId; node?: LandmarkNode; mode: 'manual' | 'idle'; icons: Record<string, string>; registry: ItemRegistry; onOutpost?: (request: OutpostRequest) => void;
}) => {
  const [selected, setSelected] = useState<string>();
  const resources = getAdventureMapResources(pet, region, node, mode);
  const active = resources.find(item => item.id === selected);
  const progress = pet.community.expedition.regions[expeditionRegionForMap[region]];
  const locked = mode === 'manual' && node ? getLandmarkReason(pet.adventure, region, node) : getRegionUnlockReason(pet.adventure, region);
  const availability = locked ? '解锁后可获' : mode === 'idle' && (!progress.surveyed || !progress.base) ? '建好营地后可获' : '可获物品';
  const catalog = getExplorationResources(expeditionRegionForMap[region]);
  const source = catalog.find(resource => resource.id === selected) ?? catalog.find(resource => Object.prototype.hasOwnProperty.call(resource.manual, selected ?? '') || Object.prototype.hasOwnProperty.call(resource.idle ?? {}, selected ?? ''));
  return <div className="adventure-map-resources">
    <div className="adventure-map-resources-heading"><strong>{mode === 'manual' ? '手动' : '挂机'} · {availability}</strong><span>{mode === 'manual' && node ? landmarkNames[region][node] : '当前地区'}</span></div>
    <div className="adventure-map-resource-list" role="group" aria-label="探索物产">
      {resources.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} aria-label={`${registry.get(item.id)?.name ?? item.id}：${item.hint}`} title={`${registry.get(item.id)?.name ?? item.id}：${item.hint}`} onClick={() => setSelected(item.id)}>
        {icons[item.id] ? <img src={icons[item.id]} alt="" draggable={false} /> : <span aria-hidden="true">📦</span>}
      </button>)}
    </div>
    <div className="adventure-map-resource-hint" aria-live="polite">{active ? `${registry.get(active.id)?.name ?? active.id} · ${active.hint}` : '点击道具查看获取方式；向左右滑动查看更多'}</div>
    {active && <DialogShell className="exploration-resource-sheet" labelId="exploration-resource-title" onClose={() => setSelected(undefined)} closeOnBackdrop><header><h3 id="exploration-resource-title">{registry.get(active.id)?.name ?? active.id}</h3><button className="icon-button" aria-label="关闭资源详情" onClick={() => setSelected(undefined)}><X /></button></header><div className="exploration-sheet-body"><p>{active.hint}</p>{source && <><p>{source.research ? '研究进度：使用相应工具稳定增加 2 点。' : '手动产物：' + Object.entries(source.manual).map(([id, n]) => `${registry.get(id)?.name ?? id} ×${n}`).join('、')}</p><p>{source.idle ? '挂机随机抽中后：' + Object.entries(source.idle).map(([id, n]) => `${registry.get(id)?.name ?? id} ×${n}`).join('、') : '此目标通过手动探险取得，不作为挂机采集目标。'}</p></>}{locked && <p>{locked}</p>}</div>{onOutpost && source && <footer><button className="secondary-button" onClick={() => onOutpost({ view: 'manual', region: expeditionRegionForMap[region], node: 'gather', target: source.id })}>前往手动调查</button>{source.idle && <button className="primary-button" onClick={() => onOutpost({ view: 'idle', region: expeditionRegionForMap[region], target: source.id })}>设为挂机采集偏好</button>}</footer>}</DialogShell>}
  </div>;
};
