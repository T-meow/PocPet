import { useState } from 'react';
import { Apple, ArrowLeft, BookOpen, ChefHat, Footprints, Lock, Sprout, type LucideIcon } from 'lucide-react';
import {
  classicEndgameUnlockLevel,
  classicEndgameUnlockSkillLevel,
  dreamProjectCategories,
  dreamStageDefinitions,
  dreamTotalCoinCost,
  getClassicLegacyAppleCost,
  getClassicLegacyLevelCoinCost,
  getClassicGoalProgress,
  getDreamStageEligibility,
  isClassicEndgameComplete,
  isClassicEndgameUnlocked,
  type GachaRewardRarity,
  type PartnerScheduleCategory,
  type PetState,
} from '../core/pet';
import { t } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';
import { ClassicGoldenAppleExchange } from './ClassicGoldenAppleExchange';
import { ClassicTrophyCabinet } from './ClassicTrophyCabinet';
import { formatCompactNumber } from './numberFormat';

interface CommonDreamsPageProps {
  pet: PetState;
  onBack: () => void;
  onInvestProject: (category: PartnerScheduleCategory, coins: number) => void;
  onCompleteProjectStage: (category: PartnerScheduleCategory) => void;
  onInvestLegacy: (coins: number) => void;
  onCompleteLegacy: () => void;
  onExchangeGoldenApples: (apples: number) => void;
}

type PendingInvestment = { kind: 'project'; category: PartnerScheduleCategory; coins: number } | { kind: 'legacy'; coins: number };

const projectIcons: Record<PartnerScheduleCategory, LucideIcon> = {
  study: BookOpen,
  cooking: ChefHat,
  garden: Sprout,
  exercise: Footprints,
};

const getInvestmentAmounts = (cost: number, invested: number, coins: number) => {
  const remaining = Math.max(0, cost - invested);
  return [
    { key: 'ten', amount: Math.min(remaining, coins, Math.max(1, Math.floor(cost * 0.1))) },
    { key: 'quarter', amount: Math.min(remaining, coins, Math.max(1, Math.floor(cost * 0.25))) },
    { key: 'fill', amount: Math.min(remaining, coins) },
  ] as const;
};

const getLegacyCardRarity = (level: number): GachaRewardRarity => {
  if (level >= 12) return 'jackpot';
  if (level >= 9) return 'legendary';
  if (level >= 6) return 'rare';
  if (level >= 3) return 'uncommon';
  return 'common';
};

export const CommonDreamsPage = ({
  pet,
  onBack,
  onInvestProject,
  onCompleteProjectStage,
  onInvestLegacy,
  onCompleteLegacy,
  onExchangeGoldenApples,
}: CommonDreamsPageProps) => {
  const [pendingInvestment, setPendingInvestment] = useState<PendingInvestment | null>(null);
  const unlocked = isClassicEndgameUnlocked(pet);
  const hasReachedDreamLevel = pet.level >= classicEndgameUnlockLevel;
  const complete = isClassicEndgameComplete(pet);
  const goalProgress = getClassicGoalProgress(pet);
  const goldenApples = pet.inventory.golden_apple ?? 0;

  const requestInvestment = (pending: PendingInvestment) => {
    if (!unlocked || pending.coins <= 0) return;
    if (pending.coins >= 10000) setPendingInvestment(pending);
    else if (pending.kind === 'legacy') onInvestLegacy(pending.coins);
    else onInvestProject(pending.category, pending.coins);
  };

  const confirmInvestment = () => {
    if (!unlocked || !pendingInvestment) return;
    if (pendingInvestment.kind === 'legacy') onInvestLegacy(pendingInvestment.coins);
    else onInvestProject(pendingInvestment.category, pendingInvestment.coins);
    setPendingInvestment(null);
  };

  const renderInvestmentButtons = (
    cost: number,
    invested: number,
    kind: 'legacy' | 'project',
    category?: PartnerScheduleCategory,
  ) => getInvestmentAmounts(cost, invested, pet.coins).map((choice) => (
    <button
      type="button"
      key={choice.key}
      className={choice.key === 'fill' ? 'primary-button' : 'secondary-button'}
      disabled={!unlocked || choice.amount <= 0}
      onClick={() => requestInvestment(kind === 'legacy'
        ? { kind, coins: choice.amount }
        : { kind, category: category as PartnerScheduleCategory, coins: choice.amount })}
    >
      {t(`ui.classicEndgame.invest.${choice.key}`, { coins: formatCompactNumber(choice.amount) })}
    </button>
  ));

  return (
    <section className="classic-endgame-page" aria-labelledby="classic-endgame-title">
      <header className="classic-endgame-header">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t('ui.classicEndgame.back')} title={t('ui.classicEndgame.back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <div>
          <h1 id="classic-endgame-title">{t('ui.classicEndgame.title')}</h1>
        </div>
        <div className="classic-endgame-apples" title={t('ui.classicEndgame.appleMaterialHint')}>
          <Apple size={20} aria-hidden="true" />
          <strong>{formatCompactNumber(goldenApples)}</strong>
        </div>
      </header>

      <div className="classic-endgame-overview">
        <div className="classic-endgame-overview__metrics">
          <div className="classic-endgame-overview__metric">
            <div>
              <span>{t('ui.classicEndgame.stageProgress')}</span>
              <strong>{goalProgress.completedStages}/{goalProgress.totalStages}</strong>
            </div>
            <div className="classic-endgame-overview__bar" aria-hidden="true">
              <i style={{ width: `${goalProgress.completedStages / goalProgress.totalStages * 100}%` }} />
            </div>
          </div>
          <div className="classic-endgame-overview__metric">
            <div>
              <span>{t('ui.classicEndgame.fundingProgress')}</span>
              <strong>{formatCompactNumber(goalProgress.investedCoins)} / {formatCompactNumber(dreamTotalCoinCost)}</strong>
            </div>
            <div className="classic-endgame-overview__bar" aria-hidden="true">
              <i style={{ width: `${goalProgress.investedCoins / goalProgress.totalCoins * 100}%` }} />
            </div>
          </div>
        </div>
        {hasReachedDreamLevel && !unlocked && !complete && (
          <p>{t('ui.classicEndgame.lockedProgress', {
            skill: Math.min(...dreamProjectCategories.map((category) => pet.partnerSchedule.skills[category].level)),
            targetSkill: classicEndgameUnlockSkillLevel,
          })}</p>
        )}
        {complete && <p className="classic-endgame-overview__complete">{t('ui.classicEndgame.finalComplete')}</p>}
      </div>

      {!complete ? (
        !hasReachedDreamLevel ? (
          <div className="classic-dream-lock" role="status">
            <Lock size={20} aria-hidden="true" />
            <p>{t('ui.classicEndgame.levelLocked', {
              level: pet.level,
              targetLevel: classicEndgameUnlockLevel,
            })}</p>
          </div>
        ) : (
          <div className="classic-dream-grid">
            {dreamProjectCategories.map((category) => {
              const progress = pet.classicEndgame.projects[category];
              const eligibility = getDreamStageEligibility(pet, category);
              const Icon = projectIcons[category];
              if (eligibility.complete || !eligibility.definition) {
                return (
                  <article className="classic-dream classic-dream--complete" key={category}>
                    <Icon size={24} aria-hidden="true" />
                    <h2>{t(`ui.classicEndgame.projects.${category}.title`)}</h2>
                    <p>{t(`ui.classicEndgame.projects.${category}.result`)}</p>
                    <strong>{t('ui.classicEndgame.projectComplete')}</strong>
                  </article>
                );
              }
              const definition = eligibility.definition;
              const nextDefinition = dreamStageDefinitions[definition.stage];
              const percent = definition.coinCost > 0 ? progress.currentStageCoins / definition.coinCost * 100 : 100;
              const canComplete = eligibility.requirementsMet && eligibility.coinsMet && eligibility.applesMet;
              return (
                <article className="classic-dream" key={category}>
                <header>
                  <span className="classic-dream__icon"><Icon size={22} aria-hidden="true" /></span>
                  <div>
                    <small>{t('ui.classicEndgame.stageNamed', {
                      stage: definition.stage,
                      name: t(`ui.classicEndgame.projects.${category}.stages.${definition.stage}`),
                    })}</small>
                    <h2>{t(`ui.classicEndgame.projects.${category}.title`)}</h2>
                  </div>
                </header>
                <p>{t(`ui.classicEndgame.projects.${category}.summary`)}</p>
                <div className="classic-dream__requirements">
                  <span data-met={eligibility.skillLevel >= definition.skillLevel}>{t('ui.classicEndgame.requirementSkill', { current: eligibility.skillLevel, target: definition.skillLevel })}</span>
                  <span data-met={eligibility.scheduleCount >= definition.scheduleCount}>{t('ui.classicEndgame.requirementSchedule', { current: eligibility.scheduleCount, target: definition.scheduleCount })}</span>
                  {definition.masterCount > 0 && <span data-met={eligibility.masterCount >= definition.masterCount}>{t('ui.classicEndgame.requirementMaster', { current: eligibility.masterCount, target: definition.masterCount })}</span>}
                  {definition.appleCost > 0 && <span data-met={eligibility.applesMet}>{t('ui.classicEndgame.requirementApples', { current: goldenApples, target: definition.appleCost })}</span>}
                </div>
                <div className="classic-dream__funding">
                  <div><span>{t('ui.classicEndgame.funding')}</span><strong>{formatCompactNumber(progress.currentStageCoins)} / {formatCompactNumber(definition.coinCost)}</strong></div>
                  <div className="classic-dream__bar" aria-hidden="true"><i style={{ width: `${Math.min(100, percent)}%` }} /></div>
                </div>
                <div className="classic-dream__next">
                  {nextDefinition ? (
                    <>
                      <strong>{t('ui.classicEndgame.nextStage', {
                        stage: nextDefinition.stage,
                        name: t(`ui.classicEndgame.projects.${category}.stages.${nextDefinition.stage}`),
                      })}</strong>
                      <div>
                        <span>{t('ui.classicEndgame.nextRequirementCoins', { target: formatCompactNumber(nextDefinition.coinCost) })}</span>
                        <span>{t('ui.classicEndgame.nextRequirementSkill', { target: nextDefinition.skillLevel })}</span>
                        <span>{t('ui.classicEndgame.nextRequirementSchedule', { target: nextDefinition.scheduleCount })}</span>
                        <span>{t('ui.classicEndgame.nextRequirementMaster', { target: nextDefinition.masterCount })}</span>
                        <span>{t('ui.classicEndgame.nextRequirementApples', { target: nextDefinition.appleCost })}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>{t('ui.classicEndgame.finalStagePreview')}</strong>
                      <p>{t(`ui.classicEndgame.projects.${category}.result`)}</p>
                      <span>{t('ui.classicEndgame.goldTrophyPreview', {
                        trophy: t(`ui.classicEndgame.trophies.names.${category}.gold`),
                      })}</span>
                    </>
                  )}
                </div>
                <div className="classic-dream__actions">
                  {renderInvestmentButtons(definition.coinCost, progress.currentStageCoins, 'project', category)}
                  <button type="button" className="primary-button" disabled={!unlocked || !canComplete} onClick={() => onCompleteProjectStage(category)}>
                    {t('ui.classicEndgame.completeStage')}
                  </button>
                </div>
                </article>
              );
            })}
          </div>
        )
      ) : (() => {
        const targetLevel = pet.classicEndgame.legacyLevel + 1;
        const coinCost = getClassicLegacyLevelCoinCost(targetLevel);
        const appleCost = getClassicLegacyAppleCost(targetLevel);
        const canCompleteLegacy = pet.classicEndgame.legacyCoinsInvested >= coinCost && goldenApples >= appleCost;
        const legacyRarity = getLegacyCardRarity(pet.classicEndgame.legacyLevel);
        return (
          <section className={`classic-legacy classic-legacy--${legacyRarity}`} aria-labelledby="classic-legacy-title">
            <div className="classic-legacy__heading">
              <div>
                <span>{t('ui.classicEndgame.legacyKicker')}</span>
                <h2 id="classic-legacy-title">{t('ui.classicEndgame.legacyTitle', { level: targetLevel })}</h2>
              </div>
              <strong>Lv.{pet.classicEndgame.legacyLevel}</strong>
            </div>
            <p>{t('ui.classicEndgame.legacySummary')}</p>
            <div className="classic-legacy__requirements">
              <span>{t('ui.classicEndgame.legacyCoins', { current: formatCompactNumber(pet.classicEndgame.legacyCoinsInvested), target: formatCompactNumber(coinCost) })}</span>
              <span>{t('ui.classicEndgame.requirementApples', { current: goldenApples, target: appleCost })}</span>
            </div>
            <div className="classic-dream__bar" aria-hidden="true"><i style={{ width: `${Math.min(100, pet.classicEndgame.legacyCoinsInvested / coinCost * 100)}%` }} /></div>
            <div className="classic-dream__actions">
              {renderInvestmentButtons(coinCost, pet.classicEndgame.legacyCoinsInvested, 'legacy')}
              <button type="button" className="primary-button" disabled={!canCompleteLegacy} onClick={onCompleteLegacy}>
                {t('ui.classicEndgame.completeLegacy', { level: targetLevel })}
              </button>
            </div>
          </section>
        );
      })()}

      <ClassicTrophyCabinet pet={pet} />
      <ClassicGoldenAppleExchange pet={pet} onExchange={onExchangeGoldenApples} />

      {pendingInvestment && (
        <ConfirmDialog
          title={t('ui.classicEndgame.confirm.title')}
          message={t('ui.classicEndgame.confirm.message', { coins: formatCompactNumber(pendingInvestment.coins) })}
          cancelLabel={t('ui.classicEndgame.confirm.cancel')}
          confirmLabel={t('ui.classicEndgame.confirm.confirm')}
          onCancel={() => setPendingInvestment(null)}
          onConfirm={confirmInvestment}
        />
      )}
    </section>
  );
};
