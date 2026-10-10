import { useState } from 'react';
import { ArrowLeft, Backpack, Check, Truck } from 'lucide-react';
import { advanceCampaignVisit, getCampaignStepPreview } from '../core/explorationCampaign';
import { campaignVisits, getCampaignTask, getCampaignReward } from '../core/explorationCampaignData';
import { campaignText, campaignVisitStep, getCampaignDelivery, isCampaignDeliveryValid } from '../core/explorationCampaignState';
import { getAdventureBagCount } from '../core/adventureState';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import { canUseAdventureService } from '../core/adventure';
import { getInventoryItem } from '../core/items';
import type { InstalledPetModSummary } from '../core/mod';
import { getNeighborIdentities } from '../core/neighbors';
import type { Inventory, PetState } from '../core/petTypes';
import { landmarkNames } from '../core/landmarkProgress';
import type { AdventureStoragePanel } from './AdventureStorage';
import { AdventureCompanionStatus, AdventureLandscape } from './AdventurePresentation';
import { CampaignContactBadge, CampaignReward } from './ExplorationTasks';
import { ExplorationSupport } from './expedition/ExplorationSupport';

export const CampaignJourney = ({ pet, portrait, mods, update, move, busy, onStorage, onReturn, onTasks }: {
  pet: PetState; portrait: string; mods: readonly InstalledPetModSummary[]; update: (fn: (p: PetState) => PetState) => void;
  move: (fn: (p: PetState) => PetState) => void; busy: boolean; onStorage: (panel: AdventureStoragePanel) => void; onReturn: () => void; onTasks: () => void;
}) => {
  const [selection, setSelection] = useState<{ step: number; items: Inventory }>();
  const trip = pet.adventure.active;
  if (!trip?.campaign) return null;
  const id = trip.campaign.visitId, visit = campaignVisits[id], state = pet.adventure.campaign;
  const index = campaignVisitStep(state, id), step = visit.steps[index], preview = getCampaignStepPreview(pet, id);
  const contact = state.contacts[visit.region];
  const selected = selection?.step === index ? selection.items : step?.delivery ? getCampaignDelivery(step.delivery, trip.bag) : {};
  const delivery: Inventory = Object.fromEntries(Object.entries(selected).map(([item, count]) => [item, Math.min(count, trip.bag[item] ?? 0)]));
  const valid = isCampaignDeliveryValid(step?.delivery, delivery, trip.bag);
  const reason = step ? preview.reason || (!valid ? '选好这次要交的东西，再继续。' : '') : '';
  const change = (item: string, delta: number) => {
    const count = (delivery[item] ?? 0) + delta;
    if (count < 0 || count > (trip.bag[item] ?? 0)) return;
    setSelection({ step: index, items: { ...delivery, [item]: count } });
  };
  const previous = index > 0 ? visit.steps[index - 1].options.find(option => option.id === state.visits[id]?.[index - 1]) : undefined;
  const task = step?.task ? { ...getCampaignTask(step.task)!, ...getCampaignReward(step.task, state.rewardVersion) } : undefined;
  return <div className="exploration-journey-layout"><div className="exploration-journey campaign-journey">
    <section className="exploration-panel exploration-journey-hero"><ol className="exploration-stage-steps" aria-label="聚餐准备进度">{visit.steps.map((value, n) => <li key={n} className={n < index ? 'is-complete' : n === index ? 'is-current' : ''} aria-current={n === index ? 'step' : undefined}><span>{n < index ? <Check size={15} /> : n + 1}</span><strong>{value.title}</strong></li>)}</ol><AdventureLandscape region={visit.region} node={visit.node} portrait={portrait} label={landmarkNames[visit.region][visit.node]} /></section>
    {previous && <p className="campaign-last-action" role="status">{campaignText(previous.result, state, visit.region)}</p>}
    <section className="exploration-panel campaign-event"><CampaignContactBadge contact={contact} mods={mods} /><h3>{step?.title ?? '这边准备好了'}</h3><p>{step ? campaignText(step.story, state, visit.region) : '先把行囊收好，再看看接下来去哪儿和伙伴碰头。'}</p>
      {step?.delivery && <fieldset className="campaign-delivery"><legend>这次交付 · 共 {step.delivery.amount} 份</legend><p>{step.delivery.items.length > 1 ? '可以搭配选择。交出的饭留给聚餐，路上补给另外使用。' : '确认后会从行囊中取出。'}</p>{step.delivery.items.map(item => <div className="campaign-supply-row" key={item}><span><strong>{getInventoryItem(item)?.name ?? item}</strong><small>行囊有 {trip.bag[item] ?? 0} 份</small></span><div className="campaign-quantity"><button aria-label={`少交一份${getInventoryItem(item)?.name ?? item}`} disabled={busy || !(delivery[item] > 0)} onClick={() => change(item, -1)}>−</button><b>{delivery[item] ?? 0}</b><button aria-label={`多交一份${getInventoryItem(item)?.name ?? item}`} disabled={busy || (delivery[item] ?? 0) >= (trip.bag[item] ?? 0) || getAdventureBagCount(delivery) >= step.delivery!.amount} onClick={() => change(item, 1)}>+</button></div></div>)}<small>已选 {getAdventureBagCount(delivery)} / {step.delivery.amount} 份</small></fieldset>}
      {step && <><p className="campaign-cost">本次消耗：饱食 {preview.hunger[1]} · 体力 {preview.energy[1]}</p>{task && <CampaignReward hearts={task.hearts} apples={task.apples} />}<div className="campaign-event-actions">{step.options.map(option => <button className="primary-button" key={option.id} disabled={busy || Boolean(reason)} onClick={() => move(p => advanceCampaignVisit(p, trip.id, trip.revision, index, option.id, delivery, getNeighborIdentities(mods, trip.actorId)))}>{option.label}</button>)}</div>{reason && <p className="campaign-hint" role="status">{reason}</p>}</>}
      {!step && <button className="primary-button" disabled={busy} onClick={onReturn}>收好东西，返回前哨</button>}
    </section>
    <ExplorationSupport pet={pet} system="adventure" update={update} move={move} busy={busy} />
  </div><aside className="exploration-panel exploration-journey-aside"><div className="exploration-section-heading"><h3>旅途状态</h3><span className="exploration-tag">进度已保存</span></div><AdventureCompanionStatus pet={pet} actor={{ id: trip.actorId, name: trip.actorName, portrait }} /><section className="exploration-journey-bag"><h3>一起准备的这几件事</h3><p>已交的材料、已经办好的事都会记下。中途回家，下次接着做就好。</p><div><span>随身行囊</span><strong>{getAdventureBagCount(trip.bag)} / {getExplorationBagCapacity(pet)}</strong></div><button className="primary-button" disabled={busy} onClick={() => onStorage('bag')}><Backpack size={19} />查看背包／使用补给</button><button className="secondary-button" disabled={busy || !canUseAdventureService(pet)} onClick={() => onStorage('delivery')}><Truck size={18} />请伙伴从仓库送来</button><small>每份 2 小心心，沿用本趟的送货额度。</small><button className="secondary-button" onClick={onTasks}>看看任务与待领心意</button></section><button className="secondary-button exploration-return-button" disabled={busy} onClick={onReturn}><ArrowLeft size={18} />{step ? '先回前哨，下次继续' : '准备好了，返回前哨'}</button></aside></div>;
};
