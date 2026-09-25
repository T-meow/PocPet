import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Backpack, Check, Leaf, LockKeyhole, MapPin, RotateCw, Tent, X } from 'lucide-react';
import { adventureJourneyCost, getAdventureRegions } from '../core/adventureData';
import { adventureMapEdges, adventureMapNodes, adventureMapThemes, adventureNodeStatusLabel, getAdventureMapNames, getAdventureNodeStatus, type AdventureNodeId } from '../core/adventureMap';
import type { AdventureRegionId, AdventureState } from '../core/adventureTypes';
import { activityText as L } from '../core/kitchenRecipes';
import { AdventureMapLandscape } from './AdventureMapLandscape';
import { adventureLandmarkIcons } from '../adventureLandmarkAssets';
import { DialogShell } from './DialogShell';
import type { ItemRegistry, PetState } from '../core/pet';
import { getRegionUnlocked } from '../core/expeditionData';
import { currentExpeditionRequest, expeditionRegionForMap, type OutpostRequest } from './outpostNavigation';
import { completedLandmark, getLandmarkReason, getRegionUnlockReason, landmarkId, landmarkNodes } from '../core/landmarkProgress';
import { ExplorationHelp } from './help/ExplorationGuide';
import { landmarkDescriptions, landmarkFirstRewardText } from './help/landmarkHelp';
import { AdventureMapResources } from './AdventureMapResources';

export interface AdventureMapSelection { region: AdventureRegionId; node?: AdventureNodeId }
interface Props {
  adventure: AdventureState; selection?: AdventureMapSelection; portrait?: string;
  today?: string;
  landscape: boolean; onToggleLandscape: () => void;
  onSelect: (selection: AdventureMapSelection) => void;
  mode: 'manual' | 'idle'; onMode: (mode: 'manual' | 'idle') => void; preparation?: ReactNode;
   onResume: () => void; onCollect: () => void; onClose: () => void;
  pet?: PetState; onOutpost?: (request: OutpostRequest) => void;
  icons: Record<string, string>; registry: ItemRegistry;
}

export const AdventureMap = ({ adventure, today, selection, portrait, landscape, onToggleLandscape, onSelect, onResume, onCollect, onClose, pet, onOutpost, mode, onMode, preparation, icons, registry }: Props) => {
  const regions = getAdventureRegions();
  const region = regions.find(entry => entry.id === selection?.region) ?? regions[0];
  const expeditionRegion = expeditionRegionForMap[region.id];
  const currentExpedition = pet ? currentExpeditionRequest(pet) : undefined;
  const camp = pet?.community.expedition.regions[expeditionRegion];
  const names = getAdventureMapNames(region.id);
  const theme = adventureMapThemes[region.id];
  const node = selection?.node;
  const status = node ? getAdventureNodeStatus(adventure, region.id, node, today) : undefined;
  const purpose = node ? landmarkId(region.id, node) : undefined;
  const firstReward = purpose && node && !completedLandmark(adventure, region.id, node) ? landmarkFirstRewardText(purpose) : '';
  const activeHere = adventure.active?.region === region.id;
  const entranceStatus = getAdventureNodeStatus(adventure, region.id, 'entrance', today);
  const chapterCount = landmarkNodes.filter(id => completedLandmark(adventure, region.id, id)).length;
  const reason = node ? getLandmarkReason(adventure, region.id, node) : getRegionUnlockReason(adventure, region.id);

  return <DialogShell className="adventure-dialog adventure-map-dialog" backdropClassName="adventure-modal-backdrop" labelId="adventure-map-title" onClose={onClose}>
    <header><div><h3 id="adventure-map-title">{L('探索总地图', 'Exploration map')}</h3><small>{L('选一处地标，开启下一段旅程', 'Choose a landmark for your next journey')}</small></div>
      <div className="adventure-map-header-actions"><button className="secondary-button" onClick={onToggleLandscape} aria-pressed={landscape}><RotateCw size={16} />{landscape ? L('自动方向', 'Auto orientation') : L('横屏查看', 'Landscape')}</button><button className="icon-button" onClick={onClose} aria-label={L('关闭地图，回到原场景', 'Close map and return to the scene')}><X size={20} /></button></div>
    </header>
    <div className="adventure-map-body" style={{ '--map-color': theme.color, '--map-pale': theme.pale } as CSSProperties}>
      <nav className="adventure-map-regions" aria-label={L('选择大地图', 'Choose a region')}>
        {regions.map((item, i) => <button key={item.id} onClick={() => onSelect({ region: item.id })} aria-pressed={item.id === region.id} style={{ '--tab-color': adventureMapThemes[item.id].color, '--tab-pale': adventureMapThemes[item.id].pale } as CSSProperties}>
          <img src={adventureLandmarkIcons[item.id].story} alt="" /><span><small>0{i + 1}</small><strong>{item.name}</strong></span>{(pet ? !getRegionUnlocked(pet, expeditionRegionForMap[item.id]) : !item.open) && <LockKeyhole size={13} aria-label="地区尚未解锁" />}
        </button>)}
      </nav>
      <div className="adventure-map-layout">
        <section className="adventure-map-chart" aria-label={region.name + L('地标与路线', ' landmarks and routes')}>
          <div className="adventure-map-frame"><div className="adventure-map-canvas" data-region={region.id}>
            <AdventureMapLandscape region={region.id} />
            <div className="adventure-map-watermark">{region.name}<small>POCKET FIELD NOTES</small></div>
            <svg className="adventure-map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{adventureMapEdges.map(([from, to]) => {
              const a = adventureMapNodes.find(node => node.id === from)!; const b = adventureMapNodes.find(node => node.id === to)!;
              return <line key={from + to} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />;
            })}</svg>
            {adventureMapNodes.map(node => {
              const state = getAdventureNodeStatus(adventure, region.id, node.id, today);
              return <button className="adventure-map-node" key={node.id} data-node={node.id} data-status={state} aria-pressed={node.id === selection?.node} aria-label={names[node.id] + ' · ' + adventureNodeStatusLabel(state)} style={{ left: node.x + '%', top: node.y + '%' }} onClick={() => onSelect({ region: region.id, node: node.id })}>
                <span className="adventure-map-pin"><img src={adventureLandmarkIcons[region.id][node.id]} alt="" />{state === 'complete' ? <Check className="adventure-map-node-mark" size={12} /> : state === 'planned' || state === 'locked' ? <LockKeyhole className="adventure-map-node-mark" size={11} /> : null}</span>
                <span className="adventure-map-node-label">{names[node.id]}</span>{state === 'current' && <small>{L('我们在这里', 'We are here')}</small>}
              </button>;
            })}
            <div className="adventure-map-companion">{portrait && <img src={portrait} alt="" />}<span>{activeHere ? L('沿着这次的路线，慢慢走。', 'Following our chosen path.') : entranceStatus === 'available' ? L('准备好了，就出发吧。', 'Ready for a little journey.') : L('一起看看远方的路。', 'Let’s look at the paths ahead.')}</span></div>
          </div></div>
          {pet && <AdventureMapResources key={`${region.id}:${node ?? ''}:${mode}`} pet={pet} region={region.id} node={node} mode={mode} icons={icons} registry={registry} />}
          <footer><span><MapPin size={14} />点击地标查看任务</span><span>{region.name} · 地标 {chapterCount}/8</span></footer>
        </section>
        <section className="adventure-map-detail" aria-label={L('节点任务详情', 'Landmark task details')} aria-live="polite" data-selected-node={node}>
          {node && status ? <><div className="adventure-map-detail-heading"><span className="adventure-map-status" data-status={status}>{status === 'planned' || status === 'locked' ? <LockKeyhole size={14} /> : status === 'complete' ? <Check size={14} /> : <Leaf size={14} />}{adventureNodeStatusLabel(status)}</span><small>{region.name}</small></div>
          <div className="help-heading"><h4>{names[node]}</h4>{pet && <ExplorationHelp key={purpose} pet={pet} purpose={purpose} destination={region.id} mode={mode} />}</div>
          <img className="adventure-map-landmark-preview" src={adventureLandmarkIcons[region.id][node]} alt={names[node]} />
          <p>{landmarkDescriptions[region.id][node]}</p>
          {mode === 'manual' && <div className="adventure-map-task-summary"><span>{purpose && adventureJourneyCost(purpose)}</span>{firstReward && <span>首通：{firstReward}</span>}</div>}
          </> : <><MapPin size={28} /><div className="help-heading"><h4>选择一个地标</h4>{pet && <ExplorationHelp pet={pet} mode={mode} />}</div><p>选择模式并整理补给，然后出发。</p></>}
          {reason && <p className="adventure-blocked">{reason}</p>}
          <div className="adventure-mode-switch" role="group" aria-label="探索模式"><button aria-pressed={mode === 'manual'} onClick={() => onMode('manual')}>手动探索</button><button aria-pressed={mode === 'idle'} onClick={() => onMode('idle')}>挂机探索</button></div>
          {pet && onOutpost && <div className="adventure-map-camp-actions"><button className="secondary-button" disabled={chapterCount < 8} onClick={() => onOutpost({ view: 'camp', region: expeditionRegion })}><Tent size={17} />{camp?.base ? `营地建设 · ${camp.base}/2 级` : '完成全部地标后建设营地'}</button></div>}
          {!adventure.active && !adventure.pending && !currentExpedition && (mode === 'idle' || node && !reason) && preparation}
          <div className="adventure-map-detail-actions">
            {adventure.active ? <button className="primary-button" onClick={onResume}><ArrowRight size={17} />{L('继续当前探查', 'Resume current scouting')}</button>
              : adventure.pending ? <button className="primary-button" onClick={onCollect}><Backpack size={17} />{L('先领取上次行囊', 'Collect your previous bag')}</button>
                : currentExpedition && onOutpost ? <button className="primary-button" onClick={() => onOutpost(currentExpedition)}><Backpack size={17} />{pet?.community.expedition.pending ? '先领取旅途物资' : '继续当前旅途'}</button>
                : null}
            <button className="text-button" onClick={onClose}>{adventure.active ? L('关闭地图', 'Close map') : L('返回基地大厅', 'Return to the hall')}</button>
          </div>
        </section>
      </div>
    </div>
  </DialogShell>;
};
