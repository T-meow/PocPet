import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import {
  classicTrophyDefinitions, classicTrophyTotal, dreamProjectCategories, getClassicTrophyCount,
  isClassicDiamondTrophyUnlocked, isClassicTrophyUnlocked,
  type ClassicTrophyDefinition, type PartnerScheduleCategory, type PetState,
} from '../core/pet';
import { t } from '../i18n';
import { trophyImages } from '../trophyAssets';
import { dreamCategoryLabel, dreamText } from './dreams/DreamShared';

const getTrophyEffectText = (trophy: ClassicTrophyDefinition) => {
  const effectKey = { study: 'schedule', cooking: 'food', garden: 'garden', exercise: 'energy' }[trophy.category];
  return t(`ui.classicEndgame.trophies.effects.${effectKey}`, {
    value: trophy.effectValue * (trophy.category === 'study' || trophy.category === 'cooking' ? 100 : 1),
  });
};

export const DreamTrophyShelf = ({ pet }: { pet: PetState }) => <span className="dreams-shelf-cups" aria-hidden="true">
  {dreamProjectCategories.map(category => {
    const trophies = classicTrophyDefinitions.filter(trophy => trophy.category === category);
    const unlocked = trophies.filter(trophy => isClassicTrophyUnlocked(pet, trophy));
    const trophy = unlocked[unlocked.length - 1] ?? trophies[0];
    return <img key={category} src={trophyImages[trophy.id]} className={unlocked.length ? '' : 'is-locked'} alt="" draggable={false} />;
  })}
</span>;

export const ClassicTrophyCabinet = ({ pet, category }: { pet: PetState; category?: PartnerScheduleCategory }) => {
  const [selected, setSelected] = useState<PartnerScheduleCategory>('study');
  const current = category ?? selected;
  const diamondUnlocked = isClassicDiamondTrophyUnlocked(pet);
  const trophies = classicTrophyDefinitions.filter(trophy => trophy.category === current);
  const highest = trophies.filter(trophy => isClassicTrophyUnlocked(pet, trophy)).pop();
  return <section className="dreams-trophies" aria-label={t('ui.classicEndgame.trophies.title')}>
    {!category && <div className="dreams-tabs" role="group" aria-label={t('ui.classicEndgame.trophies.title')}>
      {dreamProjectCategories.map(key => <button type="button" key={key} aria-pressed={current === key} onClick={() => setSelected(key)}>{dreamCategoryLabel(key)}</button>)}
    </div>}
    {trophies.map(trophy => {
      const unlocked = isClassicTrophyUnlocked(pet, trophy);
      return <article key={trophy.id} className={`dreams-trophy ${unlocked ? '' : 'is-locked'}`}>
        <img src={trophyImages[trophy.id]} alt="" draggable={false} />
        <div><h3>{t(`ui.classicEndgame.trophies.names.${trophy.category}.${trophy.tier}`)}</h3>
          <p>{getTrophyEffectText(trophy)}</p>
          <small>{unlocked ? <><Check size={12} aria-hidden="true" />{dreamText(!diamondUnlocked && highest?.id === trophy.id ? 'effectActive' : 'collected')}</>
            : <><Lock size={11} aria-hidden="true" />{t('ui.classicEndgame.trophies.unlockStage', { stage: trophy.requiredStages })}</>}</small>
        </div>
      </article>;
    })}
    <p className="dreams-hint">{category ? dreamText('rewardHint') : t('ui.classicEndgame.trophies.summary')}</p>
    {!category && <>
      <p className="dreams-hint">{t('ui.classicEndgame.trophies.title')} · {getClassicTrophyCount(pet)} / {classicTrophyTotal}</p>
      <article className={`dreams-trophy dreams-trophy--diamond ${diamondUnlocked ? '' : 'is-locked'}`}>
        <img src={trophyImages.diamond} alt="" draggable={false} />
        <div><h3>{t('ui.classicEndgame.trophies.names.diamond')}</h3><p>{t('ui.classicEndgame.trophies.unlockDiamond', { count: classicTrophyTotal })}</p><small>{diamondUnlocked ? t('ui.classicEndgame.trophies.unlocked') : dreamText('diamondKey')}</small></div>
      </article>
      <p className="dreams-hint">{t('ui.classicEndgame.trophies.effects.diamond')}</p>
    </>}
  </section>;
};
