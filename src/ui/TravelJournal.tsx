import { useState } from 'react';
import { BookOpen, Check, Compass, X } from 'lucide-react';
import { adventureDiscoveryNames, adventureJourneyName, adventureTaskName, getAdventureStepCount } from '../core/adventureData';
import { expeditionProducts, projectIds, regionIds, regions } from '../core/expeditionData';
import { communityProjects } from '../core/expeditionProjects';
import { getInventoryItem } from '../core/items';
import { rationReturnLines } from '../core/expeditionRationReturn';
import type { RationReturn } from '../core/explorationRations';
import { mapRegions, landmarkNodes, landmarkNames, regionNames, completedLandmark, landmarkId } from '../core/landmarkProgress';
import { landmarkSummary } from '../core/landmarkData';
import { valleyObservationNames } from '../core/valleyExplorationData';
import type { Inventory, ItemId, PetState } from '../core/petTypes';
import { DialogShell } from './DialogShell';
import '../styles/outpost.css';
import type { ExplorationCheckResult } from '../core/explorationChecks';
import { ExplorationCheckSummary } from './ExplorationCheck';
import { adventureTreasureIds } from '../core/adventureItems';

interface TravelRecord {
  id: string; at: number; title: string; status: string; detail?: string;
  coins?: number; hearts?: number; items?: Inventory; lines?: string[]; pending?: 'adventure' | 'expedition';
  lastCheck?: ExplorationCheckResult;
}
const returnLabel = (reason: string) => reason === 'health' ? '安全返程' : reason === 'complete' ? '完成行程' : '提前返回';
const recordLines = (entry: { journal: string[]; rationReturn?: RationReturn; treasureFinds?: import('../core/expeditionTypes').RegionalTreasureFind[]; treasureChance?: number }) => {
  const treasureLines = [...(entry.treasureChance !== undefined ? [`每两小时随机概率 ${entry.treasureChance}%`] : []), ...(entry.treasureFinds ?? []).map(find => `${getInventoryItem(find.item)?.name ?? find.item} ×1 · ${find.guaranteed ? '第 10 次保底获得' : '随机发现'}`)];
  if (!entry.rationReturn) return [...entry.journal, ...treasureLines];
  // Structured food counts also rebuild entries whose display text was shortened or omitted by saving.
  const journal = entry.journal.filter(line => !line.startsWith('提前吃掉了：') && !line.startsWith('吃饱后，把剩余料理分给了路过的邻居 '));
  return [...journal, ...rationReturnLines(entry.rationReturn), ...treasureLines];
};
const dateLabel = (at: number) => new Date(at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

// Receipts can overlap the latest saved record while warehouse space is insufficient.
export const getTravelRecords = (pet: PetState): TravelRecord[] => {
  const records = new Map<string, TravelRecord>();
  const { expedition } = pet.community;
  for (const entry of [...pet.adventure.journal, ...(pet.adventure.pending ? [pet.adventure.pending] : [])]) {
    const pending = pet.adventure.pending?.id === entry.id;
    records.set(entry.id, { id: entry.id, at: entry.endedAt, title: `${entry.actorName} · ${adventureJourneyName(entry.region, entry.purpose)}`,
      status: entry.returnReason === 'health' ? '安全返程' : entry.complete ? '完成探查' : '提前返回',
      detail: `${entry.steps}/${getAdventureStepCount(entry.region, entry.purpose)} 阶段${entry.first ? ' · 首次完成' : ''}`,
      coins: entry.coins, hearts: entry.hearts, items: entry.items, lastCheck: entry.lastCheck, ...(pending ? { pending: 'adventure' as const } : {}),
    });
  }
  if (expedition.lastReceipt) {
    const entry = expedition.lastReceipt;
    records.set(entry.id, { id: entry.id, at: entry.at, title: entry.route.map(id => regions[id].name).join(' → '), status: returnLabel(entry.reason), lines: recordLines(entry), lastCheck: entry.lastCheck });
  }
  if (expedition.pending) {
    const entry = expedition.pending;
    records.set(entry.id, { id: entry.id, at: entry.at, title: `${entry.route.map(id => regions[id].name).join(' → ')} · ${entry.mode === 'idle' ? '挂机探索' : '旧探索返程'}`,
      status: returnLabel(entry.reason), coins: entry.coins, hearts: entry.hearts, items: entry.items, lines: recordLines(entry), lastCheck: entry.lastCheck, pending: 'expedition' });
  }
  return [...records.values()].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
};

export const TravelJournal = ({ pet, onClose, onMap, onReceipt, initialTab = 'records' }: {
  pet: PetState; onClose: () => void; onMap: () => void; onReceipt: (system: 'adventure' | 'expedition') => void; initialTab?: 'records' | 'discoveries';
}) => {
  const [tab, setTab] = useState(initialTab);
  const records = getTravelRecords(pet), expedition = pet.community.expedition;
  const stories = regionIds.filter(id => expedition.regions[id].surveyed);
  const memories = projectIds.filter(id => expedition.projects[id].completed > 0);
  const discoveredProducts = { ...expeditionProducts, ...Object.fromEntries(adventureTreasureIds.map(id => [id, { name: getInventoryItem(id)!.name, glyph: id === 'coin_hoard' ? '🪙' : '✦' }])) };
  const products = Object.entries(discoveredProducts).filter(([id]) => (expedition.collection[id as keyof typeof expedition.collection] ?? 0) > 0);
  const observations = expedition.loop?.observations ?? [];
  return <DialogShell className="outpost-dialog outpost-journal" backdropClassName="outpost-backdrop" labelId="travel-journal-title" onClose={onClose}>
    <header className="outpost-header"><span className="outpost-symbol" data-tone="lilac"><BookOpen size={22} /></span><div><small>前哨基地</small><h2 id="travel-journal-title">旅行日志</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭旅行日志，返回前哨"><X size={21} /></button></header>
    <nav className="outpost-tabs" aria-label="旅行日志内容"><button aria-pressed={tab === 'records'} onClick={() => setTab('records')}>旅途记录</button><button aria-pressed={tab === 'discoveries'} onClick={() => setTab('discoveries')}>故事与发现</button></nav>
    <div className="outpost-scroll">
      {tab === 'records' ? <div className="outpost-form-content">
        <p className="outpost-note">探查记录与最近一次远行，都在这里。<span>已有的地区故事和发现会一直保留。</span></p>
        {!records.length ? <div className="outpost-empty"><Compass size={32} /><h3>第一段旅途，等你出发</h3><p>结束旅途后，在这里查看回程记录。</p><button className="exp-secondary" onClick={onMap}>去地图看看</button></div> : <ol className="travel-timeline">{records.map(entry => <li key={entry.id}><article><div className="travel-record-heading"><time dateTime={new Date(entry.at).toISOString()}>{dateLabel(entry.at)}</time><span data-pending={Boolean(entry.pending)}>{entry.pending ? '物资待领取' : entry.status}</span></div><h3>{entry.title}</h3>{entry.detail && <p>{entry.detail}</p>}
          {(entry.coins !== undefined || entry.hearts !== undefined) && <div className="travel-record-rewards"><span>{entry.coins ?? 0} 金币</span><span>{entry.hearts ?? 0} 心心</span></div>}
          <ExplorationCheckSummary result={entry.lastCheck} />
          {(Object.keys(entry.items ?? {}).length > 0 || Boolean(entry.lines?.length)) && <details className="exp-bag"><summary>查看这一趟的记录</summary>{entry.items && <div className="travel-item-list">{Object.entries(entry.items).filter(([, n]) => n > 0).map(([id, n]) => <span key={id}>{getInventoryItem(id as ItemId)?.name ?? id} ×{n}</span>)}</div>}{entry.lines?.map((line, i) => <p key={i}>{line}</p>)}</details>}
          {entry.pending && <button className="exp-secondary" onClick={() => onReceipt(entry.pending!)}>处理回程物资</button>}
        </article></li>)}</ol>}
      </div> : <div className="outpost-form-content">
        {mapRegions.map(region => <section className="outpost-section" key={region}><h3>{regionNames[region]} · 地标 {landmarkNodes.filter(node => completedLandmark(pet.adventure, region, node)).length}/8</h3><div className="travel-discoveries">{landmarkNodes.filter(node => completedLandmark(pet.adventure, region, node)).map(node => <details key={node}><summary><Check size={16} />{landmarkNames[region][node]}</summary><p>{landmarkSummary(landmarkId(region, node)).outcome}</p></details>)}</div><button className="exp-link-button" onClick={onMap}>打开地图</button></section>)}
        {(['tutorial', 'valley'] as const).map(region => {
          const found = adventureDiscoveryNames(region).filter((_, i) => pet.adventure.discoveries.includes(`${region}:${i}`));
          return found.length > 0 && <section className="outpost-section" key={region}><h3>{region === 'tutorial' ? adventureTaskName(region) : '溪谷地标'}</h3><div className="travel-item-list">{found.map(name => <span key={name}><Check size={14} />{name}</span>)}</div></section>;
        })}
        {stories.length > 0 && <section className="outpost-section"><h3>地区故事</h3><div className="travel-discoveries">{stories.map(id => <details key={id}><summary>{regions[id].glyph} {regions[id].name} · {regions[id].story}</summary><p>{regions[id].storyText}</p><small>{expedition.regions[id].actorName ? `和${expedition.regions[id].actorName}` : ''}{expedition.regions[id].storyAt !== undefined ? ` · ${dateLabel(expedition.regions[id].storyAt!)}` : ''}</small></details>)}</div></section>}
        {observations.length > 0 && <section className="outpost-section"><h3>溪谷见闻 <small>{observations.length}/12</small></h3><div className="travel-item-list">{valleyObservationNames.flatMap((node, index) => ['a', 'b'].flatMap((branch, i) => observations.includes(`${index}:${branch}`) ? <span key={`${index}:${branch}`}>{node[i + 1]}</span> : []))}</div></section>}
        {products.length > 0 && <section className="outpost-section"><h3>发现的物产</h3><div className="travel-products">{products.map(([id, product]) => <article key={id}><span aria-hidden="true">{product.glyph}</span><div><b>{product.name}</b><small>累计发现 {expedition.collection[id as keyof typeof expeditionProducts]} · 仓库 {pet.inventory[id] ?? 0}</small></div></article>)}</div></section>}
        {memories.length > 0 && <section className="outpost-section"><h3>过去的社区回忆</h3><div className="travel-discoveries">{memories.map(id => <details key={id}><summary>{communityProjects[id].memory}</summary><p>{communityProjects[id].name} · 已举办 {expedition.projects[id].completed} 次</p>{expedition.projects[id].actorName && <small>和{expedition.projects[id].actorName}一起</small>}</details>)}</div></section>}
      </div>}
    </div>
  </DialogShell>;
};
