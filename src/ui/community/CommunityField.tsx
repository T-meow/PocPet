import { useState } from 'react';
import { getProductionHeartReward } from '../../core/activityHearts';
import { careCommunityCrops, getCommunityCropYield, communityCrops, harvestCommunityCrop, harvestCommunityCrops, plantCommunityCrop, plantCommunityCrops } from '../../core/community';
import { CommunityUpgradeDialog } from './CommunityUpgradeTask';
import { getToolUsesLeft, toolDurabilityLabel } from '../../core/toolDurability';
import { canSpendCompanionTime } from '../../core/kitchen';
import { canDoFarmWork } from '../../core/farmNeighbor';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import { CommunityFieldScene } from './CommunityFieldScene';
import type { CommunityPanelProps } from './types';
import { timeLeft } from './types';
import { cropIds, getCropUnlockReason, type CropId } from '../../core/foodCatalog';
import { HelpButton } from '../help/HelpButton';
import { fieldHelp } from '../help/productionHelp';
import { itemIcons } from '../../assets';

export const CommunityField = (props: CommunityPanelProps) => {
  const { pet, update, onExplore, onKitchen, onShop, onAdventure, itemIconMap, neighbors } = props;
  const [panel, setPanel] = useState<'care' | 'construction' | null>(null);
  const [selectedId, setSelectedId] = useState(1);
  const [seedChoices, setSeedChoices] = useState<Partial<Record<number, CropId>>>({});
  const c = pet.community, plot = c.plots.find(p => p.id === selectedId) ?? c.plots[0], crop = plot.crop, plotId = plot.id;
  const now = pet.timePause ? pet.lastUpdatedAt : Date.now(), free = canDoFarmWork(pet, now), companionFree = !pet.timePause && canSpendCompanionTime(pet);
  const ready = Boolean(crop && now >= crop.readyAt);
  const growth = crop ? Math.min(1, Math.max(0, (now - crop.plantedAt) / Math.max(1, crop.readyAt - crop.plantedAt))) : 0;
  const maturePlots = c.plots.filter(p => p.crop && now >= p.crop.readyAt).map(p => ({ id: p.id, plantedAt: p.crop!.plantedAt }));
  const carePlots = c.plots.filter(p => p.crop && now < p.crop.readyAt && ((!p.crop.watered && getToolUsesLeft(pet, 'field_watering_can') > 0) || (!p.crop.fertilized && (pet.inventory.nutrient_compost ?? 0) > 0))).map(p => ({ id: p.id, plantedAt: p.crop!.plantedAt }));
  const emptyPlots = c.plots.filter(p => !p.crop);
  const selectedSeed = seedChoices[plotId] ?? plot.lastCrop ?? crop?.id ?? cropIds.find(id => (pet.inventory[communityCrops[id].seed] ?? 0) > 0 && !getCropUnlockReason(pet, id)) ?? 'herb';
  const seed = communityCrops[selectedSeed], seedCount = pet.inventory[seed.seed] ?? 0, seedLock = getCropUnlockReason(pet, selectedSeed);
  const sowingPlots = crop ? emptyPlots : [plot, ...emptyPlots.filter(p => p.id !== plotId)];
  const selectedSeeds = seedLock ? [] : sowingPlots.slice(0, seedCount).map(p => ({ plotId: p.id, cropId: selectedSeed }));
  const remainingSeeds = { ...pet.inventory }, repeatSeeds: { plotId: number; cropId: CropId }[] = [];
  for (const p of emptyPlots) {
    if (!p.lastCrop || getCropUnlockReason(pet, p.lastCrop)) continue;
    const seedId = communityCrops[p.lastCrop].seed;
    if ((remainingSeeds[seedId] ?? 0) < 1) continue;
    repeatSeeds.push({ plotId: p.id, cropId: p.lastCrop });
    remainingSeeds[seedId] = (remainingSeeds[seedId] ?? 0) - 1;
  }
  const cropIcon = (id: keyof typeof communityCrops) => itemIconMap?.[communityCrops[id].product] ?? itemIcons[communityCrops[id].product];
  const selector = <label className="community-field-seed-choice"><span>当前地块</span><select value={plotId} onChange={event => setSelectedId(Number(event.target.value))}>{c.plots.map(p => <option key={p.id} value={p.id}>第 {p.id} 块 · {p.crop ? `${communityCrops[p.crop.id].name} · ${now >= p.crop.readyAt ? '已成熟' : timeLeft(p.crop.readyAt, now)}` : '待播种'}</option>)}</select></label>;
  return <>
    <HelpButton {...fieldHelp} />
    <CommunityFieldScene pet={pet} selectedId={plotId} icons={itemIconMap} onSelect={id => { setSelectedId(id); setPanel('care'); }} onExpand={() => setPanel('construction')} />
    {c.gardenBuilt && <section className="community-field-quick" aria-label="菜地快捷操作">
      <div className="community-field-quick-heading"><strong>菜地批量操作</strong><span>成熟 {maturePlots.length} 块 · 空地 {emptyPlots.length} 块</span></div>
      <div className="community-field-quick-actions">
        <button type="button" className="secondary-button" disabled={!free || !carePlots.length} onClick={() => update(p => careCommunityCrops(p, carePlots, Date.now(), neighbors))}>一键照料 · 浇水与施肥</button>
        <button type="button" className="primary-button" disabled={!free || !maturePlots.length} onClick={() => update(p => harvestCommunityCrops(p, maturePlots, Date.now(), neighbors))}>一键收获 · {maturePlots.length} 块</button>
        <button type="button" className="secondary-button" disabled={!free || !repeatSeeds.length} onClick={() => update(p => plantCommunityCrops(p, repeatSeeds, Date.now(), neighbors))}>按上次补种 · {repeatSeeds.length} 块</button>
      </div>
      <p className="community-field-quick-note">按地块顺序照料，已完成或已成熟的地块自动跳过；堆肥 {pet.inventory.nutrient_compost ?? 0} 份 · 浇水壶{toolDurabilityLabel(pet, 'field_watering_can')}。</p>
      {emptyPlots.length > 0 && <>
        {repeatSeeds.length > 0 && <p className="community-field-quick-note">本次补种：{repeatSeeds.map(p => `第 ${p.plotId} 块${communityCrops[p.cropId].name}`).join('、')}</p>}
        <div className="community-field-sowing">
          <label className="community-field-seed-choice"><span>选择种子</span><select value={selectedSeed} disabled={!free} onChange={event => { const id = event.target.value as CropId; setSeedChoices(previous => ({ ...previous, [plotId]: id })); }}>
            {cropIds.map(id => { const d = communityCrops[id], lock = getCropUnlockReason(pet, id); return <option key={id} value={id} disabled={Boolean(lock)}>{d.name} · 种子 {pet.inventory[d.seed] ?? 0}{lock ? ' · 未解锁' : ''}</option>; })}
          </select></label>
          <div className="community-field-seed-detail"><img src={cropIcon(selectedSeed)} alt="" /><span>{seed.hours} 小时 · 收获 {seed.yield} 份 · {getProductionHeartReward(seed.hours)} 心心</span></div>
        </div>
        <div className="community-field-quick-actions">
          <button type="button" className="primary-button" disabled={!free || Boolean(crop) || seedCount < 1 || Boolean(seedLock)} onClick={() => update(p => plantCommunityCrop(p, plotId, selectedSeed, Date.now(), neighbors))}>播种第 {plotId} 块 · 种子 ×1</button>
          {emptyPlots.length > 1 && <button type="button" className="secondary-button" disabled={!free || !selectedSeeds.length} onClick={() => update(p => plantCommunityCrops(p, selectedSeeds, Date.now(), neighbors))}>播种空地 · {selectedSeeds.length} 块</button>}
          <button type="button" className="text-button" onClick={onShop}>补充种子</button>
        </div>
        {(seedLock || seedCount < 1) && <p className="community-field-quick-note">{seedLock || `${seed.name}种子不足`}</p>}
      </>}
    </section>}
    {panel === 'construction' && <CommunityUpgradeDialog {...props} id="garden" onClose={() => setPanel(null)} />}
    {panel === 'care' && <CommunityDetailDialog title={c.gardenBuilt ? `照料第 ${plotId} 块菜地` : '开放第一块菜地'} eyebrow="顺着季节，照顾每一颗种子" onClose={() => setPanel(null)}>
      <HelpButton {...fieldHelp} />
      {!c.gardenBuilt ? <>
        <p>到前哨基地完成四节点新手踩点并领取结算，第一块菜地自动免费开放，体力上限永久 +4。</p>
        {onAdventure && <button className="primary-button" onClick={onAdventure}>去前哨基地</button>}
      </> : <>
        {selector}
        {crop ? <section className="community-care-section"><h3 className="community-crop-heading"><img src={cropIcon(crop.id)} alt="" /><span>{communityCrops[crop.id].name} · {ready ? '已经成熟' : timeLeft(crop.readyAt, now)}</span></h3><progress aria-label="作物生长进度" max={1} value={growth} /><p>预计收获 {getCommunityCropYield(pet, plotId)} 份 · {getProductionHeartReward(communityCrops[crop.id].hours)} 小心心</p>
          <p>本轮{crop.watered ? '已浇水' : '未浇水'} · {crop.fertilized ? '已施肥，产量 +1' : '未施肥'}；统一使用菜地的「一键照料」。</p>
          <p>细嘴浇水壶：{toolDurabilityLabel(pet, 'field_watering_can')} · 精收镰刀：{toolDurabilityLabel(pet, 'harvest_sickle')} · 堆肥 {pet.inventory.nutrient_compost ?? 0} 份</p><div className="community-actions">
            <button className="primary-button" disabled={!free || !ready} onClick={() => update(p => harvestCommunityCrop(p, plotId, crop.plantedAt, Date.now(), neighbors))}>收获 {getCommunityCropYield(pet, plotId)} 份{getToolUsesLeft(pet, 'harvest_sickle') > 0 ? ' · 镰刀耐久 −1' : ''}</button>
            <button className="secondary-button" onClick={onShop}>补充种植用具</button>
          </div></section>
          : <section className="community-care-section"><h3>今天想种些什么</h3><div className="community-seed-packets">{(Object.keys(communityCrops) as (keyof typeof communityCrops)[]).filter(id => id !== 'berry' || Boolean(pet.inventory.forest_berry_seed || c.expedition.regions.forest.surveyed)).map(id => {
            const d = communityCrops[id];
            return <button type="button" className="community-seed-packet" data-crop={id} key={id} disabled={!free || !(pet.inventory[d.seed] ?? 0) || Boolean(getCropUnlockReason(pet, id))} onClick={() => { update(p => plantCommunityCrop(p, plotId, id, Date.now(), neighbors)); setSeedChoices(previous => ({ ...previous, [plotId]: id })); setPanel(null); }}>
              <img src={cropIcon(id)} alt="" /><strong>{d.name}</strong><small>{d.hours} 小时 · 收获 {d.yield} 份 · {getProductionHeartReward(d.hours)} 心心</small><small>种子库存 {pet.inventory[d.seed] ?? 0}{d.seedPrice ? ` · 原价 ${d.seedPrice}` : ''}</small><b>{getCropUnlockReason(pet, id) || '种下种子 ×1'}</b>
            </button>;
          })}</div></section>}
        <section className="community-care-section"><h3>补充种子</h3><div className="community-actions">
          <button className="secondary-button" disabled={!companionFree || Boolean(pet.adventure.pending)} onClick={() => onExplore('seeds')}>去溪谷补种子</button>
          <button className="secondary-button" onClick={onShop}>购买作物种子</button>
        </div></section>
        <button className="text-button" disabled={!companionFree || !c.herbDiscovered} onClick={() => onKitchen('herb_porridge')}>去厨房做暖粥</button>
        <button className="text-button" onClick={() => onKitchen()}>打开厨房与加工台</button>
      </>}
    </CommunityDetailDialog>}
  </>;
};
