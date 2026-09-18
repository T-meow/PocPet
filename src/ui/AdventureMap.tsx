import type { CSSProperties } from 'react';
import { ArrowRight, Backpack, Check, Compass, Flag, Home, Leaf, LockKeyhole, MapPin, MessageCircle, RotateCw, Route, Sprout, Star, Sun, Trees, Waves, Wind, X } from 'lucide-react';
import { adventureStepCount, adventureTaskName, adventureTreasureRewardText, getAdventureRegions } from '../core/adventureData';
import { adventureMapEdges, adventureMapNodes, adventureMapThemes, adventureNodeStatusLabel, getAdventureMapNames, getAdventureNodeStatus, type AdventureNodeId } from '../core/adventureMap';
import type { AdventureRegionId, AdventureState } from '../core/adventureTypes';
import { activityText as L } from '../core/kitchenRecipes';
import { AdventureMapLandscape } from './AdventureMapLandscape';
import { adventureRegionArt, getAdventureNodeScene } from './adventureScenes';
import { DialogShell } from './DialogShell';

export interface AdventureMapSelection { region: AdventureRegionId; node?: AdventureNodeId }
interface Props {
  adventure: AdventureState; selection?: AdventureMapSelection; portrait?: string;
  today?: string;
  landscape: boolean; onToggleLandscape: () => void;
  onSelect: (selection: AdventureMapSelection) => void;
  onPrepare: () => void; onResume: () => void; onCollect: () => void; onClose: () => void;
}
const regionIcons = { valley: Sprout, windmill: Wind, forest: Trees, coast: Waves, observatory: Star };
const nodeIcons = { entrance: Flag, gather: Sprout, ridge: Compass, crossing: Route, lookout: Sun, story: Star, camp: Home, encounter: MessageCircle };

export const AdventureMap = ({ adventure, today, selection, portrait, landscape, onToggleLandscape, onSelect, onPrepare, onResume, onCollect, onClose }: Props) => {
  const regions = getAdventureRegions();
  const region = regions.find(entry => entry.id === selection?.region) ?? regions[0];
  const names = getAdventureMapNames(region.id);
  const theme = adventureMapThemes[region.id];
  const node = selection?.node;
  const status = node ? getAdventureNodeStatus(adventure, region.id, node, today) : undefined;
  const entry = node === 'entrance';
  const scene = node ? getAdventureNodeScene(region.id, node) : undefined;
  const overview = adventureRegionArt[region.id].overview;
  const activeHere = adventure.active?.region === region.id;
  const entranceStatus = getAdventureNodeStatus(adventure, region.id, 'entrance', today);
  const nodeHint = !region.open ? L('这片地区还在筹备中。可以先看看地标，等下一次远行。', 'This region is coming later. Browse its landmarks while you wait.')
    : entry ? L('先熟悉入口附近的路，再向地图深处出发。溪谷六段探查每天可完成一次，凌晨 5 点刷新；未完成可返程重试。', 'Learn the entrance paths before heading deeper. Complete six steps once daily, resetting at 5 a.m.; unfinished trips can be retried.')
      : node === 'encounter' ? L('后续在这里遇见特殊来客，可以用食物引诱、绕路或其他方式应对。遭遇任务筹备中。', 'Future encounters offer food lures, detours and other choices. This task is coming later.')
        : node === 'camp' ? L('地图深处的落脚点，等后续旅程一起发现。营地任务筹备中。', 'A resting place deeper in the region awaits a future journey. Camp tasks are coming later.')
          : L('从入口再往前走，这里会有一段新的探索。该节点的任务正在筹备。', 'A new journey awaits beyond the entrance. This node is coming later.');
  const legacy = activeHere && adventure.active!.rulesVersion < 3;
  const canPrepare = status === 'available' && !adventure.active && !adventure.pending;

  return <DialogShell className="adventure-dialog adventure-map-dialog" backdropClassName="adventure-modal-backdrop" labelId="adventure-map-title" onClose={onClose}>
    <header><div><h3 id="adventure-map-title">{L('探索总地图', 'Exploration map')}</h3><small>{L('选一处地标，开启下一段旅程', 'Choose a landmark for your next journey')}</small></div>
      <div className="adventure-map-header-actions"><button className="secondary-button" onClick={onToggleLandscape} aria-pressed={landscape}><RotateCw size={16} />{landscape ? L('自动方向', 'Auto orientation') : L('横屏查看', 'Landscape')}</button><button className="icon-button" onClick={onClose} aria-label={L('关闭地图，回到原场景', 'Close map and return to the scene')}><X size={20} /></button></div>
    </header>
    <div className="adventure-map-body" style={{ '--map-color': theme.color, '--map-pale': theme.pale } as CSSProperties}>
      <nav className="adventure-map-regions" aria-label={L('选择大地图', 'Choose a region')}>
        {regions.map((item, i) => { const Icon = regionIcons[item.id]; return <button key={item.id} onClick={() => onSelect({ region: item.id })} aria-pressed={item.id === selection?.region} style={{ '--tab-color': adventureMapThemes[item.id].color, '--tab-pale': adventureMapThemes[item.id].pale } as CSSProperties}>
          <Icon size={21} /><span><small>0{i + 1}</small><strong>{item.name}</strong></span>{!item.open && <LockKeyhole size={13} aria-label={L('筹备中', 'Coming later')} />}
        </button>; })}
      </nav>
      <div className="adventure-map-layout">
        <section className="adventure-map-chart" aria-label={region.name + L('地标与路线', ' landmarks and routes')}>
          <div className="adventure-map-frame"><div className="adventure-map-canvas" data-region={region.id}>
            {overview ? <img className="adventure-map-landscape" src={overview} alt="" /> : <AdventureMapLandscape region={region.id} />}
            <div className="adventure-map-watermark">{region.name}<small>POCKET FIELD NOTES</small></div>
            <svg className="adventure-map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{adventureMapEdges.map(([from, to]) => {
              const a = adventureMapNodes.find(node => node.id === from)!; const b = adventureMapNodes.find(node => node.id === to)!;
              return <line key={from + to} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />;
            })}</svg>
            {adventureMapNodes.map(node => {
              const state = getAdventureNodeStatus(adventure, region.id, node.id, today); const Icon = node.id === 'story' ? regionIcons[region.id] : nodeIcons[node.id];
              return <button className="adventure-map-node" key={node.id} data-node={node.id} data-status={state} aria-pressed={node.id === selection?.node} aria-label={names[node.id] + ' · ' + adventureNodeStatusLabel(state)} style={{ left: node.x + '%', top: node.y + '%' }} onClick={() => onSelect({ region: region.id, node: node.id })}>
                <span className="adventure-map-pin"><Icon size={20} />{state === 'complete' ? <Check className="adventure-map-node-mark" size={12} /> : state === 'planned' || state === 'locked' ? <LockKeyhole className="adventure-map-node-mark" size={11} /> : null}</span>
                <span className="adventure-map-node-label">{names[node.id]}</span>{state === 'current' && <small>{L('我们在这里', 'We are here')}</small>}
              </button>;
            })}
            <div className="adventure-map-companion">{portrait && <img src={portrait} alt="" />}<span>{activeHere ? L('入口附近，慢慢探查。', 'Scouting around the entrance.') : entranceStatus === 'available' ? L('准备好了，就出发吧。', 'Ready for a little journey.') : L('一起看看远方的路。', 'Let’s look at the paths ahead.')}</span></div>
          </div></div>
          <footer><span><MapPin size={14} />{L('点击地标查看任务', 'Select a landmark')}</span><span>{activeHere ? `${L('入口探查', 'Entrance')} ${adventure.active!.choices.length}/${adventureStepCount}` : !region.open ? L('地区筹备中', 'Region coming later') : adventureNodeStatusLabel(entranceStatus)}</span></footer>
        </section>
        <section className="adventure-map-detail" aria-label={L('节点任务详情', 'Landmark task details')} aria-live="polite" data-selected-node={node}>
          {node && status ? <><div className="adventure-map-detail-heading"><span className="adventure-map-status" data-status={status}>{status === 'planned' || status === 'locked' ? <LockKeyhole size={14} /> : status === 'complete' ? <Check size={14} /> : <Leaf size={14} />}{adventureNodeStatusLabel(status)}</span><small>{region.name}</small></div>
          <h4>{names[node]}</h4>
          {scene && <img className="adventure-map-scene-preview" src={scene} alt={names[node] + L('场景', ' scene')} />}
          <h5>{entry ? adventureTaskName() : L('后续探索', 'Further exploration')}</h5><p>{nodeHint}</p>
          {entry && region.open && <div className="adventure-map-task-summary"><span>{L('6 段 · 每天一次 · 凌晨 5 点刷新', '6 steps · Once daily · Resets at 5 a.m.')}</span>{legacy ? <small>{L('本趟沿用出发时的消耗与奖励。', 'This trip keeps its original costs and rewards.')}</small> : <><small>{L('饱食度 300～345 · 体力 74～98', '300–345 hunger · 74–98 energy')}</small><small>{adventureTreasureRewardText(activeHere ? adventure.active!.rulesVersion : 4)}</small></>}</div>}</> : <><MapPin size={28} /><h4>{L('尚未选择目的地', 'No destination selected')}</h4><p>{L('点击地图上的具体地标，查看行程消耗与奖励，再整备出发。', 'Select a landmark on the map, review its costs and rewards, then prepare to leave.')}</p></>}
          <div className="adventure-map-detail-actions">
            {adventure.active ? <button className="primary-button" onClick={onResume}><ArrowRight size={17} />{L('继续当前探查', 'Resume current scouting')}</button>
              : adventure.pending ? <button className="primary-button" onClick={onCollect}><Backpack size={17} />{L('先领取上次行囊', 'Collect your previous bag')}</button>
                : <button className="primary-button" disabled={!canPrepare} onClick={canPrepare ? onPrepare : undefined}><Backpack size={17} />{!node ? L('先选择目的地', 'Choose a destination first') : canPrepare ? L('进入节点 · 整备出发', 'Enter landmark · Pack to leave') : status === 'complete' ? region.id === 'valley' ? L('今日已完成 · 明日再来', 'Done today · Return tomorrow') : L('入口已完成', 'Entrance complete') : status === 'locked' ? adventureNodeStatusLabel(status) : L('任务筹备中', 'Task coming later')}</button>}
            <button className="text-button" onClick={onClose}>{adventure.active ? L('关闭地图', 'Close map') : L('返回基地大厅', 'Return to the hall')}</button>
          </div>
        </section>
      </div>
    </div>
  </DialogShell>;
};
