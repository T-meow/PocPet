import { useState } from 'react';
import { ArrowRight, Heart, Minus, Plus, Trophy } from 'lucide-react';
import { classicGoldenAppleHeartExchangeRate, getClassicGoldenAppleHeartExchangePreview, getClassicGoalProgress, type PetState } from '../core/pet';
import { t } from '../i18n';
import { trophyImages } from '../trophyAssets';
import { ClassicTrophyCabinet } from './ClassicTrophyCabinet';
import { DreamConfirmation, DreamDialog, DreamFeedback, dreamNumber, dreamText, useDreamAction } from './dreams/DreamShared';

interface Props {
  pet: PetState;
  appleImage: string;
  onExchange: (apples: number) => void;
  onClose: () => void;
}

export const ClassicGoldenAppleExchange = ({ pet, appleImage, onExchange, onClose }: Props) => {
  const [requested, setRequested] = useState(1);
  const [pending, setPending] = useState<number | null>(null);
  const [showTrophies, setShowTrophies] = useState(false);
  const progress = getClassicGoalProgress(pet);
  const preview = getClassicGoldenAppleHeartExchangePreview(pet, requested);
  const amount = preview.appleAmount;
  const pendingPreview = pending === null ? null : getClassicGoldenAppleHeartExchangePreview(pet, pending);
  const pendingValid = Boolean(pendingPreview?.canExchange && pendingPreview.appleAmount === pending);
  const feedback = useDreamAction(pet);
  const exchange = (count: number) => { feedback.run(() => onExchange(count)); setPending(null); setRequested(1); };
  return <DreamDialog title={t('ui.classicEndgame.exchange.title')} labelId="dream-exchange-title" onClose={onClose}
    footer={preview.unlocked ? <><p className="dreams-footer-caption">{dreamText('exchangeReward', { hearts: dreamNumber(preview.heartAmount) })}</p><button type="button" className="dreams-primary" disabled={!preview.canExchange} onClick={() => { if (!preview.canExchange) return; if (amount > 1) setPending(amount); else exchange(amount); }}>{dreamText('exchangeCount', { count: amount })}</button></>
      : <button type="button" className="dreams-secondary" onClick={() => setShowTrophies(true)}><Trophy size={16} />{dreamText('viewTrophies')}</button>}>
    <DreamFeedback message={feedback.message} />
    <div className="dreams-center"><img src={preview.unlocked ? appleImage : trophyImages.diamond} alt="" /><h3>{dreamText(preview.unlocked ? 'exchangeCopy' : 'exchangeLockedCopy')}</h3>
      <p>{t(preview.unlocked ? 'ui.classicEndgame.exchange.unlocked' : 'ui.classicEndgame.exchange.locked')}{!preview.unlocked && <><br />{progress.unlockedTrophies} / {progress.totalTrophies}</>}</p>
    </div>
    <div className="dreams-exchange-rate"><img src={appleImage} alt={dreamText('apples')} /><strong>1</strong><ArrowRight size={19} /><Heart size={24} /><strong>{classicGoldenAppleHeartExchangeRate}</strong></div>
    {preview.unlocked && <>
      <div className="dreams-stepper"><button type="button" aria-label={dreamText('less')} disabled={amount <= 1} onClick={() => setRequested(Math.max(1, amount - 1))}><Minus size={18} /></button><output aria-live="polite">{dreamNumber(amount)}</output><button type="button" aria-label={dreamText('more')} disabled={amount >= preview.availableApples} onClick={() => setRequested(amount + 1)}><Plus size={18} /></button></div>
      <p className="dreams-hint dreams-centered">{t('ui.classicEndgame.exchange.inventory', { apples: dreamNumber(preview.availableApples) })} · {dreamText('heartsOwned', { hearts: dreamNumber(pet.hearts) })}</p>
      <div className="dreams-investments" role="group" aria-label={t('ui.classicEndgame.exchange.actionsAria')}>
        {[{ key: 'one', count: 1 }, { key: 'ten', count: 10 }, { key: 'all', count: preview.availableApples }].map(item => <button type="button" key={item.key} className={amount === item.count ? 'is-selected' : ''} aria-pressed={amount === item.count} disabled={item.count <= 0 || item.count > preview.availableApples} onClick={() => setRequested(item.count)}>{item.key === 'all' ? dreamText('exchangeAll') : dreamText('exchangeCount', { count: item.count })}</button>)}
      </div>
    </>}
    <p className="dreams-hint">{dreamText('exchangeHint')}</p>
    {pending !== null && <DreamConfirmation title={t('ui.classicEndgame.exchange.confirm.title')}
      message={t('ui.classicEndgame.exchange.confirm.message', { apples: dreamNumber(pending), hearts: dreamNumber(pending * classicGoldenAppleHeartExchangeRate) })}
      confirmLabel={t('ui.classicEndgame.exchange.confirm.confirm')} disabled={!pendingValid} onCancel={() => setPending(null)} onConfirm={() => { if (pendingValid) exchange(pending); }}>
      {!pendingValid && <p className="dreams-warning" role="status">{dreamText('applesNotEnough')}</p>}
    </DreamConfirmation>}
    {showTrophies && <DreamDialog title={t('ui.classicEndgame.trophies.title')} labelId="dream-exchange-trophies-title" onClose={() => setShowTrophies(false)} onBack={() => setShowTrophies(false)}
      footer={<button type="button" className="dreams-secondary" onClick={() => setShowTrophies(false)}>{dreamText('back')}</button>}><ClassicTrophyCabinet pet={pet} /></DreamDialog>}
  </DreamDialog>;
};
