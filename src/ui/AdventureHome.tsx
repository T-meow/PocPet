import { ArrowRight, Backpack, BookOpen, ClipboardList, Compass, Gift, Map, ShoppingBag, Tent } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import { regionIds, regions } from '../core/expeditionData';
import { completedLandmark, landmarkId, landmarkNames, landmarkNodes, mainStoryProgress, mapRegionForExpedition, nextLandmarks, regionNames } from '../core/landmarkProgress';
import { getAdventureRouteNode } from '../core/valleyQuests';
import { landmarkSummary } from '../core/landmarkData';
import { isAdventureMapUnlocked } from '../core/adventureState';
import { getEffectiveDailyDateKey } from '../core/gameClock';
import { AdventureHall, type AdventureCompanion } from './AdventureCompanions';
import { AdventureCompanionStatus, AdventureLandscape } from './AdventurePresentation';
import type { OutpostRequest } from './outpostNavigation';

export const AdventureHome = ({ pet, actor, roster, primaryLabel, onPrimary, onMap, onJournal, onTasks, onSupplies, onStarter, onOutpost }: {
  pet: PetState; actor: AdventureCompanion; roster: readonly AdventureCompanion[]; primaryLabel: string;
  onPrimary: () => void; onMap: () => void; onJournal: () => void; onSupplies: () => void; onStarter: () => void; onOutpost: (request: OutpostRequest) => void;
  onTasks: () => void;
}) => {
  const story = mainStoryProgress(pet.adventure), next = nextLandmarks(pet.adventure)[0];
  const unlocked = isAdventureMapUnlocked(pet.adventure);
  const traveling = Boolean(pet.adventure.active || pet.community.expedition.active);
  const pending = Boolean(pet.adventure.pending || pet.community.expedition.pending);
  const trip = pet.adventure.active, expedition = pet.community.expedition, idle = expedition.active;
  const recent = [
    ...[...pet.adventure.journal, ...(pet.adventure.pending ? [pet.adventure.pending] : [])].map(entry => ({
      at: entry.endedAt, region: entry.region === 'tutorial' ? 'valley' as const : entry.region, node: getAdventureRouteNode(entry.purpose),
    })),
    ...[expedition.lastReceipt, expedition.pending].flatMap(entry => entry ? [{
      at: entry.at, region: mapRegionForExpedition[entry.route[entry.route.length - 1] ?? 'valley'], node: 'camp' as const,
    }] : []),
  ].sort((a, b) => b.at - a.at)[0];
  const region = trip ? trip.region === 'tutorial' ? 'valley' : trip.region : idle ? mapRegionForExpedition[idle.route[idle.leg] ?? idle.route[0] ?? 'valley'] : recent?.region ?? next?.region ?? 'valley';
  const node = trip ? getAdventureRouteNode(trip.purpose) : idle ? 'camp' : recent?.node ?? next?.node ?? 'camp';
  const count = landmarkNodes.filter(id => completedLandmark(pet.adventure, region, id)).length;
  const nextTitle = !unlocked ? '新手踩点' : next ? landmarkNames[next.region][next.node] : '下一段旅途';
  const nextCaption = !unlocked ? '从第一步开始，熟悉行囊与探索。' : next ? landmarkSummary(landmarkId(next.region,next.node)).name : '五地的故事已经记下，再去看看新的发现。';
  return <div className="exploration-home-layout">
    <div className="exploration-home-main">
      <AdventureHall actor={actor} roster={roster} day={getEffectiveDailyDateKey(pet)} traveling={traveling} />
      <button className="exploration-starter campaign-home-entry" onClick={onTasks}><ClipboardList size={24} /><span><strong>去山上吃顿饭</strong><small>{pet.adventure.campaign.tasks[30] ? '聚餐结束了，翻翻一起准备的那些事' : Object.values(pet.adventure.campaign.tasks).some(record => record && !record.claimedAt) ? '有办妥的事，去收下伙伴的心意' : pet.adventure.campaign.startedAt ? `聚餐准备 ${Object.keys(pet.adventure.campaign.tasks).length} / 30 · 看看接下来做什么` : '邻居们想聚餐，来一起准备吧'}</small></span><ArrowRight size={20} /></button>
      {(!pet.adventure.starterClaimed || !pet.adventure.starterMealsClaimed) && <button className="exploration-starter" onClick={onStarter}><Gift size={22} /><span><strong>领取入门补给</strong><small>备好第一趟旅途的料理 ×4</small></span><ArrowRight size={20} /></button>}
      {regionIds.filter(id => pet.community.expedition.regions[id].surveyed).map(id => <section className="exploration-camp-prompt" key={id}><span><Tent size={19} /><strong>{regions[id].name} · 地标 8/8</strong></span><button onClick={() => onOutpost({view:pet.community.expedition.regions[id].base ? 'idle' : 'camp',region:id})}>{pet.community.expedition.regions[id].base ? '安排挂机采集' : '修复营地，开启挂机'}<ArrowRight size={16} /></button></section>)}
    </div>
    <aside className="exploration-home-departure exploration-panel">
      <div className="exploration-section-heading"><strong>{pending ? '平安归来' : traveling ? '当前旅途' : '下一站'}</strong><span className="exploration-tag">{pending ? '待领取' : traveling ? '进行中' : '手动探索'}</span></div>
      <h3 className="exploration-destination-name">{pending ? '收好这趟的发现' : traveling ? '伙伴正在路上' : nextTitle}</h3>
      <p className="exploration-muted">{pending ? '把旅途的物资带回家，再开始新的故事。' : traveling ? '旅途进度已经保存，随时继续。' : nextCaption}</p>
      <AdventureLandscape region={region} node={node} label={`${!traveling && !pending && recent ? '最近探索 · ' : ''}${regionNames[region]}`} />
      <div className="exploration-chapter-progress"><div><span>{regionNames[region]}地标</span><strong>{count} / 8</strong></div><div className="exploration-progress-segments" role="progressbar" aria-label={`${regionNames[region]}地标进度`} aria-valuemin={0} aria-valuemax={8} aria-valuenow={count}>{landmarkNodes.map(id => <i key={id} className={completedLandmark(pet.adventure,region,id) ? 'is-complete' : ''} />)}</div><div><small>主线地标 {story.completed} / {story.total}</small><small>章节 {story.chapters} / 5</small></div></div>
      <AdventureCompanionStatus pet={pet} actor={actor} inlineStats />
      <div className="exploration-departure-actions"><p><Backpack size={18} />{pending ? '仓库装不下的物资会继续保留。' : '带上料理，出门前先整理行囊。'}</p><button className="primary-button" onClick={onPrimary}><Compass size={22} /><span>{!pending && !traveling && unlocked && next ? '准备出发' : primaryLabel}</span><ArrowRight size={20} /></button><button className="secondary-button" onClick={onMap}><Map size={19} />查看地区地图</button><nav className="exploration-home-utilities" aria-label="旅途工具"><button type="button" onClick={onJournal}><BookOpen size={17} />旅行日志</button><button type="button" onClick={onSupplies}><ShoppingBag size={17} />补给商店</button></nav></div>
    </aside>
  </div>;
};
