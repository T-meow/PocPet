import { useState } from 'react';
import { Apple, ArrowRight, Heart, Lock } from 'lucide-react';
import {
  classicGoldenAppleHeartExchangeRate,
  getClassicGoldenAppleHeartExchangePreview,
  type PetState,
} from '../core/pet';
import { t } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';

interface ClassicGoldenAppleExchangeProps {
  pet: PetState;
  onExchange: (apples: number) => void;
}

const formatExchangeNumber = (value: number) => Math.max(0, Math.floor(value)).toLocaleString();

export const ClassicGoldenAppleExchange = ({ pet, onExchange }: ClassicGoldenAppleExchangeProps) => {
  const [pendingApples, setPendingApples] = useState<number | null>(null);
  const allPreview = getClassicGoldenAppleHeartExchangePreview(pet, pet.inventory.golden_apple ?? 0);
  const onePreview = getClassicGoldenAppleHeartExchangePreview(pet, 1);
  const tenPreview = getClassicGoldenAppleHeartExchangePreview(pet, 10);

  const requestExchange = (apples: number, needsConfirmation: boolean) => {
    const preview = getClassicGoldenAppleHeartExchangePreview(pet, apples);
    if (!preview.canExchange) return;
    if (needsConfirmation) setPendingApples(preview.appleAmount);
    else onExchange(preview.appleAmount);
  };

  const confirmExchange = () => {
    if (pendingApples === null) return;
    onExchange(pendingApples);
    setPendingApples(null);
  };

  const pendingPreview = pendingApples === null
    ? null
    : getClassicGoldenAppleHeartExchangePreview(pet, pendingApples);

  return (
    <section
      className={`classic-apple-exchange ${allPreview.unlocked ? 'is-unlocked' : 'is-locked'}`}
      aria-labelledby="classic-apple-exchange-title"
    >
      <header className="classic-apple-exchange__header">
        <span className="classic-apple-exchange__icon" aria-hidden="true">
          {allPreview.unlocked ? <Heart size={22} /> : <Lock size={22} />}
        </span>
        <div>
          <h2 id="classic-apple-exchange-title">{t('ui.classicEndgame.exchange.title')}</h2>
          <p>{t(allPreview.unlocked
            ? 'ui.classicEndgame.exchange.unlocked'
            : 'ui.classicEndgame.exchange.locked')}</p>
        </div>
        <strong>
          <Apple size={18} aria-hidden="true" />
          1 <ArrowRight size={16} aria-hidden="true" />
          <Heart size={18} aria-hidden="true" />
          {classicGoldenAppleHeartExchangeRate}
        </strong>
      </header>

      <div className="classic-apple-exchange__summary">
        <span>{t('ui.classicEndgame.exchange.inventory', { apples: formatExchangeNumber(allPreview.availableApples) })}</span>
        <span>{t('ui.classicEndgame.exchange.allValue', { hearts: formatExchangeNumber(allPreview.heartAmount) })}</span>
      </div>

      <div className="classic-apple-exchange__actions" role="group" aria-label={t('ui.classicEndgame.exchange.actionsAria')}>
        <button
          type="button"
          className="secondary-button"
          disabled={!onePreview.canExchange}
          onClick={() => requestExchange(1, false)}
        >
          {t('ui.classicEndgame.exchange.one')}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!tenPreview.canExchange || tenPreview.appleAmount < 10}
          onClick={() => requestExchange(10, true)}
        >
          {t('ui.classicEndgame.exchange.ten')}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!allPreview.canExchange}
          onClick={() => requestExchange(allPreview.availableApples, true)}
        >
          {t('ui.classicEndgame.exchange.all', { apples: formatExchangeNumber(allPreview.availableApples) })}
        </button>
      </div>

      {pendingPreview?.canExchange && (
        <ConfirmDialog
          title={t('ui.classicEndgame.exchange.confirm.title')}
          message={t('ui.classicEndgame.exchange.confirm.message', {
            apples: formatExchangeNumber(pendingPreview.appleAmount),
            hearts: formatExchangeNumber(pendingPreview.heartAmount),
          })}
          cancelLabel={t('ui.classicEndgame.exchange.confirm.cancel')}
          confirmLabel={t('ui.classicEndgame.exchange.confirm.confirm')}
          onCancel={() => setPendingApples(null)}
          onConfirm={confirmExchange}
        />
      )}
    </section>
  );
};
