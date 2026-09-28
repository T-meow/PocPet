import { useState } from 'react';
import { Backpack, Wrench, X, ArrowLeft } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import { advanceAdventure, canUseAdventureService, getAdventureChoicePreview, getAdventureChoiceReason } from '../core/adventure';
import { getAdventureSteps, adventureJourneyName } from '../core/adventureData';
import { getAdventureStageChoices, type AdventureStageChoice } from '../core/adventureGathering';
import { getAdventureBagCount } from '../core/adventureState';
import { getAdventureNodeScene } from './adventureScenes';
import { getAdventureRouteNode } from '../core/valleyQuests';
import { toolDurabilityLabel } from '../core/toolDurability';
import { getCommunityTasks, commissionDefinitions, canDeliverCommunityParcel, deliverCommunityParcel } from '../core/communityCommissions';
import { ExplorationCheckBuffs, ExplorationCheckSummary, ExplorationChoiceDetails } from './ExplorationCheck';
import { ExplorationSupport } from './expedition/ExplorationSupport';
import { ExplorationHelp } from './help/ExplorationGuide';
import { DialogShell } from './DialogShell';
import type { AdventureStoragePanel } from './AdventureStorage';
import { getExplorationHarvestPay } from '../core/explorationBudget';
import { expeditionRegionForMap } from '../core/landmarkProgress';
import { formatInteger, formatMultiplierPercent } from './numberFormat';

export const AdventureJourneyView = ({ pet, portrait, update, move, busy, onStorage, onReturn }: {
  pet: PetState; portrait: string; update: (fn: (p: PetState) => PetState) => void; move: (fn: (p: PetState) => PetState) => void;
  busy: boolean; onStorage: (panel: AdventureStoragePanel) => void; onReturn: () => void;
}) => {
  const [tools, setTools] = useState(false), [lens, setLens] = useState(false);
  const trip = pet.adventure.active;
  if (!trip) return <p>当前行程已结束，可在结算页领取收获。</p>;
  const step = getAdventureSteps(trip.rulesVersion, trip.region, trip.purpose, pet.community.expedition.regions.valley.base, trip.bag)[trip.choices.length];
  const choices = getAdventureStageChoices(pet, step?.choices ?? []), toolChoices = choices.filter(choice => choice.check?.tool);
  const availableLens = toolChoices.filter(choice => choice.check?.tool === 'survey_lens');
  const region = trip.region === 'tutorial' ? 'valley' : trip.region;
  const harvestPay = getExplorationHarvestPay(pet, 'manual', expeditionRegionForMap[region]);
  const act = (choice: AdventureStageChoice) => { move(current => advanceAdventure(current, trip.id, trip.choices.length, choice.id, Date.now(), trip.revision)); setTools(false); setLens(false); };
  const card = (choice: AdventureStageChoice) => {
    const reason = getAdventureChoiceReason(pet, choice), preview = getAdventureChoicePreview(pet, choice);
    return <article className="exploration-choice-card" key={choice.id}>
      <button className="exploration-choice-action" disabled={busy || Boolean(reason)} onClick={() => act(choice)}><strong>{choice.label}</strong><small>{choice.detail}</small>{preview && choice.check ? <ExplorationChoiceDetails pet={pet} preview={preview} definition={choice.check} hunger={choice.hunger} reason={reason} harvest={choice.harvest} research={Boolean(choice.research)} hideFinds={choice.randomGather} /> : <span>饱食 −{formatInteger(choice.hunger)} · 体力 −{formatInteger(choice.energy)}{reason && <strong>{reason}</strong>}</span>}</button>
      {preview && <details className="exploration-cost-breakdown"><summary>查看消耗计算</summary>
        <p>基础体力 {formatInteger(preview.costFactors.base)} → 实际 {preview.energy.map(formatInteger).join('～')}；基础饱食 {formatInteger(preview.costFactors.hungerBase)} → 实际 {preview.hunger.map(formatInteger).join('～')}。</p>
        <p>技能减免：体力 {Math.round((1 - preview.costFactors.skillEnergy) * 100)}%、饱食 {Math.round((1 - preview.costFactors.skillHunger) * 100)}%；工具：体力 {Math.round((1 - preview.costFactors.toolEnergy) * 100)}%、饱食 {Math.round((1 - preview.costFactors.toolHunger) * 100)}%。</p>
        <p>体力消耗倍率：营地 {formatMultiplierPercent(preview.costFactors.camp)} · 餐食 {formatMultiplierPercent(preview.costFactors.meal)} · 路线 {formatMultiplierPercent(preview.costFactors.route)} · 心情 {formatMultiplierPercent(preview.mood.energy)}。体力减免上限 70%，饱食减免上限 40%。</p>
      </details>}
    </article>;
  };
  return <div className="exploration-journey">
    <div className="exploration-scene"><img src={getAdventureNodeScene(region, getAdventureRouteNode(trip.purpose))} alt={adventureJourneyName(trip.region, trip.purpose)} /><img className="exploration-scene-pet" src={portrait} alt={trip.actorName} /></div>
    <div className="exploration-inline-actions"><button onClick={() => onStorage('bag')}><Backpack size={18} />途中背包</button><button onClick={onReturn}>返回前哨</button></div>
    <ExplorationCheckSummary result={trip.checkState?.last} /><ExplorationCheckBuffs state={trip.checkState} />
    {choices.some(choice => choice.harvest) && <p className="exploration-collect-pay">每次有效采集必得固定 {harvestPay.coins} 金币、{harvestPay.hearts} 基础心心，返程领取；目标物品或研究与概率宝物另计。</p>}
    <div className="help-heading"><h3>{step?.title ?? '本次探查已完成'}</h3><ExplorationHelp pet={pet} purpose={trip.purpose} destination={trip.region} choices={choices} /></div><p>{step?.story ?? '带着发现返回前哨，领取收获并选择下一站。'}</p>
    <ExplorationSupport pet={pet} system="adventure" update={update} move={move} busy={busy} />
    {getCommunityTasks(pet).filter(task => commissionDefinitions[task.template]?.deliveryItem && !task.found).map(task => <div className="community-note" key={task.id}><p>{commissionDefinitions[task.template].name}：到指定地标交接阶段送达行囊便当。</p><button disabled={!canDeliverCommunityParcel(pet, task)} onClick={() => update(p => deliverCommunityParcel(p, task.id, trip.id, trip.revision))}>交付行囊便当</button></div>)}
    {canUseAdventureService(pet) && <div className="exploration-inline-actions"><button onClick={() => onStorage('shop')}>邻里补给</button><button onClick={() => onStorage('delivery')}>从仓库送来</button></div>}
    {getAdventureBagCount(trip.loot) > 0 ? <button className="primary-button" onClick={() => onStorage('loot')}>整理待拾取物资 · {getAdventureBagCount(trip.loot)} 份</button> : <div className="adventure-choices">{choices.filter(choice => !choice.check?.tool).map(card)}{toolChoices.length > 0 && <button className="secondary-button" onClick={() => { setLens(false); setTools(true); }}><Wrench size={18} />使用工具 · 查看保证效果</button>}{!step && <button className="primary-button" onClick={onReturn}>完成探查，返回前哨</button>}</div>}
    {tools && <DialogShell className="exploration-tools-sheet" labelId="exploration-tools-title" onClose={() => setTools(false)}><header><h3 id="exploration-tools-title">选择工具</h3><button className="icon-button" aria-label="关闭工具面板" onClick={() => setTools(false)}><X /></button></header><div className="exploration-sheet-body">{toolChoices.filter(choice => choice.check?.tool !== 'survey_lens').map(card)}{availableLens.length > 0 && <button className="exploration-choice-action" onClick={() => setLens(true)}><strong>放大镜 · 自选食材或种子</strong><small>保证取得基础产量，研究食材进度 +2；采集 −1、耐久 −1。</small><span>当前耐久：{toolDurabilityLabel(pet, 'survey_lens')}</span></button>}</div>
      {lens && <DialogShell className="exploration-tools-sheet" labelId="exploration-lens-title" onClose={() => setLens(false)}><header><button className="icon-button" aria-label="返回工具列表" onClick={() => setLens(false)}><ArrowLeft /></button><h3 id="exploration-lens-title">放大镜 · 定向查找</h3><button className="icon-button" aria-label="关闭工具面板" onClick={() => setTools(false)}><X /></button></header><div className="exploration-sheet-body">{availableLens.map(card)}</div></DialogShell>}
    </DialogShell>}
  </div>;
};
