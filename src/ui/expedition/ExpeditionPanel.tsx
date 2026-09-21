import { Compass, Heart, Sparkles, Tent, Utensils, X, Zap } from 'lucide-react';
import { getPetEnergyCap, getPetStatCap } from '../../core/petStats';
import type { RegionId } from '../../core/expeditionTypes';
import { DialogShell } from '../DialogShell';
import type { OutpostRequest } from '../outpostNavigation';
import type { ExpeditionProps } from './types';
import type { PreparationResources } from '../PreparationInventory';
import { AdventureStatMeter } from '../AdventureStatMeter';
import { ExpeditionCamp } from './ExpeditionCamp';
import { ExpeditionJourney } from './ExpeditionJourney';
import { IdleExpeditionPreparation } from './IdleExpeditionPreparation';
import { RegionPreparation } from './RegionPreparation';
import { ValleyPreparation } from './ValleyPreparation';
import '../../styles/outpost.css';
import '../../styles/valley-loop.css';

export const ExpeditionPanel = (props: ExpeditionProps & PreparationResources & {
  request: Exclude<OutpostRequest, { view: 'journal' }>; onClose: () => void;
  onNavigate: (request: OutpostRequest) => void; onMap: (region: RegionId) => void;
}) => {
  const { pet, request, onClose, onNavigate, onMap } = props;
  const { active, pending } = pet.community.expedition;
  const busy = Boolean(active || pending);
  const preparingIdle = !busy && request.view === 'idle';
  const title = pending ? '收好旅途物资' : active ? active.mode === 'idle' ? '挂机行程' : '当前巡路' : request.view === 'camp' ? '营地建设' : request.view === 'idle' ? '挂机出发' : '巡路整备';
  const cap = getPetStatCap(pet);
  return <DialogShell className={'outpost-dialog' + (preparingIdle ? ' storage-modal adventure-preparation outpost-dialog--idle' : '')} backdropClassName={'outpost-backdrop' + (preparingIdle ? ' outpost-backdrop--preparation' : '')} labelId="outpost-expedition-title" onClose={onClose}>
    <header className="outpost-header"><span className="outpost-symbol" data-tone={request.view === 'camp' ? 'peach' : 'mint'}>{request.view === 'camp' ? <Tent size={22} /> : <Compass size={22} />}</span><div><small>前哨基地</small><h2 id="outpost-expedition-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭旅途窗口，保留进度"><X size={21} /></button></header>
    <div className="outpost-status" data-checks={Boolean(active?.checkState)} aria-label="出行状态"><AdventureStatMeter kind="hunger" label="饱食" value={pet.hunger} max={cap} icon={<Utensils size={14} />} /><AdventureStatMeter kind="energy" label="体力" value={pet.energy} max={getPetEnergyCap(pet)} icon={<Zap size={14} />} /><AdventureStatMeter kind="health" label="健康" value={pet.health} max={cap} icon={<Heart size={14} />} />{active?.checkState && <AdventureStatMeter kind="mood" label="心情" value={pet.mood} max={cap} icon={<Sparkles size={14} />} />}</div>
    <div className={'outpost-scroll' + (preparingIdle ? ' outpost-scroll--preparation' : '')}>
      {busy ? <div className="outpost-form-content"><ExpeditionJourney key={active?.id ?? pending?.id} {...props} />{!pending?.rationReturn && <p className="outpost-note" role="status">{pet.recentEvent}</p>}<button className="exp-link-button" onClick={() => onNavigate({ view: 'journal' })}>查看旅行日志</button></div>
        : request.view === 'idle' ? <IdleExpeditionPreparation key={`${request.region}:${request.target ?? ''}`} {...props} initialRegion={request.region} initialTarget={request.target} onMap={onMap} onCamp={region => onNavigate({ view: 'camp', region })} onRoute={(region, target) => onNavigate({ view: 'route', region, target })} />
          : request.view === 'camp' ? <div className="outpost-form-content"><ExpeditionCamp pet={pet} update={props.update} region={request.region} onMap={() => onMap(request.region)} onGather={() => onNavigate({ view: 'route', region: request.region, target: 'materials' })} onIdle={() => onNavigate({ view: 'idle', region: request.region })} /><p className="outpost-note" role="status">{pet.recentEvent}</p></div>
            : request.region === 'valley' ? <ValleyPreparation key={request.target ?? 'patrol'} {...props} initialTarget={request.target} /> : <RegionPreparation key={request.region} {...props} selected={request.region} />}
    </div>
  </DialogShell>;
};
