import { BadgeCheck, CalendarClock, Dices, Flag, PackageOpen, Sprout, Timer } from 'lucide-react';
import { canClaimBoostCardDailyReward, classicEndgameUnlockLevel, classicEndgameUnlockSkillLevel, getActiveBoostCard, isClassicEndgameComplete, isClassicEndgameUnlocked, partnerScheduleUnlockLevel, type PetState } from '../core/pet';
import { t } from '../i18n';
import { formatPomodoroTime } from './time';

interface FeatureRowProps {
  pet: PetState;
  inventoryKindCount: number;
  isPomodoroOpen: boolean;
  pomodoroRemainingMs: number;
  pomodoroStartTitle?: string;
  gardenReminder?: 'ready' | 'withered';
  onOpenInventory: () => void;
  onOpenPomodoro: () => void;
  onOpenGarden: () => void;
  onOpenBoostCards: () => void;
  onOpenPartnerSchedule: () => void;
  onOpenGacha: () => void;
  onOpenCommonDreams: () => void;
}

export const FeatureRow = ({
  pet,
  inventoryKindCount,
  isPomodoroOpen,
  pomodoroRemainingMs,
  pomodoroStartTitle,
  gardenReminder,
  onOpenInventory,
  onOpenPomodoro,
  onOpenGarden,
  onOpenBoostCards,
  onOpenPartnerSchedule,
  onOpenGacha,
  onOpenCommonDreams,
}: FeatureRowProps) => {
  const activeBoostCardId = getActiveBoostCard(pet);
  const canClaimBoostReward = canClaimBoostCardDailyReward(pet);
  const boostCardHint = activeBoostCardId
    ? t('ui.features.boostCardsActive', { card: t(`ui.boostCards.cards.${activeBoostCardId}.name`) })
    : undefined;
  const gardenHint = gardenReminder === 'ready'
    ? t('ui.features.gardenReady')
    : gardenReminder === 'withered'
      ? t('ui.features.gardenWithered')
      : t('ui.features.gardenHint');
  const isPartnerScheduleUnlocked = pet.level >= partnerScheduleUnlockLevel;
  const partnerScheduleHint = !isPartnerScheduleUnlocked
    ? t('ui.features.partnerScheduleLocked', { level: partnerScheduleUnlockLevel })
    : pet.partnerSchedule.pendingResult
      ? t('ui.features.partnerScheduleReady')
      : pet.partnerSchedule.active
        ? t('ui.features.partnerScheduleActive')
        : undefined;
  const endgameUnlocked = isClassicEndgameUnlocked(pet);
  const endgameHint = isClassicEndgameComplete(pet)
    ? t('ui.features.commonDreamsComplete', { level: pet.classicEndgame.legacyLevel })
    : endgameUnlocked
      ? t('ui.features.commonDreamsReady')
      : t('ui.features.commonDreamsLocked', {
        level: classicEndgameUnlockLevel,
        skill: classicEndgameUnlockSkillLevel,
        currentSkill: Math.min(...Object.values(pet.partnerSchedule.skills).map((skill) => skill.level)),
      });

  return (
    <div className="feature-row" aria-label={t('ui.features.aria')}>
      <button type="button" className="feature-button feature-button--inventory" onClick={onOpenInventory}>
        <PackageOpen size={20} aria-hidden="true" />
        <span>
          {t('ui.features.inventory')}
          <small>{t('ui.features.inventoryKinds', { count: inventoryKindCount })}</small>
        </span>
      </button>

      <button
        type="button"
        className={pet.pomodoro.isRunning ? 'feature-button feature-button--pomodoro feature-button--active' : 'feature-button feature-button--pomodoro'}
        title={pomodoroStartTitle}
        aria-pressed={isPomodoroOpen}
        onClick={onOpenPomodoro}
      >
        <Timer size={20} aria-hidden="true" />
        <span>
          {t('ui.features.pomodoro')}
          <small>{pet.pomodoro.isRunning ? t('ui.pomodoro.running') : formatPomodoroTime(pomodoroRemainingMs)}</small>
        </span>
        {pet.pomodoro.isRunning && <i aria-hidden="true" />}
      </button>

      <button
        type="button"
        className={canClaimBoostReward ? 'feature-button feature-button--boost-card feature-button--active' : 'feature-button feature-button--boost-card'}
        onClick={onOpenBoostCards}
        title={t('ui.top.openBoostCards')}
      >
        <BadgeCheck size={20} aria-hidden="true" />
        <span>
          {t('ui.features.boostCards')}
          {boostCardHint ? <small>{boostCardHint}</small> : null}
        </span>
        {canClaimBoostReward && <i aria-hidden="true" />}
      </button>

      <button
        type="button"
        className={gardenReminder ? 'feature-button feature-button--garden feature-button--active' : 'feature-button feature-button--garden'}
        onClick={onOpenGarden}
      >
        <Sprout size={20} aria-hidden="true" />
        <span>
          {t('ui.features.garden')}
          <small>{gardenHint}</small>
        </span>
        {gardenReminder && <i aria-hidden="true" />}
      </button>

      <button
        type="button"
        className={pet.partnerSchedule.active || pet.partnerSchedule.pendingResult ? 'feature-button feature-button--partner-schedule feature-button--active' : 'feature-button feature-button--partner-schedule'}
        disabled={!isPartnerScheduleUnlocked}
        onClick={onOpenPartnerSchedule}
        title={partnerScheduleHint}
      >
        <CalendarClock size={20} aria-hidden="true" />
        <span>
          {t('ui.features.partnerSchedule')}
          {partnerScheduleHint ? <small>{partnerScheduleHint}</small> : null}
        </span>
        {pet.partnerSchedule.pendingResult ? <i aria-hidden="true" /> : null}
      </button>

      <button type="button" className="feature-button feature-button--gacha" onClick={onOpenGacha} title={t('ui.features.gachaHint')}>
        <Dices size={20} aria-hidden="true" />
        <span>
          {t('ui.features.gacha')}
          <small>{t('ui.features.gachaTickets', { count: pet.goldenAppleGacha.tickets })}</small>
        </span>
      </button>

      <button
        type="button"
        className={endgameUnlocked ? 'feature-button feature-button--common-dreams feature-button--active' : 'feature-button feature-button--common-dreams'}
        onClick={onOpenCommonDreams}
        title={endgameHint}
      >
        <Flag size={20} aria-hidden="true" />
        <span>
          {t('ui.features.commonDreams')}
          <small>{endgameHint}</small>
        </span>
        {endgameUnlocked && <i aria-hidden="true" />}
      </button>
    </div>
  );
};
