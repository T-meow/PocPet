import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Cloud, CloudRain, Sparkles, Sun, Wind, X, type LucideIcon } from 'lucide-react';
import { getPartnerScheduleActivity, getPrimaryStatus, getSeasonInfo, getStatusText, weatherInfo, type PetState, type PetStatus, type RecentActivity, type WeatherType } from '../core/pet';
import { petActivityImages as defaultPetActivityImages, petStatusImages as defaultPetStatusImages } from '../assets';
import { t } from '../i18n';
import { formatCompactNumber } from './numberFormat';
import { RoomBackdrop } from './RoomBackdrop';
import { DialogShell } from './DialogShell';
import { activityText as L } from '../core/kitchenRecipes';

const weatherIcons: Record<WeatherType, LucideIcon> = { sunny: Sun, cloudy: Cloud, rainy: CloudRain, breezy: Wind };
interface PetDisplayProps {
  pet: PetState; onInteract: () => void; canUpgrade: boolean; isPetBusy: boolean;
  nextUpgradeCost: number; onUpgrade: () => void; overlay?: ReactNode;
  petStatusImages?: Record<PetStatus, string>; petActivityImages?: Partial<Record<RecentActivity, string>>;
  getStatusLabel?: (status: PetStatus) => string; onOpenAppearance?: () => void;
}
export const PetDisplay = ({ pet, onInteract, canUpgrade, isPetBusy, nextUpgradeCost, onUpgrade, overlay, petStatusImages = defaultPetStatusImages, petActivityImages = defaultPetActivityImages, getStatusLabel = getStatusText, onOpenAppearance }: PetDisplayProps) => {
  const [showEnvironment, setShowEnvironment] = useState(false);
  const status = getPrimaryStatus(pet);
  const activity = !pet.isSleeping ? (pet.partnerSchedule.active ? getPartnerScheduleActivity(pet.partnerSchedule.active.category) : pet.recentActivity !== 'idle' && pet.recentActivityUntil > Date.now() ? pet.recentActivity : undefined) : undefined;
  const petImage = activity ? petActivityImages[activity] ?? petStatusImages[status] : petStatusImages[status];
  const label = getStatusLabel(status);
  const season = getSeasonInfo(pet.lastUpdatedAt);
  const weather = weatherInfo[pet.weather];
  const WeatherIcon = weatherIcons[pet.weather];
  return <><section className={`pet-scene pet-scene--${status} pet-scene--weather-${pet.weather} scene-${season.id} room-v2${overlay ? ' room-v2--focus' : ''}`} aria-label={t('ui.petDisplay.sceneAria')}>
    <RoomBackdrop season={season.id} />
    <div className="room-top"><button type="button" className="room-environment" onClick={() => setShowEnvironment(true)} aria-haspopup="dialog" aria-expanded={showEnvironment} title={t('ui.petDisplay.expandWeather')}><WeatherIcon size={16} />{weather.label} · {season.label}</button><button type="button" className={canUpgrade && !isPetBusy ? 'pet-level-button pet-level-button--ready' : 'pet-level-button'} disabled={isPetBusy} title={isPetBusy ? t('ui.petDisplay.partnerScheduleBusy') : nextUpgradeCost > 0 ? t('ui.features.upgradeTitle', { cost: nextUpgradeCost }) : t('ui.features.maxLevel')} onClick={onUpgrade}><Sparkles size={16} /><span>{t('ui.features.level', { level: pet.level })}</span><small>{nextUpgradeCost > 0 ? t('ui.features.cost', { cost: formatCompactNumber(nextUpgradeCost) }) : t('ui.features.maxLevel')}</small></button></div>
    {overlay}
    <button type="button" className={`pet pet--image pet--${status}`} disabled={isPetBusy} title={isPetBusy ? t('ui.petDisplay.partnerScheduleBusy') : undefined} onClick={onInteract} aria-label={isPetBusy ? t('ui.petDisplay.partnerScheduleBusy') : t('ui.petDisplay.interactAria')}><img src={petImage} alt={activity ? t('ui.petDisplay.activityAlt', { name: pet.name }) : t('ui.petDisplay.statusAlt', { name: pet.name, status: label })} draggable="false" /></button>
    <span className="room-caption">{label}</span>
  </section>{showEnvironment && createPortal(<DialogShell className="environment-details-modal" labelId="environment-details-title" onClose={() => setShowEnvironment(false)}>
    <header className="dialog-header"><h2 id="environment-details-title">{L('天气与季节', 'Weather and season')}</h2><button className="icon-button" onClick={() => setShowEnvironment(false)} aria-label={L('关闭', 'Close')}><X /></button></header>
    <div className="environment-details-list">
      <section><h3><WeatherIcon size={20} />{weather.label}</h3><p>{weather.summary}</p><p className="environment-garden-effect">{L('种植园：', 'Garden: ')}{t(`ui.garden.weatherEffects.${pet.weather}`)}</p></section>
      <section><h3><CalendarDays size={20} />{season.label}</h3><p>{season.summary}</p><p className="environment-garden-effect">{L('种植园：', 'Garden: ')}{t(`ui.garden.seasonEffects.${season.id}`)}</p></section>
    </div>
    {onOpenAppearance && <button className="secondary-button" onClick={() => { setShowEnvironment(false); onOpenAppearance(); }}>{L('外观设置', 'Appearance settings')}</button>}
  </DialogShell>, document.querySelector('.ui-v2-app') ?? document.body)}</>;
};
