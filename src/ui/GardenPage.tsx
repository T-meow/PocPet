import { useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Cloud, CloudRain, Droplets, Flower2, Leaf, Pickaxe, ShoppingBag, Sparkles, Sprout, Sun, Wind, Wrench, X, type LucideIcon } from 'lucide-react';
import { currencyIcon, giftBoxIcon, treeStageImages } from '../assets';
import {
  gardenFertilizerItemIds,
  gardenNutrientItemId,
  gardenSlotCount,
  gardenSlotUnlockCosts,
  gardenToolIds,
  gardenTreeDefinitions,
  gardenTreeIds,
  gardenTreeSaplingItemIds,
  formatGardenCareDuration,
  getGardenCarePreview,
  getGardenClearCost,
  getGardenEnvironmentEffects,
  getGardenStage,
  getGardenToolUpgradeCost,
  getGardenView,
  getSeasonInfo,
  getEffectiveDailyDateKey,
  weatherInfo,
  type GardenCarePreview,
  type GardenFertilizerId,
  type GardenToolId,
  type GardenTreeId,
  type PetState,
  type WeatherType,
} from '../core/pet';
import { t } from '../i18n';
import { DialogShell } from './DialogShell';

interface GardenPageProps {
  pet: PetState;
  itemIconMap: Partial<Record<string, string>>;
  onBack: () => void;
  onSelectSlot: (slotIndex: number) => void;
  onUnlockSlot: (slotIndex: number) => void;
  onPlantTree: (slotIndex: number, treeId: GardenTreeId) => void;
  onWater: (slotIndex: number) => void;
  onFertilize: (slotIndex: number, fertilizerId: GardenFertilizerId) => void;
  onNutrient: (slotIndex: number) => void;
  onHarvest: (slotIndex: number) => void;
  onClear: (slotIndex: number) => void;
  onUpgradeTool: (toolId: GardenToolId) => void;
  onOpenShop: () => void;
  compensationCoins?: number;
  onClaimCompensation?: () => void;
}

const toolLevel = (pet: PetState, toolId: GardenToolId) => {
  if (toolId === 'watering_can') return pet.garden.tools.wateringCanLevel;
  if (toolId === 'shovel') return pet.garden.tools.shovelLevel;
  return pet.garden.tools.fertilizerBoxLevel;
};

const formatGardenCountdown = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
};

const getGardenCarePreviewText = (preview: GardenCarePreview, itemCount?: number) => {
  if (preview.blockedReason === 'minimum_remaining') return t('ui.garden.careMinimumRemaining');
  if (preview.blockedReason === 'round_limit') return t('ui.garden.careReductionLimitReached');
  const time = formatGardenCareDuration(preview.actualReductionMs);
  return itemCount === undefined
    ? t('ui.garden.waterPreview', { time })
    : t('ui.garden.fertilizerPreview', { count: itemCount, time });
};

const weatherIcons: Record<WeatherType, LucideIcon> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  breezy: Wind,
};

type GardenActionDialog = 'plant' | 'tools' | null;

export const GardenPage = ({ pet, itemIconMap, onBack, onSelectSlot, onUnlockSlot, onPlantTree, onWater, onFertilize, onNutrient, onHarvest, onClear, onUpgradeTool, onOpenShop, compensationCoins = 0, onClaimCompensation }: GardenPageProps) => {
  const [actionDialog, setActionDialog] = useState<GardenActionDialog>(null);
  const now = Date.now();
  const effectiveDateKey = getEffectiveDailyDateKey(pet, now);
  const view = getGardenView(pet, now);
  const environment = getGardenEnvironmentEffects(pet, now);
  const currentWeather = weatherInfo[environment.weather];
  const season = getSeasonInfo(now);
  const WeatherIcon = weatherIcons[environment.weather];
  const slot = view.activeSlot;
  const slotView = view.slotViews[slot.slotIndex];
  const treeImage = treeStageImages[Math.max(0, Math.min(4, (slotView?.stage ?? getGardenStage(slot)) - 1))];
  const unlockCost = gardenSlotUnlockCosts[slot.slotIndex] ?? 0;
  const clearCost = getGardenClearCost(pet.garden.tools);
  const wateredToday = slot.lastWateredDateKey === effectiveDateKey;
  const fertilizedToday = slot.lastFertilizedDateKey === effectiveDateKey;
  const boostedToday = slot.lastBoostedDateKey === effectiveDateKey;
  const normalFertilizerCount = pet.inventory[gardenFertilizerItemIds.normal] ?? 0;
  const heartFertilizerCount = pet.inventory[gardenFertilizerItemIds.heart] ?? 0;
  const waterPreview = getGardenCarePreview(view.pet, slot, 'water', now);
  const normalFertilizerPreview = getGardenCarePreview(view.pet, slot, 'normal', now);
  const heartFertilizerPreview = getGardenCarePreview(view.pet, slot, 'heart', now);

  return (
    <section className="garden-page" aria-label={t('ui.garden.aria')}>
      <header className="garden-page__header">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t('ui.garden.back')} title={t('ui.garden.back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <div className="garden-page__heading">
          <div className="garden-page__title-row">
            <h2>{t('ui.garden.title')}</h2>
            <strong>{t('ui.garden.lifetimeHarvest', { count: pet.garden.lifetimeHarvestCount })}</strong>
          </div>
        </div>
      </header>

      <div className="garden-layout">
        <div className="garden-stage-panel">
          <div className="garden-slot-nav">
            <button type="button" className="garden-arrow" disabled={slot.slotIndex <= 0} onClick={() => onSelectSlot(slot.slotIndex - 1)} aria-label={t('ui.garden.prevSlot')}><ChevronLeft size={25} /></button>
            <div className="garden-slot-tabs" role="tablist" aria-label={t('ui.garden.slotsAria')}>
              {view.garden.slots.map((item) => (
                <button type="button" role="tab" aria-selected={item.slotIndex === slot.slotIndex} key={item.slotIndex} className={item.slotIndex === slot.slotIndex ? 'garden-slot-tab garden-slot-tab--active' : 'garden-slot-tab'} onClick={() => onSelectSlot(item.slotIndex)}>
                  {item.slotIndex + 1}
                  {item.state === 'ready' && <i className="garden-dot garden-dot--ready" />}
                  {item.state === 'withered' && <i className="garden-dot garden-dot--withered" />}
                </button>
              ))}
            </div>
            <button type="button" className="garden-arrow" disabled={slot.slotIndex >= gardenSlotCount - 1} onClick={() => onSelectSlot(slot.slotIndex + 1)} aria-label={t('ui.garden.nextSlot')}><ChevronRight size={25} /></button>
          </div>
          <div className={`garden-tree-stage garden-tree-stage--weather-${environment.weather} garden-tree-stage--season-${environment.season}${slot.state === 'withered' ? ' garden-tree-stage--withered' : ''}`}>
            <section className="garden-environment" aria-label={t('ui.garden.environmentAria')}>
              <div className={`garden-environment__item garden-environment__item--weather garden-environment__item--weather-${environment.weather}`}>
                <span className="garden-environment__icon garden-environment__icon--weather" aria-hidden="true"><WeatherIcon size={18} /></span>
                <span><strong>{t('ui.garden.weatherLabel', { weather: currentWeather.label })}</strong><small>{t(`ui.garden.weatherEffects.${environment.weather}`)}</small></span>
              </div>
              <div className={`garden-environment__item garden-environment__item--season garden-environment__item--season-${environment.season}`}>
                <span className="garden-environment__icon garden-environment__icon--season" aria-hidden="true"><CalendarDays size={18} /></span>
                <span><strong>{t('ui.garden.seasonLabel', { season: season.label })}</strong><small>{t(`ui.garden.seasonEffects.${environment.season}`)}</small></span>
              </div>
            </section>
            <span className="garden-tree-stage__weather" aria-hidden="true" />
            <span className="garden-tree-stage__plot" aria-hidden="true" />
            {onClaimCompensation && compensationCoins > 0 && (
              <button type="button" className="garden-gift-bubble" onClick={onClaimCompensation} aria-label={t('ui.garden.compensationGiftLabel', { coins: compensationCoins })} title={t('ui.garden.compensationGiftLabel', { coins: compensationCoins })}>
                <img src={giftBoxIcon} alt="" aria-hidden="true" />
                <span>{t('ui.garden.compensationGiftCoins', { coins: compensationCoins })}</span>
              </button>
            )}
            {slot.state === 'empty' || !slot.treeId ? <Sprout size={92} aria-hidden="true" /> : <img src={treeImage} alt="" aria-hidden="true" />}
            <button type="button" className="garden-tools-button garden-tools-button--stage" onClick={() => setActionDialog('tools')} aria-label={t('ui.garden.openTools')} title={t('ui.garden.openTools')}>
              <Wrench size={19} aria-hidden="true" />
              <span>{t('ui.garden.toolsButton')}</span>
            </button>
            {slot.state === 'ready' && (
              <div className="garden-drops">
                {slot.pendingDrops.map((drop) => (
                  <span className="garden-drop" key={drop.kind === 'coins' ? 'coins' : drop.itemId} title={drop.kind === 'coins' ? t('ui.garden.coinDropTitle', { coins: drop.amount }) : t('ui.garden.dropTitle', { count: drop.amount })}>
                    {drop.kind === 'coins' ? <img src={currencyIcon} alt="" aria-hidden="true" /> : drop.itemId && itemIconMap[drop.itemId] ? <img src={itemIconMap[drop.itemId]} alt="" aria-hidden="true" /> : <Sparkles size={20} />}
                    {drop.kind === 'coins' ? <strong>+{drop.amount}</strong> : drop.amount > 1 && <strong>x{drop.amount}</strong>}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="garden-progress-card">
            <strong>{t('ui.garden.slotTitle', { slot: slot.slotIndex + 1 })}</strong>
            <span>{slot.unlocked ? t(`ui.garden.states.${slot.state}`) : t('ui.garden.states.locked')}</span>
            {slot.treeId && <small>{t('ui.garden.treeLife', { tree: t(`ui.garden.trees.${slot.treeId}.name`), used: slot.harvestsUsed, max: slot.maxHarvests })}</small>}
            {slot.state === 'growing' && <small>{t('ui.garden.remaining', { time: formatGardenCountdown(slotView?.remainingMs ?? 0) })}</small>}
            {slot.state === 'growing' && <div className="garden-progress"><i style={{ width: `${Math.round(slotView?.progressPercent ?? 0)}%` }} /></div>}
          </div>
        </div>
      </div>

      <div className="garden-action-grid">
        {!slot.unlocked && <button type="button" className="primary-button" disabled={pet.coins < unlockCost} onClick={() => onUnlockSlot(slot.slotIndex)}>{t('ui.garden.unlockSlot', { coins: unlockCost })}</button>}
        {slot.unlocked && slot.state === 'empty' && (
          <button type="button" className="primary-button garden-plant-button" onClick={() => setActionDialog('plant')}>
            <Sprout size={18} aria-hidden="true" />
            {t('ui.garden.chooseSapling')}
          </button>
        )}
        {slot.state === 'growing' && <>
          <button type="button" className="garden-choice" disabled={wateredToday || waterPreview.actualReductionMs <= 0} onClick={() => onWater(slot.slotIndex)}><Droplets size={18} /><span><strong>{t('ui.garden.actions.water')}</strong><small>{getGardenCarePreviewText(waterPreview)}</small></span></button>
          <button type="button" className="garden-choice" disabled={fertilizedToday || normalFertilizerCount <= 0 || normalFertilizerPreview.actualReductionMs <= 0} onClick={() => onFertilize(slot.slotIndex, 'normal')}><Flower2 size={18} /><span><strong>{t('ui.garden.actions.normalFertilizer')}</strong><small>{getGardenCarePreviewText(normalFertilizerPreview, normalFertilizerCount)}</small></span></button>
          <button type="button" className="garden-choice" disabled={fertilizedToday || heartFertilizerCount <= 0 || heartFertilizerPreview.actualReductionMs <= 0} onClick={() => onFertilize(slot.slotIndex, 'heart')}><Sparkles size={18} /><span><strong>{t('ui.garden.actions.heartFertilizer')}</strong><small>{getGardenCarePreviewText(heartFertilizerPreview, heartFertilizerCount)}</small></span></button>
          <button type="button" className="garden-choice" disabled={boostedToday || (pet.inventory[gardenNutrientItemId] ?? 0) <= 0} onClick={() => onNutrient(slot.slotIndex)}><Sparkles size={18} /><span><strong>{t('ui.garden.actions.nutrient')}</strong><small>{t('ui.garden.itemOwned', { count: pet.inventory[gardenNutrientItemId] ?? 0 })}</small></span></button>
        </>}
        {slot.state === 'ready' && <button type="button" className="primary-button garden-harvest-button" onClick={() => onHarvest(slot.slotIndex)}>{t('ui.garden.actions.harvest')}</button>}
        {slot.treeId && slot.state !== 'empty' && slot.state !== 'withered' && <button type="button" className="danger-button garden-clear-button" disabled={pet.coins < clearCost} onClick={() => onClear(slot.slotIndex)}>{t('ui.garden.actions.remove', { coins: clearCost })}</button>}
        {slot.state === 'withered' && <button type="button" className="danger-button garden-clear-button" disabled={pet.coins < clearCost} onClick={() => onClear(slot.slotIndex)}>{t('ui.garden.actions.clear', { coins: clearCost })}</button>}
      </div>

      {actionDialog && (
        <DialogShell className="garden-action-modal" labelId="garden-action-title" onClose={() => setActionDialog(null)}>
          <header className="dialog-header">
            <div className="dialog-title-group">
              <span className="dialog-title-icon" aria-hidden="true">{actionDialog === 'plant' ? <Sprout size={22} /> : <Wrench size={22} />}</span>
              <div>
                <h2 id="garden-action-title">{actionDialog === 'plant' ? t('ui.garden.plantDialogTitle') : t('ui.garden.toolsDialogTitle')}</h2>
              </div>
            </div>
            <button type="button" className="icon-button" onClick={() => setActionDialog(null)} aria-label={t('ui.garden.closeDialog')} title={t('ui.garden.closeDialog')}>
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          {actionDialog === 'plant' ? (
            <>
              <div className="garden-dialog-list">
                {gardenTreeIds.map((treeId) => {
                  const saplingItemId = gardenTreeSaplingItemIds[treeId];
                  const count = pet.inventory[saplingItemId] ?? 0;
                  const icon = itemIconMap[saplingItemId];
                  return (
                    <article className="garden-dialog-item" key={treeId}>
                      <span className="garden-dialog-item__icon">{icon ? <img src={icon} alt="" aria-hidden="true" /> : <Leaf size={24} aria-hidden="true" />}</span>
                      <div>
                        <strong>{t(`ui.garden.trees.${treeId}.name`)}</strong>
                        <small>{count > 0 ? t('ui.garden.saplingOwned', { count }) : t('ui.garden.needSapling', { coins: gardenTreeDefinitions[treeId].price })}</small>
                      </div>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={count <= 0}
                        onClick={() => {
                          onPlantTree(slot.slotIndex, treeId);
                          setActionDialog(null);
                        }}
                      >
                        {t('ui.garden.plantAction')}
                      </button>
                    </article>
                  );
                })}
              </div>
              <button type="button" className="secondary-button garden-dialog-shop" onClick={() => { setActionDialog(null); onOpenShop(); }}>
                <ShoppingBag size={17} aria-hidden="true" />
                {t('ui.garden.buySaplings')}
              </button>
            </>
          ) : (
            <div className="garden-dialog-list">
              {gardenToolIds.map((toolId) => {
                const level = toolLevel(pet, toolId);
                const cost = getGardenToolUpgradeCost(pet.garden.tools, toolId);
                return (
                  <article className="garden-dialog-item" key={toolId}>
                    <span className="garden-dialog-item__icon"><Pickaxe size={24} aria-hidden="true" /></span>
                    <div>
                      <strong>{t(`ui.garden.tools.${toolId}.name`)}</strong>
                      <small>{cost > 0 ? t('ui.garden.toolUpgrade', { level: level + 1, coins: cost }) : t('ui.garden.maxTool')}</small>
                    </div>
                    <button type="button" className="primary-button" disabled={cost <= 0 || pet.coins < cost} onClick={() => onUpgradeTool(toolId)}>
                      {cost > 0 ? t('ui.garden.upgradeTool') : t('ui.garden.maxTool')}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </DialogShell>
      )}
    </section>
  );
};
