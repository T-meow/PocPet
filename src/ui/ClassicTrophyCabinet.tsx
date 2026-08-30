import { Gem, Lock, Trophy } from 'lucide-react';
import {
  classicTrophyDefinitions,
  classicTrophyTotal,
  getClassicTrophyCount,
  isClassicDiamondTrophyUnlocked,
  isClassicTrophyUnlocked,
  type ClassicTrophyDefinition,
  type PartnerScheduleCategory,
  type PetState,
} from '../core/pet';
import { t } from '../i18n';

interface ClassicTrophyCabinetProps {
  pet: PetState;
}

const getTrophyEffectText = (trophy: ClassicTrophyDefinition) => {
  const effectKeyByCategory: Record<PartnerScheduleCategory, string> = {
    study: 'schedule',
    cooking: 'food',
    garden: 'garden',
    exercise: 'energy',
  };
  return t(`ui.classicEndgame.trophies.effects.${effectKeyByCategory[trophy.category]}`, {
    value: trophy.effectValue,
  });
};

export const ClassicTrophyCabinet = ({ pet }: ClassicTrophyCabinetProps) => {
  const unlockedCount = getClassicTrophyCount(pet);
  const diamondUnlocked = isClassicDiamondTrophyUnlocked(pet);

  return (
    <section className="classic-trophy-cabinet" aria-labelledby="classic-trophy-title">
      <header className="classic-trophy-cabinet__header">
        <div>
          <h2 id="classic-trophy-title">{t('ui.classicEndgame.trophies.title')}</h2>
          <p>{t('ui.classicEndgame.trophies.summary')}</p>
        </div>
        <strong>{unlockedCount}/{classicTrophyTotal}</strong>
      </header>

      <div className="classic-trophy-grid">
        {classicTrophyDefinitions.map((trophy) => {
          const unlocked = isClassicTrophyUnlocked(pet, trophy);
          return (
            <article
              className={`classic-trophy classic-trophy--${trophy.tier}${unlocked ? ' is-unlocked' : ' is-locked'}`}
              key={trophy.id}
            >
              <span className="classic-trophy__icon" aria-hidden="true">
                {unlocked ? <Trophy size={22} /> : <Lock size={19} />}
              </span>
              <div>
                <h3>{t(`ui.classicEndgame.trophies.names.${trophy.category}.${trophy.tier}`)}</h3>
                <p>{getTrophyEffectText(trophy)}</p>
                <small>{unlocked
                  ? t('ui.classicEndgame.trophies.unlocked')
                  : t('ui.classicEndgame.trophies.unlockStage', { stage: trophy.requiredStages })}</small>
              </div>
            </article>
          );
        })}
      </div>

      <article className={`classic-trophy classic-trophy--diamond${diamondUnlocked ? ' is-unlocked' : ' is-locked'}`}>
        <span className="classic-trophy__icon" aria-hidden="true">
          {diamondUnlocked ? <Gem size={24} /> : <Lock size={20} />}
        </span>
        <div>
          <h3>{t('ui.classicEndgame.trophies.names.diamond')}</h3>
          <p>{t('ui.classicEndgame.trophies.effects.diamond')}</p>
          <small>{diamondUnlocked
            ? t('ui.classicEndgame.trophies.unlocked')
            : t('ui.classicEndgame.trophies.unlockDiamond', { count: classicTrophyTotal })}</small>
        </div>
      </article>
    </section>
  );
};
