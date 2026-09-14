import { Bath, Bed, Gamepad2 } from 'lucide-react';
import type { PetAction } from '../core/pet';
import { t } from '../i18n';

interface ActionDockProps {
  isSleeping: boolean;
  isLowEnergy: boolean;
  isCriticallyHungry: boolean;
  onAction: (action: PetAction) => void;
}

export const ActionDock = ({
  isSleeping,
  isLowEnergy,
  isCriticallyHungry,
  onAction,
}: ActionDockProps) => {
  const lowEnergyTitle = isLowEnergy ? t('ui.actionDock.lowEnergy') : undefined;
  const lowHungerTitle = isCriticallyHungry ? t('ui.actionDock.lowHunger') : undefined;
  const playWorkBlockedTitle = lowHungerTitle ?? lowEnergyTitle;
  return (
    <div className="action-dock" aria-label={t('ui.actionDock.dock')}>
      <button
        type="button"
        className="action-button action-button--play"
        disabled={isLowEnergy || isCriticallyHungry}
        title={playWorkBlockedTitle}
        onClick={() => onAction('play')}
      >
        <Gamepad2 size={20} aria-hidden="true" />
        <span>{t('ui.actionDock.play')}</span>
      </button>
      <button type="button" className="action-button action-button--clean" disabled={isCriticallyHungry} title={lowHungerTitle} onClick={() => onAction('clean')}>
        <Bath size={20} aria-hidden="true" />
        <span>{t('ui.actionDock.clean')}</span>
      </button>
      <button type="button" className="action-button action-button--sleep" onClick={() => onAction('sleep')}>
        <Bed size={20} aria-hidden="true" />
        <span>{isSleeping ? t('ui.actionDock.wake') : t('ui.actionDock.sleep')}</span>
      </button>
    </div>
  );
};
