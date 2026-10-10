import { useState } from 'react';
import { ArrowLeft, Backpack, Check, Compass, Search, ShieldCheck, ShoppingBag, Truck, Wrench } from 'lucide-react';
import type { ItemId, PetState } from '../core/petTypes';
import type { DurableToolId } from '../core/fieldEquipmentData';
import { advanceAdventure, canUseAdventureService, getAdventureChoicePreview, getAdventureChoiceReason } from '../core/adventure';
import { getAdventureSteps, adventureJourneyName } from '../core/adventureData';
import { getAdventureStageChoices, type AdventureStageChoice } from '../core/adventureGathering';
import { getAdventureBagCount } from '../core/adventureState';
import { getAdventureRouteNode } from '../core/valleyQuests';
import { getToolUsesLeft } from '../core/toolDurability';
import { getInventoryItem } from '../core/items';
import { getCommunityTasks, commissionDefinitions, canDeliverCommunityParcel, deliverCommunityParcel } from '../core/communityCommissions';
import { ExplorationCheckBuffs, ExplorationCheckSummary, ExplorationChoiceDetails } from './ExplorationCheck';
import { ExplorationSupport } from './expedition/ExplorationSupport';
import { ExplorationHelp } from './help/ExplorationGuide';
import type { AdventureStoragePanel } from './AdventureStorage';
import type { AdventureCompanion } from './AdventureCompanions';
import { getExplorationHarvestPay } from '../core/explorationBudget';
import { expeditionRegionForMap } from '../core/landmarkProgress';
import { formatInteger } from './numberFormat';
import { AdventureCompanionStatus, AdventureLandscape } from './AdventurePresentation';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import { campaignEventVisible } from '../core/explorationCampaignState';
import type { InstalledPetModSummary } from '../core/mod';
import { CampaignJourney } from './CampaignJourney';
import { MuseumJourney } from './MuseumJourney';

const toolDescriptions: Partial<Record<DurableToolId, string>> = {
  trail_rope: '保证通过，健康无损；体力减少 50%、饱食减少 20%。',
  harvest_sickle: '稳定采收，主产物额外 +1；体力减少 25%。',
  prospector_pick: '珍宝调查稳定增加 2 点进度，同时带回当地副产物。',
  survey_lens: '定向取得所选食材、材料或种子；研究食材调查进度 +2。',
  camp_kit: '使用营具恢复状态。',
};
const lensTarget = (choice: AdventureStageChoice) => choice.research?.id ?? choice.id.split(':')[1];
const lensTargetName = (choice: AdventureStageChoice) => getInventoryItem(lensTarget(choice) as ItemId)?.name ?? choice.label;

export const AdventureJourneyView = ({ pet, portrait, neighbor, update, move, busy, onStorage, onReturn, mods, onTasks }: {
  pet: PetState; portrait: string; neighbor?: AdventureCompanion; update: (fn: (p: PetState) => PetState) => void; move: (fn: (p: PetState) => PetState) => void;
  busy: boolean; onStorage: (panel: AdventureStoragePanel) => void; onReturn: () => void;
  mods: readonly InstalledPetModSummary[]; onTasks: () => void;
}) => {
  const [lensSelection, setLensSelection] = useState<{ tripId: string; step: number; id: string }>();
  const trip = pet.adventure.active;
  if (!trip) return <p>当前行程已结束，可在结算页领取收获。</p>;
  if (trip.museum) return <MuseumJourney key={trip.id} pet={pet} portrait={portrait} update={update} move={move} busy={busy} onStorage={onStorage} onReturn={onReturn} />;
  if (campaignEventVisible(pet, trip)) return <CampaignJourney key={trip.campaign!.visitId} pet={pet} portrait={portrait} mods={mods} update={update} move={move} busy={busy} onStorage={onStorage} onReturn={onReturn} onTasks={onTasks} />;
  const steps = getAdventureSteps(trip.rulesVersion, trip.region, trip.purpose, pet.community.expedition.regions.valley.base, trip.bag);
  const step = steps[trip.choices.length];
  const choices = getAdventureStageChoices(pet, step?.choices ?? []).filter(choice => {
    const tool = choice.check?.tool;
    return !tool || getToolUsesLeft(pet, tool, tool === 'trail_rope' && trip.tool) > 0;
  });
  const availableLens = choices.filter(choice => choice.check?.tool === 'survey_lens');
  const selectedLens = (lensSelection?.tripId === trip.id && lensSelection.step === trip.choices.length ? availableLens.find(choice => choice.id === lensSelection.id) : undefined)
    ?? availableLens.find(choice => lensTarget(choice) === trip.target) ?? availableLens[0];
  const region = trip.region === 'tutorial' ? 'valley' : trip.region;
  const harvestPay = getExplorationHarvestPay(pet, 'manual', expeditionRegionForMap[region]);
  const services = canUseAdventureService(pet);
  const act = (choice: AdventureStageChoice) => move(current => advanceAdventure(current, trip.id, trip.choices.length, choice.id, Date.now(), trip.revision));
  const details = (choice: AdventureStageChoice) => {
    const reason = getAdventureChoiceReason(pet, choice), preview = getAdventureChoicePreview(pet, choice);
    return preview && choice.check
      ? <ExplorationChoiceDetails pet={pet} preview={preview} definition={choice.check} reason={reason} harvest={choice.harvest} research={Boolean(choice.research)} hideFinds={choice.randomGather} item={choice.item} />
      : <span className="exploration-check-details"><span className="exploration-action-costs">饱食 <b>−{formatInteger(choice.hunger)}</b> · 体力 <b>−{formatInteger(choice.energy)}</b></span>{reason && <strong className="exploration-check-warning">{reason}</strong>}</span>;
  };
  const card = (choice: AdventureStageChoice) => {
    const reason = getAdventureChoiceReason(pet, choice), tool = choice.check?.tool;
    const guaranteed = getAdventureChoicePreview(pet, choice)?.chance === 100;
    return <article className={`exploration-choice-card exploration-choice-card--${tool ? 'tool' : guaranteed ? 'safe' : 'check'}`} key={choice.id}>
      <button className="exploration-choice-action" disabled={busy || Boolean(reason)} onClick={() => act(choice)}>
        <span className="exploration-choice-heading">{tool ? <Wrench size={20} aria-hidden="true" /> : <Compass size={20} aria-hidden="true" />}<strong>{choice.label}</strong>{guaranteed && <span className="exploration-choice-guarantee"><ShieldCheck size={14} aria-hidden="true" />稳妥完成</span>}</span>
        <span className="exploration-choice-description">{tool && trip.rulesVersion >= 11 ? toolDescriptions[tool] ?? choice.detail : choice.detail}</span>
        {details(choice)}
      </button>
    </article>;
  };
  return <div className="exploration-journey-layout"><div className="exploration-journey">
    <section className="exploration-panel exploration-journey-hero"><ol className="exploration-stage-steps" aria-label="探险阶段">{steps.map((stage,index) => <li key={`${trip.id}:${index}`} className={index < trip.choices.length ? 'is-complete' : index === trip.choices.length ? 'is-current' : ''} aria-current={index === trip.choices.length ? 'step' : undefined}><span>{index < trip.choices.length ? <Check size={15} /> : index+1}</span><strong title={stage.title}>{stage.title}</strong></li>)}</ol><AdventureLandscape region={region} node={getAdventureRouteNode(trip.purpose)} portrait={portrait} label={adventureJourneyName(trip.region,trip.purpose)} /></section>
    <ExplorationCheckSummary result={trip.checkState?.last} /><ExplorationCheckBuffs state={trip.checkState} />
    {choices.some(choice => choice.harvest) && <p className="exploration-collect-pay">每次有效采集：<strong>金币 +{harvestPay.coins} · 基础心心 +{harvestPay.hearts}</strong>，返程领取。物产、研究与概率宝物另计。</p>}
    <section className="exploration-current-event"><div className="help-heading"><h3>{step?.title ?? '本次探查已完成'}</h3><ExplorationHelp pet={pet} purpose={trip.purpose} destination={trip.region} choices={choices} /></div><p>{step?.story ?? '带着发现返回前哨，领取收获并选择下一站。'}</p></section>
    <ExplorationSupport key={trip.id} pet={pet} system="adventure" update={update} move={move} busy={busy} />
    {getCommunityTasks(pet).filter(task => commissionDefinitions[task.template]?.deliveryItem && !task.found).map(task => <div className="community-note" key={task.id}><p>{commissionDefinitions[task.template].name}：到指定地标交接阶段送达行囊便当。</p><button disabled={!canDeliverCommunityParcel(pet, task)} onClick={() => update(p => deliverCommunityParcel(p, task.id, trip.id, trip.revision))}>交付行囊便当</button></div>)}
    {services && neighbor && <section className="exploration-encounter" aria-label="途中伙伴"><img src={neighbor.portrait} alt="" /><div><h3>{neighbor.name} · 路上遇见你</h3><p>先歇歇脚吧！我带了些随身补给，也能帮你从仓库送来物资。</p><div className="exploration-inline-actions"><button onClick={() => onStorage('shop')}><ShoppingBag size={18} aria-hidden="true" />伙伴商店</button><button onClick={() => onStorage('delivery')}><Truck size={18} aria-hidden="true" />从仓库送来 · 每份 2 心心</button></div></div></section>}
    {getAdventureBagCount(trip.loot) > 0 ? <button className="primary-button" onClick={() => onStorage('loot')}>整理待拾取物资 · {getAdventureBagCount(trip.loot)} 份</button> : <div className="adventure-choices">
      {choices.filter(choice => choice.check?.tool !== 'survey_lens' && choice.id !== 'gather:leave').map(card)}
      {selectedLens && <article className="exploration-choice-card exploration-choice-card--tool exploration-lens-card">
        <div className="exploration-choice-heading"><Search size={20} aria-hidden="true" /><h4>放大镜 · 定向查找</h4><span className="exploration-choice-guarantee"><ShieldCheck size={14} aria-hidden="true" />{selectedLens.research ? '调查 +2' : '保证找到'}</span></div>
        <p className="exploration-choice-description">{toolDescriptions.survey_lens}</p>
        <div className="exploration-lens-targets" role="group" aria-label="选择放大镜目标">{availableLens.map(choice => <button key={choice.id} aria-pressed={choice.id === selectedLens.id} disabled={busy} onClick={() => setLensSelection({ tripId: trip.id, step: trip.choices.length, id: choice.id })}>{lensTargetName(choice)}</button>)}</div>
        {details(selectedLens)}
        <button className="exploration-lens-submit" disabled={busy || Boolean(getAdventureChoiceReason(pet, selectedLens))} onClick={() => act(selectedLens)}>使用放大镜 · {lensTargetName(selectedLens)}</button>
      </article>}
      {choices.filter(choice => choice.id === 'gather:leave').map(card)}
      {!step && <button className="primary-button" onClick={onReturn}>完成探查，返回前哨</button>}
    </div>}
  </div><aside className="exploration-panel exploration-journey-aside"><div className="exploration-section-heading"><h3>旅途状态</h3><span className="exploration-tag">进度已保存</span></div><AdventureCompanionStatus pet={pet} actor={{id:trip.actorId,name:trip.actorName,portrait}} /><section className="exploration-journey-bag"><h3>这一段旅途</h3><div><span>随身行囊</span><strong>{getAdventureBagCount(trip.bag)} / {getExplorationBagCapacity(pet)}</strong></div><div><span>当前进度</span><strong>{trip.choices.length} / {steps.length} 阶段</strong></div><button className="primary-button" onClick={() => onStorage('bag')}><Backpack size={19} />查看旅行背包</button>{getAdventureBagCount(trip.loot) > 0 && <button className="secondary-button" onClick={() => onStorage('loot')}>整理待拾取物资</button>}<button className="secondary-button" disabled={!services} onClick={() => onStorage('shop')}><ShoppingBag size={18} />{services ? '伙伴的随身补给' : '遇见邻居后可购买补给'}</button></section><button className="secondary-button exploration-return-button" disabled={busy} onClick={onReturn}><ArrowLeft size={18} />{step ? '提前返回前哨' : '完成探查，返回前哨'}</button></aside></div>;
};
