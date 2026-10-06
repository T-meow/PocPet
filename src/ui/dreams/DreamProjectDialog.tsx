import { useState } from 'react';
import { Apple, Check, CheckCircle2, Coins, Flag, Lock, Trophy } from 'lucide-react';
import {
  classicEndgameUnlockLevel, classicEndgameUnlockSkillLevel, classicTrophyDefinitions,
  dreamStageDefinitions, getDreamStageEligibility, getDreamStageReward, isClassicEndgameUnlocked,
  type PartnerScheduleCategory, type PetState,
} from '../../core/pet';
import { t } from '../../i18n';
import { trophyImages } from '../../trophyAssets';
import { ClassicTrophyCabinet } from '../ClassicTrophyCabinet';
import {
  DreamConfirmation, DreamDialog, DreamFeedback, DreamFunding, DreamRequirement, DreamReward,
  dreamCategoryLabel, dreamIcons, dreamNumber, dreamStageName, dreamText, dreamTitle,
  useDreamAction, useDreamInvestment, type DreamArtwork,
} from './DreamShared';

type DreamTab = 'current' | 'route' | 'rewards';
interface Props extends DreamArtwork {
  pet: PetState;
  category: PartnerScheduleCategory;
  onClose: () => void;
  onInvest: (category: PartnerScheduleCategory, coins: number) => void;
  onComplete: (category: PartnerScheduleCategory) => void;
}

export const DreamProjectDialog = ({ pet, category, projectImages, itemIconMap, onClose, onInvest, onComplete }: Props) => {
  const [tab, setTab] = useState<DreamTab>('current');
  const [pending, setPending] = useState<{ coins: number; stage: number } | null>(null);
  const eligibility = getDreamStageEligibility(pet, category);
  const progress = pet.classicEndgame.projects[category];
  const definition = eligibility.definition;
  const unlocked = isClassicEndgameUnlocked(pet);
  const Icon = dreamIcons[category];
  const selection = useDreamInvestment(definition?.coinCost ?? 0, progress.currentStageCoins, pet.coins);
  const feedback = useDreamAction(pet);
  const canComplete = unlocked && eligibility.requirementsMet && eligibility.coinsMet && eligibility.applesMet && Boolean(eligibility.rewardFits);
  const pendingValid = Boolean(pending && unlocked && definition && definition.stage === pending.stage && selection.remaining >= pending.coins && pet.coins >= pending.coins);
  const completeStage = () => { if (canComplete) feedback.run(() => onComplete(category)); };
  const requestInvestment = () => {
    if (!unlocked || !definition || selection.amount <= 0) return;
    if (selection.amount >= 10000) setPending({ coins: selection.amount, stage: definition.stage });
    else feedback.run(() => onInvest(category, selection.amount));
  };
  const footer = () => {
    if (tab !== 'current') return <button type="button" className="dreams-secondary" onClick={() => setTab('current')}>{dreamText('backToStage')}</button>;
    if (!definition) return <button type="button" className="dreams-primary" onClick={onClose}><Check size={16} />{dreamText('keepMemory')}</button>;
    if (!unlocked) return <button type="button" className="dreams-primary" disabled><Lock size={15} />{dreamText('lockedAction')}</button>;
    if (selection.remaining > 0) return <><p className="dreams-footer-caption">{dreamText('coinsAfter', { coins: dreamNumber(pet.coins - selection.amount) })}</p>
      <button type="button" className="dreams-primary" disabled={selection.amount <= 0} onClick={requestInvestment}><Coins size={16} />{dreamText('invest', { coins: dreamNumber(selection.amount) })}</button></>;
    return <><p className="dreams-footer-caption">{canComplete
      ? dreamText('completeCost', { apples: definition.appleCost, hearts: getDreamStageReward(definition.stage)?.hearts ?? 0 })
      : !eligibility.rewardFits ? t('pet.classicEndgame.rewardInventoryFull') : dreamText('requirementsHint')}</p>
      <button type="button" className="dreams-primary" disabled={!canComplete} onClick={completeStage}>
        {canComplete ? <><CheckCircle2 size={16} />{t('ui.classicEndgame.completeStage')}</> : dreamText(!eligibility.rewardFits ? 'inventoryFull' : !eligibility.requirementsMet ? 'growMore' : 'applesNotEnough')}
      </button></>;
  };

  return <DreamDialog title={dreamTitle(category)} labelId="dream-project-title" onClose={onClose} footer={footer()}
    viewKey={tab}
    controls={<div className="dreams-tabs dreams-dialog-tabs" role="group" aria-label={dreamTitle(category)}>
      {(['current', 'route', 'rewards'] as const).map(key => <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{dreamText(key)}</button>)}
    </div>}>
    <DreamFeedback message={feedback.message} />
    {tab === 'current' && (definition ? <>
      <div className={`dreams-stage-hero dreams-tone-${category}`}>
        <small>{dreamText('stageNumber', { stage: definition.stage, total: dreamStageDefinitions.length })}</small>
        <h3>{dreamStageName(category, definition.stage)}</h3><p>{t(`ui.classicEndgame.projects.${category}.summary`)}</p>
        <img src={projectImages[category]} alt="" draggable={false} />
      </div>
      {!unlocked && <p className="dreams-locked-note"><Lock size={16} />{dreamText('unlockedHint', { level: classicEndgameUnlockLevel, skill: classicEndgameUnlockSkillLevel })}</p>}
      <h3 className="dreams-section-label">{dreamText('requirements')}<small>{dreamText('appleTiming')}</small></h3>
      <div className="dreams-requirements">
        <DreamRequirement icon={<Icon size={16} />} label={dreamText('skill', { category: dreamCategoryLabel(category) })} current={eligibility.skillLevel} target={definition.skillLevel} level />
        <DreamRequirement icon={<Flag size={16} />} label={dreamText('work')} current={eligibility.scheduleCount} target={definition.scheduleCount} />
        {definition.masterCount > 0 && <DreamRequirement icon={<Trophy size={16} />} label={dreamText('master')} current={eligibility.masterCount} target={definition.masterCount} />}
        <DreamRequirement icon={<Apple size={16} />} label={dreamText('apples')} current={pet.inventory.golden_apple ?? 0} target={definition.appleCost} />
      </div>
      <h3 className="dreams-section-label">{dreamText('fundingTitle')}<small>{dreamText('fundingHint')}</small></h3>
      <DreamFunding cost={definition.coinCost} invested={progress.currentStageCoins} coins={pet.coins} selection={selection} />
      <DreamReward stage={definition.stage} itemIconMap={itemIconMap} />
      {classicTrophyDefinitions.filter(trophy => trophy.category === category && trophy.requiredStages === definition.stage).map(trophy => <p className="dreams-reward-trophy" key={trophy.id}><Trophy size={16} />{dreamText('unlockTrophy', { trophy: t(`ui.classicEndgame.trophies.names.${category}.${trophy.tier}`) })}</p>)}
      {!eligibility.rewardFits && <p className="dreams-warning" role="status">{t('pet.classicEndgame.rewardInventoryFull')}</p>}
    </> : <><div className="dreams-center"><img src={trophyImages[`${category}_gold`]} alt="" /><h3>{t('ui.classicEndgame.projectComplete')}</h3><p>{t(`ui.classicEndgame.projects.${category}.result`)}</p></div><ClassicTrophyCabinet pet={pet} category={category} /></>)}
    {tab === 'route' && <ol className="dreams-route">{dreamStageDefinitions.map(stage => <li key={stage.stage} className={stage.stage <= progress.completedStages ? 'is-done' : stage.stage === definition?.stage ? 'is-current' : ''} aria-current={stage.stage === definition?.stage ? 'step' : undefined}>
      <span className="dreams-route-number">{stage.stage <= progress.completedStages ? <Check size={13} /> : stage.stage}</span>
      <h3>{dreamStageName(category, stage.stage)}<small>{dreamText(stage.stage <= progress.completedStages ? 'completedStage' : stage.stage === definition?.stage ? 'current' : 'upcomingStage')}</small></h3>
      <p>{t('ui.classicEndgame.nextRequirementSkill', { target: stage.skillLevel })} · {t('ui.classicEndgame.nextRequirementSchedule', { target: stage.scheduleCount })}{stage.masterCount > 0 && <> · {t('ui.classicEndgame.nextRequirementMaster', { target: stage.masterCount })}</>}</p>
      <div className="dreams-route-costs"><span>{t('ui.classicEndgame.nextRequirementCoins', { target: dreamNumber(stage.coinCost) })}</span><span>{t('ui.classicEndgame.nextRequirementApples', { target: stage.appleCost })}</span></div>
      <DreamReward stage={stage.stage} itemIconMap={itemIconMap} />
    </li>)}</ol>}
    {tab === 'rewards' && <><p className="dreams-copy">{dreamText('rewardCopy')}</p><ClassicTrophyCabinet pet={pet} category={category} /></>}
    {pending && <DreamConfirmation title={t('ui.classicEndgame.confirm.title')} message={t('ui.classicEndgame.confirm.message', { coins: dreamNumber(pending.coins) })}
      disabled={!pendingValid} onCancel={() => setPending(null)} onConfirm={() => {
        if (!pendingValid) return;
        feedback.run(() => onInvest(category, pending.coins)); setPending(null);
      }}>
      <p>{dreamTitle(category)} · {dreamStageName(category, pending.stage)}</p>
      {!pendingValid && <p className="dreams-warning" role="status">{dreamText('staleInvestment')}</p>}
    </DreamConfirmation>}
  </DreamDialog>;
};
