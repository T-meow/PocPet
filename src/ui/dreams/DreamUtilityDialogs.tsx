import { useState } from 'react';
import { Apple, Info } from 'lucide-react';
import {
  classicEndgameUnlockLevel, classicEndgameUnlockSkillLevel, dreamProjectCategories,
  getClassicGoalProgress, getClassicLegacyAppleCost, getClassicLegacyLevelCoinCost,
  getDreamProjectSupplySupplement, isClassicEndgameComplete, isClassicEndgameUnlocked,
  type PartnerScheduleCategory, type PetState,
} from '../../core/pet';
import { t } from '../../i18n';
import { trophyImages } from '../../trophyAssets';
import {
  DreamBar, DreamConfirmation, DreamDialog, DreamFeedback, DreamFunding, DreamRequirement,
  dreamNumber, dreamText, dreamTitle, useDreamAction, useDreamInvestment,
} from './DreamShared';

export const DreamOverviewDialog = ({ pet, portrait, onClose }: { pet: PetState; portrait: string; onClose: () => void }) => {
  const progress = getClassicGoalProgress(pet);
  return <DreamDialog title={dreamText('overview')} labelId="dream-overview-title" onClose={onClose}
    footer={<button type="button" className="dreams-secondary" onClick={onClose}>{dreamText('backToDreams')}</button>}>
    <div className="dreams-center"><img src={portrait} alt="" /><h3>{dreamText('takeTime')}</h3><p>{dreamText('overviewCopy')}</p></div>
    <div className="dreams-summary"><div><strong>{progress.completedStages}<small> / {progress.totalStages}</small></strong><span>{t('ui.classicEndgame.stageProgress')}</span></div>
      <div><strong>{progress.unlockedTrophies}<small> / {progress.totalTrophies}</small></strong><span>{t('ui.classicEndgame.trophies.title')}</span></div></div>
    <div className="dreams-funding"><div><span>{t('ui.classicEndgame.fundingProgress')}</span><strong>{dreamNumber(progress.investedCoins)} <small>/ {dreamNumber(progress.totalCoins)}</small></strong></div><DreamBar value={progress.investedCoins} total={progress.totalCoins} /></div>
    <p className="dreams-copy">{dreamText('overviewEnd')}</p>
    <p className="dreams-locked-note"><Info size={16} />{dreamText('unlockedHint', { level: classicEndgameUnlockLevel, skill: classicEndgameUnlockSkillLevel })}</p>
  </DreamDialog>;
};

export const DreamSupplementDialog = ({ pet, fertilizerImage, onClose, onClaim }: {
  pet: PetState; fertilizerImage: string; onClose: () => void; onClaim: (category: PartnerScheduleCategory) => void;
}) => {
  const supplements = dreamProjectCategories.map(category => ({ category, ...getDreamProjectSupplySupplement(pet, category) })).filter(item => item.amount > 0);
  const feedback = useDreamAction(pet);
  return <DreamDialog title={t('ui.classicEndgame.supplySupplementTitle')} labelId="dream-supplement-title" onClose={onClose}
    footer={<button type="button" className="dreams-secondary" onClick={onClose}>{dreamText('backToDreams')}</button>}>
    <DreamFeedback message={feedback.message} />
    <div className="dreams-center"><img src={fertilizerImage} alt="" /><h3>{dreamText(supplements.length ? 'supplementCopy' : 'emptySupplement')}</h3><p>{supplements.length ? t('ui.classicEndgame.supplySupplementHint') : dreamText('emptySupplementHint')}</p></div>
    {supplements.map(item => <article className="dreams-supplement" key={item.category}>
      <div><img src={fertilizerImage} alt="" /><div><h3>{t('pet.shop.items.normal_fertilizer.name')} ×{item.amount}</h3><p>{dreamTitle(item.category)}</p></div></div>
      <button type="button" className="dreams-primary" disabled={!item.canClaim} onClick={() => feedback.run(() => onClaim(item.category))}>{dreamText('claimSupplement', { count: item.amount })}</button>
      {!item.canClaim && <p className="dreams-warning" role="status">{t('pet.classicEndgame.rewardInventoryFull')}</p>}
    </article>)}
  </DreamDialog>;
};

export const DreamLegacyDialog = ({ pet, onClose, onInvest, onComplete }: {
  pet: PetState; onClose: () => void; onInvest: (coins: number) => void; onComplete: () => void;
}) => {
  const [pending, setPending] = useState<{ coins: number; targetLevel: number } | null>(null);
  const targetLevel = pet.classicEndgame.legacyLevel + 1;
  const cost = getClassicLegacyLevelCoinCost(targetLevel);
  const appleCost = getClassicLegacyAppleCost(targetLevel);
  const goldenApples = pet.inventory.golden_apple ?? 0;
  const unlocked = isClassicEndgameComplete(pet);
  const canInvest = unlocked && isClassicEndgameUnlocked(pet);
  const selection = useDreamInvestment(cost, pet.classicEndgame.legacyCoinsInvested, pet.coins);
  const feedback = useDreamAction(pet);
  const pendingValid = Boolean(pending && canInvest && pending.targetLevel === targetLevel && pending.coins <= selection.remaining && pending.coins <= pet.coins);
  const canComplete = unlocked && selection.remaining <= 0 && goldenApples >= appleCost;
  const requestInvestment = () => {
    if (!canInvest || selection.amount <= 0) return;
    if (selection.amount >= 10000) setPending({ coins: selection.amount, targetLevel });
    else feedback.run(() => onInvest(selection.amount));
  };
  const rarity = pet.classicEndgame.legacyLevel >= 12 ? 'jackpot' : pet.classicEndgame.legacyLevel >= 9 ? 'legendary' : pet.classicEndgame.legacyLevel >= 6 ? 'rare' : pet.classicEndgame.legacyLevel >= 3 ? 'uncommon' : 'common';
  return <DreamDialog title={t('ui.classicEndgame.legacyKicker')} labelId="dream-legacy-title" onClose={onClose}
    footer={selection.remaining > 0 ? <><p className="dreams-footer-caption">{dreamText('coinsAfter', { coins: dreamNumber(pet.coins - selection.amount) })}</p><button type="button" className="dreams-primary" disabled={!canInvest || selection.amount <= 0} onClick={requestInvestment}>{dreamText('invest', { coins: dreamNumber(selection.amount) })}</button></>
      : <><p className="dreams-footer-caption">{t('ui.classicEndgame.nextRequirementApples', { target: appleCost })}</p><button type="button" className="dreams-primary" disabled={!canComplete} onClick={() => { if (canComplete) feedback.run(onComplete); }}>{t('ui.classicEndgame.completeLegacy', { level: targetLevel })}</button></>}>
    <DreamFeedback message={feedback.message} />
    <div className={`dreams-center dreams-legacy--${rarity}`}><img src={trophyImages.diamond} alt="" /><h3>{t('ui.classicEndgame.legacyTitle', { level: pet.classicEndgame.legacyLevel })}</h3><p>{dreamText('legacyCopy')}<br />{t('ui.classicEndgame.legacySummary')}</p></div>
    <h3 className="dreams-section-label">{t('ui.classicEndgame.legacyTitle', { level: targetLevel })}</h3>
    <DreamFunding cost={cost} invested={pet.classicEndgame.legacyCoinsInvested} coins={pet.coins} selection={selection} />
    <div className="dreams-requirements"><DreamRequirement icon={<Apple size={16} />} label={dreamText('apples')} current={goldenApples} target={appleCost} /></div>
    {pending && <DreamConfirmation title={t('ui.classicEndgame.confirm.title')} message={t('ui.classicEndgame.confirm.message', { coins: dreamNumber(pending.coins) })} disabled={!pendingValid} onCancel={() => setPending(null)} onConfirm={() => {
      if (!pendingValid) return;
      feedback.run(() => onInvest(pending.coins)); setPending(null);
    }}><p>{t('ui.classicEndgame.legacyTitle', { level: pending.targetLevel })}</p>{!pendingValid && <p className="dreams-warning" role="status">{dreamText('staleInvestment')}</p>}</DreamConfirmation>}
  </DreamDialog>;
};
