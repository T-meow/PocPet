import { useState } from 'react';
import { ArrowLeft, Cloud, CloudRain, Droplets, Flower2, Leaf, LockKeyhole, Pickaxe, Plus, Recycle, ShoppingBag, Sparkles, Sprout, Sun, Wind, Wrench, X, type LucideIcon } from 'lucide-react';
import { currencyIcon, giftBoxIcon, treeStageImages } from '../assets';
import {
  gardenFertilizerItemIds,
  gardenNutrientItemId,
  gardenSlotUnlockCosts,
  gardenToolIds,
  gardenTreeDefinitions,
  gardenTreeIds,
  gardenTreeSaplingItemIds,
  formatGardenCareDuration,
  getGardenCarePreview,
  getGardenClearCost,
  getGardenEnvironmentEffects,
  getGardenSaplingRecycleCoins,
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
import { activityText as L } from '../core/kitchenRecipes';
import { formatPracticeSkillXp, partnerScheduleMaxSkillLevel } from '../core/partnerSchedule';

interface GardenPageProps {
  pet: PetState;
  itemIconMap: Partial<Record<string, string>>;
  onBack: () => void;
  onUnlockSlot: (slotIndex: number) => void;
  onPlantTree: (slotIndex: number, treeId: GardenTreeId) => void;
  onRecycleSapling: (treeId: GardenTreeId) => void;
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

type GardenActionDialog = { kind: 'plant'; slotIndex: number } | { kind: 'tools' } | null;

export const GardenPage = ({ pet, itemIconMap, onBack, onUnlockSlot, onPlantTree, onRecycleSapling, onWater, onFertilize, onNutrient, onHarvest, onClear, onUpgradeTool, onOpenShop, compensationCoins = 0, onClaimCompensation }: GardenPageProps) => {
  const [actionDialog, setActionDialog] = useState<GardenActionDialog>(null);
  const now = Date.now();
  const effectiveDateKey = getEffectiveDailyDateKey(pet, now);
  const view = getGardenView(pet, now);
  const environment = getGardenEnvironmentEffects(pet, now);
  const currentWeather = weatherInfo[environment.weather];
  const season = getSeasonInfo(now);
  const WeatherIcon = weatherIcons[environment.weather];
  const clearCost = getGardenClearCost(pet.garden.tools);
  const normalFertilizerCount = pet.inventory[gardenFertilizerItemIds.normal] ?? 0;
  const heartFertilizerCount = pet.inventory[gardenFertilizerItemIds.heart] ?? 0;
  const nutrientCount = pet.inventory[gardenNutrientItemId] ?? 0;
  const plantSlot = actionDialog?.kind === 'plant' ? view.garden.slots[actionDialog.slotIndex] : undefined;

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

      <section className={`garden-board v2-card scene-${environment.season}`}>
        <div className="v2-card-heading">
          <div><p className="eyebrow">A LITTLE GARDEN</p><h3>{L('五块土地，一点期待', 'Five plots, little hopes')}</h3></div>
          <button type="button" className="secondary-button" onClick={() => setActionDialog({ kind: 'tools' })}><Wrench size={17} />{t('ui.garden.toolsButton')}</button>
        </div>
        {onClaimCompensation && compensationCoins > 0 && (
          <button type="button" className="secondary-button garden-board-gift" onClick={onClaimCompensation}>
            <img src={giftBoxIcon} alt="" aria-hidden="true" />
            {t('ui.garden.compensationGiftLabel', { coins: compensationCoins })}
          </button>
        )}
        {pet.partnerSchedule.skills.garden.level < partnerScheduleMaxSkillLevel && <p className="garden-practice-hint">{L('每次成功浇水、施肥或收获：', 'Each successful watering, fertilizing or harvest: ')}{formatPracticeSkillXp('garden')}</p>}
        <div className="garden-plot-grid">
          {view.garden.slots.map((plot) => {
            const plotView = view.slotViews[plot.slotIndex];
            const state = plot.unlocked ? plot.state : 'locked';
            const unlockCost = gardenSlotUnlockCosts[plot.slotIndex] ?? 0;
            const wateredToday = plot.lastWateredDateKey === effectiveDateKey;
            const fertilizedToday = plot.lastFertilizedDateKey === effectiveDateKey;
            const boostedToday = plot.lastBoostedDateKey === effectiveDateKey;
            const waterPreview = getGardenCarePreview(view.pet, plot, 'water', now);
            const normalFertilizerPreview = getGardenCarePreview(view.pet, plot, 'normal', now);
            const heartFertilizerPreview = getGardenCarePreview(view.pet, plot, 'heart', now);
            return (
              <article key={plot.slotIndex} className={`garden-plot garden-plot--${state}`} aria-label={t('ui.garden.slotTitle', { slot: plot.slotIndex + 1 })}>
                <span className="garden-plot-label">0{plot.slotIndex + 1}<span>{t(`ui.garden.states.${state}`)}</span></span>
                <span className="garden-plot-art" aria-hidden="true">
                  {plot.treeId ? <img src={treeStageImages[Math.max(0, Math.min(4, (plotView?.stage ?? getGardenStage(plot)) - 1))]} alt="" /> : state === 'locked' ? <LockKeyhole size={34} /> : <Plus size={34} />}
                </span>
                <strong>{plot.treeId ? t(`ui.garden.trees.${plot.treeId}.name`) : state === 'locked' ? L('再拓一片小天地', 'Room for more') : L('种下一份期待', 'Plant a little hope')}</strong>
                {plot.treeId && <small>{L(`已收获 ${plot.harvestsUsed}/${plot.maxHarvests} 次`, `Harvests ${plot.harvestsUsed}/${plot.maxHarvests}`)}</small>}
                <small>{state === 'growing' ? t('ui.garden.remaining', { time: formatGardenCountdown(plotView?.remainingMs ?? 0) }) : state === 'ready' ? L('果实已经成熟啦', 'Ready to harvest') : state === 'withered' ? L('清理后可以重新种植', 'Clear to plant again') : state === 'locked' ? L('解锁后可以种植', 'Unlock to start planting') : L('从背包选择种苗', 'Choose a seedling')}</small>
                {state === 'growing' && <span className="garden-progress"><i style={{ width: `${plotView?.progressPercent ?? 0}%` }} /></span>}
                {plot.hasNutrientBoost && state === 'growing' && <small>{L('下次收获有额外产物', 'Extra produce next harvest')}</small>}
                {state === 'ready' && <div className="garden-plot-drops">
                  {plot.pendingDrops.map((drop) => (
                    <span key={drop.kind === 'coins' ? 'coins' : drop.itemId} title={drop.kind === 'coins' ? t('ui.garden.coinDropTitle', { coins: drop.amount }) : t('ui.garden.dropTitle', { count: drop.amount })}>
                      {drop.kind === 'coins' ? <img src={currencyIcon} alt="" /> : drop.itemId && itemIconMap[drop.itemId] ? <img src={itemIconMap[drop.itemId]} alt="" /> : <Sparkles size={18} />}
                      <strong>{drop.kind === 'coins' ? `+${drop.amount}` : `x${drop.amount}`}</strong>
                    </span>
                  ))}
                </div>}
                <div className="garden-plot-actions">
                  {state === 'locked' && <button type="button" className="primary-button" disabled={pet.coins < unlockCost} onClick={() => onUnlockSlot(plot.slotIndex)}>{t('ui.garden.unlockSlot', { coins: unlockCost })}</button>}
                  {state === 'empty' && <button type="button" className="primary-button garden-plant-button" onClick={() => setActionDialog({ kind: 'plant', slotIndex: plot.slotIndex })}><Sprout size={18} />{t('ui.garden.chooseSapling')}</button>}
                  {state === 'growing' && <button type="button" className="garden-choice" disabled={wateredToday || waterPreview.actualReductionMs <= 0} onClick={() => onWater(plot.slotIndex)}><Droplets size={18} /><span><strong>{t('ui.garden.actions.water')}</strong><small>{wateredToday ? L('今天已浇水', 'Watered today') : getGardenCarePreviewText(waterPreview)}</small></span></button>}
                  {state === 'ready' && <button type="button" className="primary-button garden-harvest-button" onClick={() => onHarvest(plot.slotIndex)}>{t('ui.garden.actions.harvest')}</button>}
                  {state === 'withered' && <button type="button" className="danger-button" disabled={pet.coins < clearCost} onClick={() => onClear(plot.slotIndex)}>{t('ui.garden.actions.clear', { coins: clearCost })}</button>}
                  {(state === 'growing' || state === 'ready') && <details className="garden-plot-care">
                    <summary>{state === 'growing' ? L('施肥 / 管理', 'Feed / manage') : L('管理树木', 'Manage tree')}</summary>
                    <div className="garden-plot-care-actions">
                      {state === 'growing' && <>
                        <button type="button" className="garden-choice" disabled={fertilizedToday || normalFertilizerCount <= 0 || normalFertilizerPreview.actualReductionMs <= 0} onClick={() => onFertilize(plot.slotIndex, 'normal')}><Flower2 size={18} /><span><strong>{t('ui.garden.actions.normalFertilizer')}</strong><small>{fertilizedToday ? L('今天已施肥', 'Fertilized today') : getGardenCarePreviewText(normalFertilizerPreview, normalFertilizerCount)}</small></span></button>
                        <button type="button" className="garden-choice" disabled={fertilizedToday || heartFertilizerCount <= 0 || heartFertilizerPreview.actualReductionMs <= 0} onClick={() => onFertilize(plot.slotIndex, 'heart')}><Sparkles size={18} /><span><strong>{t('ui.garden.actions.heartFertilizer')}</strong><small>{fertilizedToday ? L('今天已施肥', 'Fertilized today') : getGardenCarePreviewText(heartFertilizerPreview, heartFertilizerCount)}</small></span></button>
                        <button type="button" className="garden-choice" disabled={boostedToday || nutrientCount <= 0} onClick={() => onNutrient(plot.slotIndex)}><Sparkles size={18} /><span><strong>{t('ui.garden.actions.nutrient')}</strong><small>{boostedToday ? L('今天已使用', 'Used today') : t('ui.garden.itemOwned', { count: nutrientCount })}</small></span></button>
                      </>}
                      <button type="button" className="danger-button" disabled={pet.coins < clearCost} onClick={() => onClear(plot.slotIndex)}>{t('ui.garden.actions.remove', { coins: clearCost })}</button>
                    </div>
                  </details>}
                </div>
              </article>
            );
          })}
        </div>
        <div className="garden-board-environment" aria-label={t('ui.garden.environmentAria')}><strong><WeatherIcon size={17} />{currentWeather.label} · {season.label}</strong><p>{t(`ui.garden.weatherEffects.${environment.weather}`)} · {t(`ui.garden.seasonEffects.${environment.season}`)}</p></div>
      </section>

      {actionDialog && (
        <DialogShell className="garden-action-modal" labelId="garden-action-title" onClose={() => setActionDialog(null)}>
          <header className="dialog-header">
            <div className="dialog-title-group">
              <span className="dialog-title-icon" aria-hidden="true">{actionDialog.kind === 'plant' ? <Sprout size={22} /> : <Wrench size={22} />}</span>
              <div>
                <h2 id="garden-action-title">{actionDialog.kind === 'plant' ? t('ui.garden.plantDialogTitle') : t('ui.garden.toolsDialogTitle')}</h2>
                {actionDialog.kind === 'plant' && <p>{t('ui.garden.slotTitle', { slot: actionDialog.slotIndex + 1 })}</p>}
              </div>
            </div>
            <button type="button" className="icon-button" onClick={() => setActionDialog(null)} aria-label={t('ui.garden.closeDialog')} title={t('ui.garden.closeDialog')}>
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          {actionDialog.kind === 'plant' ? (
            <>
              <div className="garden-dialog-list">
                {gardenTreeIds.map((treeId) => {
                  const saplingItemId = gardenTreeSaplingItemIds[treeId];
                  const count = pet.inventory[saplingItemId] ?? 0;
                  const icon = itemIconMap[saplingItemId];
                  const recycleCoins = getGardenSaplingRecycleCoins(treeId);
                  return (
                    <article className="garden-dialog-item" key={treeId}>
                      <span className="garden-dialog-item__icon">{icon ? <img src={icon} alt="" aria-hidden="true" /> : <Leaf size={24} aria-hidden="true" />}</span>
                      <div>
                        <strong>{t(`ui.garden.trees.${treeId}.name`)}</strong>
                        <small>{count > 0 ? t('ui.garden.saplingOwned', { count }) : t('ui.garden.needSapling', { coins: gardenTreeDefinitions[treeId].price })}</small>
                      </div>
                      <div className="garden-dialog-item__actions">
                        <button
                          type="button"
                          className="primary-button"
                          disabled={count <= 0 || !plantSlot?.unlocked || plantSlot.state !== 'empty'}
                          onClick={() => {
                            onPlantTree(actionDialog.slotIndex, treeId);
                            setActionDialog(null);
                          }}
                        >
                          {t('ui.garden.plantAction')}
                        </button>
                        {recycleCoins > 0 && (
                          <button type="button" className="secondary-button" disabled={count <= 0} onClick={() => onRecycleSapling(treeId)}>
                            <Recycle size={16} aria-hidden="true" />
                            {t('ui.garden.recycleSapling', { coins: recycleCoins })}
                          </button>
                        )}
                      </div>
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
