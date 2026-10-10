import { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Gift, Lock, Sparkles } from 'lucide-react';
import {
  classicEndgameUnlockLevel, classicEndgameUnlockSkillLevel, classicGoldenAppleHeartExchangeRate, dreamProjectCategories, dreamStageDefinitions,
  getClassicGoalProgress, getDreamProjectSupplySupplement, getDreamStageEligibility,
  isClassicEndgameComplete, isClassicEndgameUnlocked, type PartnerScheduleCategory, type PetState,
} from '../core/pet';
import { currencyIcon } from '../assets';
import { t } from '../i18n';
import { DialogScope } from './DialogShell';
import { ClaimNotice } from './ClaimNotice';
import { ClassicGoldenAppleExchange } from './ClassicGoldenAppleExchange';
import { ClassicTrophyCabinet, DreamTrophyShelf } from './ClassicTrophyCabinet';
import { DreamProjectDialog } from './dreams/DreamProjectDialog';
import { DreamLegacyDialog, DreamOverviewDialog, DreamSupplementDialog } from './dreams/DreamUtilityDialogs';
import { DreamDialog, dreamCategoryLabel, dreamNumber, dreamStageName, dreamText, dreamTitle, type DreamArtwork } from './dreams/DreamShared';

interface CommonDreamsPageProps extends DreamArtwork {
  pet: PetState;
  onBack: () => void;
  onInvestProject: (category: PartnerScheduleCategory, coins: number) => void;
  onCompleteProjectStage: (category: PartnerScheduleCategory) => void;
  onClaimProjectSupplement: (category: PartnerScheduleCategory) => void;
  onInvestLegacy: (coins: number) => void;
  onCompleteLegacy: () => void;
  onExchangeGoldenApples: (apples: number) => void;
  onMuseum: () => void;
}

type DreamPanel = { kind: 'project'; category: PartnerScheduleCategory } | { kind: 'overview' | 'trophies' | 'supplement' | 'exchange' | 'legacy' };

export const CommonDreamsPage = ({ pet, portrait, projectImages, itemIconMap, onBack, onInvestProject, onCompleteProjectStage, onClaimProjectSupplement, onInvestLegacy, onCompleteLegacy, onExchangeGoldenApples, onMuseum }: CommonDreamsPageProps) => {
  const [panel, setPanel] = useState<DreamPanel | null>(null);
  const unlocked = isClassicEndgameUnlocked(pet);
  const complete = isClassicEndgameComplete(pet);
  const goal = getClassicGoalProgress(pet);
  const goldenApples = pet.inventory.golden_apple ?? 0;
  const closePanel = () => setPanel(null);
  const hasSupplement = dreamProjectCategories.some(category => getDreamProjectSupplySupplement(pet, category).amount > 0);
  const projects = dreamProjectCategories.map(category => {
    const eligibility = getDreamStageEligibility(pet, category);
    return { category, eligibility, progress: pet.classicEndgame.projects[category], ready: unlocked && !eligibility.complete && eligibility.requirementsMet && eligibility.coinsMet && eligibility.applesMet && Boolean(eligibility.rewardFits) };
  });
  const readyCount = projects.filter(project => project.ready).length;
  const projectCaption = ({ eligibility, progress, ready }: typeof projects[number]) => {
    const definition = eligibility.definition;
    if (!definition) return <><Check size={12} />{t('ui.classicEndgame.projectComplete')}</>;
    if (!unlocked) return <><Lock size={12} />{dreamText('locked')}</>;
    if (ready) return <><Gift size={13} />{dreamText('ready')}</>;
    if (!eligibility.rewardFits) return dreamText('inventoryFull');
    if (eligibility.masterCount < definition.masterCount) return dreamText('mastersMissing', { count: definition.masterCount - eligibility.masterCount });
    if (eligibility.skillLevel < definition.skillLevel) return dreamText('skillProgress', { current: eligibility.skillLevel, target: definition.skillLevel });
    if (eligibility.scheduleCount < definition.scheduleCount) return dreamText('workProgress', { current: eligibility.scheduleCount, target: definition.scheduleCount });
    if (!eligibility.coinsMet) return dreamText('coinsMissing', { coins: dreamNumber(definition.coinCost - progress.currentStageCoins) });
    return dreamText('applesMissing', { count: definition.appleCost - goldenApples });
  };

  return <section className="classic-endgame-page dreams-page" aria-labelledby="classic-endgame-title">
    <header className="dreams-page-header">
      <button type="button" className="dreams-icon" onClick={onBack} aria-label={t('ui.classicEndgame.back')}><ArrowLeft size={21} /></button>
      <h1 id="classic-endgame-title">{t('ui.classicEndgame.title')}</h1>
      <button type="button" className="dreams-icon" onClick={() => setPanel({ kind: 'supplement' })} aria-label={t('ui.classicEndgame.supplySupplementTitle')}><Gift size={20} /><ClaimNotice show={hasSupplement} /></button>
    </header>
    <div className="dreams-wallet"><span><img src={currencyIcon} alt="" />{dreamText('coins')}<strong>{dreamNumber(pet.coins)}</strong></span><span><img src={itemIconMap.golden_apple} alt="" />{dreamText('apples')}<strong>{dreamNumber(goldenApples)}</strong></span></div>
    <button type="button" className="dreams-overview" onClick={() => setPanel({ kind: 'overview' })} aria-label={`${dreamText('viewProgress')} · ${dreamText('stagesTogether', { current: goal.completedStages, total: goal.totalStages })}`}>
      <img src={portrait} alt="" draggable={false} /><Sparkles className="dreams-overview-stars" size={18} aria-hidden="true" />
      <span className="dreams-overview-content"><small>{dreamText('kicker')}</small><strong>{dreamText(complete ? 'finishedHeadline' : 'headline')}</strong><span>{dreamText('stagesTogether', { current: goal.completedStages, total: goal.totalStages })}</span></span>
      <span className="dreams-overview-bottom"><span className="dreams-overview-meter" aria-hidden="true">{Array.from({ length: goal.totalStages }, (_, index) => <i key={index} className={index < goal.completedStages ? 'is-done' : ''} />)}</span><span>{Math.round(goal.completedStages / goal.totalStages * 100)}%</span><ChevronRight size={14} /></span>
    </button>
    {!unlocked && !complete && <p className="dreams-locked-note"><Lock size={17} /><span>{pet.level < classicEndgameUnlockLevel
      ? t('ui.classicEndgame.levelLocked', { level: pet.level, targetLevel: classicEndgameUnlockLevel })
      : t('ui.classicEndgame.lockedProgress', { skill: Math.min(...dreamProjectCategories.map(category => pet.partnerSchedule.skills[category].level)), targetSkill: classicEndgameUnlockSkillLevel })}</span></p>}
    <div className="dreams-section-heading"><h2>{dreamText('fourDreams')}</h2><span className={readyCount ? 'is-ready' : ''}>{readyCount ? dreamText('readyCount', { count: readyCount }) : dreamText('takeTime')}</span></div>
    <div className="dreams-grid">{projects.map(project => {
      const { category, eligibility, progress, ready } = project;
      return <div className="dreams-card-wrap" key={category}><button type="button" className={`dreams-card dreams-tone-${category}${ready ? ' is-ready' : ''}${!unlocked && !complete ? ' is-locked' : ''}`}
        onClick={() => setPanel({ kind: 'project', category })} aria-label={dreamText('viewDream', { project: dreamTitle(category), current: progress.completedStages, total: dreamStageDefinitions.length })}>
        <span className="dreams-card-art"><span>{dreamCategoryLabel(category)}</span><img src={projectImages[category]} alt="" draggable={false} /><Sparkles size={13} aria-hidden="true" /></span>
        <strong className="dreams-card-title">{dreamTitle(category)}</strong>
        <span className="dreams-card-stage">{eligibility.definition ? t('ui.classicEndgame.stageNamed', { stage: eligibility.definition.stage, name: dreamStageName(category, eligibility.definition.stage) }) : dreamText('allStagesComplete')}</span>
        <span className="dreams-stage-dots" aria-hidden="true">{dreamStageDefinitions.map(stage => <i key={stage.stage} className={stage.stage <= progress.completedStages ? 'is-done' : stage.stage === eligibility.definition?.stage ? 'is-current' : ''} />)}</span>
        <span className="dreams-card-status"><span>{projectCaption(project)}</span><ChevronRight size={14} /></span>
      </button></div>;
    })}</div>
    {complete && <button type="button" className="dreams-utility dreams-utility--legacy" onClick={() => setPanel({ kind: 'legacy' })}><span className="dreams-utility-icon"><Sparkles size={20} /></span><span><strong>{t('ui.classicEndgame.legacyKicker')} · Lv.{pet.classicEndgame.legacyLevel}</strong><small>{dreamText('legacyCopy')}</small></span><ChevronRight size={17} /></button>}
    <button type="button" className="dreams-utility" onClick={onMuseum}><span className="dreams-utility-icon"><Sparkles size={22} /></span><span><strong>我们的纪念馆</strong><small>{complete ? `建设五地区展厅 · 策展 ${dreamNumber(pet.museum.stars)} 星 · 举办 ${dreamNumber(pet.museum.hosted)} 场` : '获得钻石奖杯后，收藏旅途、举办主题展'}</small></span>{complete ? <ChevronRight size={17} /> : <Lock size={15} />}</button>
    <button type="button" className="dreams-collection" onClick={() => setPanel({ kind: 'trophies' })} aria-label={`${t('ui.classicEndgame.trophies.title')} ${goal.unlockedTrophies} / ${goal.totalTrophies}`}>
      <span className="dreams-collection-heading"><strong>{dreamText('collection')}</strong><span>{goal.unlockedTrophies} / {goal.totalTrophies}<ChevronRight size={14} /></span></span>
      <span className="dreams-shelf"><DreamTrophyShelf pet={pet} /><small>{goal.diamondUnlocked ? t('ui.classicEndgame.trophies.names.diamond') : dreamText('collectionCopy')}</small></span>
    </button>
    <button type="button" className="dreams-utility" onClick={() => setPanel({ kind: 'exchange' })}><span className="dreams-utility-icon"><img src={itemIconMap.golden_apple} alt="" /></span><span><strong>{t('ui.classicEndgame.exchange.title')}</strong><small>{goal.diamondUnlocked ? dreamText('exchangeShort', { hearts: classicGoldenAppleHeartExchangeRate }) : t('ui.classicEndgame.exchange.locked')}</small></span>{goal.diamondUnlocked ? <ChevronRight size={17} /> : <Lock size={15} />}</button>
    <p className="dreams-whisper">{dreamText('whisper')}</p>

    <DialogScope>
      {panel?.kind === 'project' && <DreamProjectDialog key={panel.category} pet={pet} category={panel.category} portrait={portrait} projectImages={projectImages} itemIconMap={itemIconMap} onClose={closePanel} onInvest={onInvestProject} onComplete={onCompleteProjectStage} />}
      {panel?.kind === 'overview' && <DreamOverviewDialog pet={pet} portrait={portrait} onClose={closePanel} />}
      {panel?.kind === 'supplement' && <DreamSupplementDialog pet={pet} fertilizerImage={itemIconMap.normal_fertilizer} onClose={closePanel} onClaim={onClaimProjectSupplement} />}
      {panel?.kind === 'legacy' && <DreamLegacyDialog pet={pet} onClose={closePanel} onInvest={onInvestLegacy} onComplete={onCompleteLegacy} />}
      {panel?.kind === 'exchange' && <ClassicGoldenAppleExchange pet={pet} appleImage={itemIconMap.golden_apple} onExchange={onExchangeGoldenApples} onClose={closePanel} />}
      {panel?.kind === 'trophies' && <DreamDialog title={t('ui.classicEndgame.trophies.title')} labelId="dream-trophies-title" onClose={closePanel} footer={<button type="button" className="dreams-secondary" onClick={closePanel}>{dreamText('backToDreams')}</button>}><ClassicTrophyCabinet pet={pet} /></DreamDialog>}
    </DialogScope>
  </section>;
};
