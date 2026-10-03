import { useState } from 'react';
import { getProductionHeartReward } from '../../core/activityHearts';
import { careCommunityCrop, getCommunityCropYield, communityCrops, harvestCommunityCrop, harvestCommunityCrops, plantCommunityCrop, plantCommunityCrops } from '../../core/community';
import { CommunityUpgradeDialog } from './CommunityUpgradeTask';
import { toolDurabilityLabel } from '../../core/toolDurability';
import { canSpendCompanionTime } from '../../core/kitchen';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import { CommunityProductionScene } from './CommunityProductionScene';
import type { CommunityPanelProps } from './types';
import { timeLeft } from './types';
import { cropIds, getCropUnlockReason, type CropId } from '../../core/foodCatalog';
import { HelpButton } from '../help/HelpButton';
import { fieldHelp } from '../help/productionHelp';
import { itemIcons } from '../../assets';

export const CommunityField = (props: CommunityPanelProps) => {
  const { pet, update, onExplore, onKitchen, onShop, onAdventure, itemIconMap } = props;
  const [panel, setPanel] = useState<'care' | 'construction' | null>(null);
  const [selectedId, setSelectedId] = useState(1);
  const [seedChoices, setSeedChoices] = useState<Partial<Record<number, CropId>>>({});
  const c = pet.community, plot = c.plots.find(p => p.id === selectedId) ?? c.plots[0], crop = plot.crop, plotId = plot.id;
  const free = !pet.timePause && canSpendCompanionTime(pet), now = Date.now();
  const ready = Boolean(crop && now >= crop.readyAt);
  const growth = crop ? Math.min(1, Math.max(0, (now - crop.plantedAt) / Math.max(1, crop.readyAt - crop.plantedAt))) : 0;
  const status = !c.gardenBuilt ? '踩点结算后免费开放' : ready ? '可以收获了' : crop ? '正在慢慢生长' : '等待播种';
  const maturePlots = c.plots.filter(p => p.crop && now >= p.crop.readyAt).map(p => ({ id: p.id, plantedAt: p.crop!.plantedAt }));
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
  const selector = <div className="community-plot-selector" role="group" aria-label="选择菜地">
    {c.plots.map(p => <button type="button" key={p.id} aria-pressed={p.id === plotId} className="community-plot-card" onClick={() => setSelectedId(p.id)}>
      <strong>第 {p.id} 块菜地</strong><span className="community-plot-crop">{p.crop ? <><img src={cropIcon(p.crop.id)} alt="" />{communityCrops[p.crop.id].name}</> : '待播种'}</span><small>{p.crop ? now >= p.crop.readyAt ? '已成熟 · 可收获' : timeLeft(p.crop.readyAt, now) : p.lastCrop ? `上次：${communityCrops[p.lastCrop].name}` : '选好种子，直接播种'}</small>
    </button>)}
    {c.plots.length < 3 && <button type="button" className="community-plot-card community-plot-expand" aria-haspopup="dialog" onClick={() => setPanel('construction')}><strong>＋ 第 {c.plots.length + 1} 块</strong><span>查看扩建任务</span></button>}
  </div>;
  return <>
    {c.gardenBuilt && selector}
    {c.gardenBuilt && <section className="community-field-quick" aria-label="菜地快捷操作">
      <div className="community-field-quick-heading"><strong>菜地快捷操作</strong><span>成熟 {maturePlots.length} 块 · 空地 {emptyPlots.length} 块</span></div>
      <div className="community-field-quick-actions">
        <button type="button" className="primary-button" disabled={!free || !maturePlots.length} onClick={() => update(p => harvestCommunityCrops(p, maturePlots))}>一键收获 · {maturePlots.length} 块</button>
        <button type="button" className="secondary-button" disabled={!free || !repeatSeeds.length} onClick={() => update(p => plantCommunityCrops(p, repeatSeeds))}>按上次补种 · {repeatSeeds.length} 块</button>
      </div>
      {emptyPlots.length > 0 && <>
        <p className="community-field-quick-note">{repeatSeeds.length ? `本次补种：${repeatSeeds.map(p => `第 ${p.plotId} 块${communityCrops[p.cropId].name}`).join('、')}。` : '按上次补种会沿用各块地的作物，种子不足的地块保留为空地。'}</p>
        <div className="community-field-sowing">
          <label className="community-field-seed-choice"><span>选择种子</span><select value={selectedSeed} disabled={!free} onChange={event => { const id = event.target.value as CropId; setSeedChoices(previous => ({ ...previous, [plotId]: id })); }}>
            {cropIds.map(id => { const d = communityCrops[id], lock = getCropUnlockReason(pet, id); return <option key={id} value={id} disabled={Boolean(lock)}>{d.name} · 种子 {pet.inventory[d.seed] ?? 0}{lock ? ' · 未解锁' : ''}</option>; })}
          </select></label>
          <div className="community-field-seed-detail"><img src={cropIcon(selectedSeed)} alt="" /><span>{seed.hours} 小时 · 收获 {seed.yield} 份 · {getProductionHeartReward(seed.hours)} 心心</span></div>
        </div>
        <div className="community-field-quick-actions">
          <button type="button" className="primary-button" disabled={!free || Boolean(crop) || seedCount < 1 || Boolean(seedLock)} onClick={() => update(p => plantCommunityCrop(p, plotId, selectedSeed))}>播种第 {plotId} 块 · 种子 ×1</button>
          {emptyPlots.length > 1 && <button type="button" className="secondary-button" disabled={!free || !selectedSeeds.length} onClick={() => update(p => plantCommunityCrops(p, selectedSeeds))}>播种空地 · {selectedSeeds.length} 块</button>}
          <button type="button" className="text-button" onClick={onShop}>补充种子</button>
        </div>
        <p className="community-field-quick-note">{seedLock || (seedCount < 1 ? `${seed.name}种子不足，可更换种子或补充库存。` : crop ? `第 ${plotId} 块已有作物，可切换空地${emptyPlots.length > 1 ? '或批量播种' : ''}。` : `每块地消耗 1 份种子${emptyPlots.length > 1 ? `，本次最多播种 ${selectedSeeds.length} 块，优先第 ${plotId} 块` : ''}。`)}</p>
      </>}
      {pet.recentEvent && <p className="community-field-quick-event" role="status">{pet.recentEvent}</p>}
    </section>}
    <CommunityProductionScene kind="field" title={crop ? `${communityCrops[crop.id].name}在水渠边生长` : '留一块地，种下今天'} subtitle={`第 ${plotId} 块菜地 · 共 ${c.plots.length} 块`}
      status={status} crop={crop?.id} growth={growth} ready={ready}
      supplies={crop ? `长势 ${Math.floor(growth * 100)}% · 这轮收获 ${getCommunityCropYield(pet, plotId)} 份 · ${getProductionHeartReward(communityCrops[crop.id].hours)} 心心` : c.gardenBuilt ? '16 种作物 · 从一颗种子开始' : '完成并结算新手踩点，菜地自动开放'}
      detail={crop ? ready ? '成熟的作物会一直等你' : `距离成熟 · ${timeLeft(crop.readyAt, now)}` : c.gardenBuilt ? '在上方选种播种，或一键补种上次作物' : '免费开放第 1 块菜地，体力上限永久 +4'}
      harvest={crop ? `${communityCrops[crop.id].name} · ${ready ? '已经成熟' : '正在生长'}` : '这片土地还空着'} harvestDisabled={!free || !c.gardenBuilt || !ready}
      onHarvest={() => { if (crop) update(p => harvestCommunityCrop(p, plotId, crop.plantedAt)); }} onCare={() => setPanel('care')}
      onConstruction={c.gardenBuilt ? () => setPanel('construction') : undefined} />
    {panel === 'construction' && <CommunityUpgradeDialog {...props} id="garden" onClose={() => setPanel(null)} />}
    {panel === 'care' && <CommunityDetailDialog title={c.gardenBuilt ? `照料第 ${plotId} 块菜地` : '开放第一块菜地'} eyebrow="顺着季节，照顾每一颗种子" onClose={() => setPanel(null)}>
      <HelpButton {...fieldHelp} />
      {!c.gardenBuilt ? <>
        <p>到前哨基地完成四节点新手踩点并领取结算，第一块菜地自动免费开放，体力上限永久 +4。</p>
        {onAdventure && <button className="primary-button" onClick={onAdventure}>去前哨基地</button>}
      </> : <>
        {selector}
        {crop ? <section className="community-care-section"><h3 className="community-crop-heading"><img src={cropIcon(crop.id)} alt="" /><span>{communityCrops[crop.id].name} · {ready ? '已经成熟' : timeLeft(crop.readyAt, now)}</span></h3><progress aria-label="作物生长进度" max={1} value={growth} /><p>预计收获 {getCommunityCropYield(pet, plotId)} 份 · {getProductionHeartReward(communityCrops[crop.id].hours)} 小心心</p>
          <p>细嘴浇水壶：{toolDurabilityLabel(pet, 'field_watering_can')} · 精收镰刀：{toolDurabilityLabel(pet, 'harvest_sickle')} · 堆肥 {pet.inventory.nutrient_compost ?? 0} 份</p><div className="community-actions">
            <button className="secondary-button" disabled={!free || ready || crop.watered || !(pet.inventory.field_watering_can ?? 0)} onClick={() => update(p => careCommunityCrop(p, plotId, crop.plantedAt, 'water'))}>{crop.watered ? '本轮已浇水' : '浇水 · 生长时间 −20% · 耐久 −1'}</button>
            <button className="secondary-button" disabled={!free || ready || crop.fertilized || !(pet.inventory.nutrient_compost ?? 0)} onClick={() => update(p => careCommunityCrop(p, plotId, crop.plantedAt, 'fertilize'))}>{crop.fertilized ? '本轮已施肥 · 产量 +1' : '堆肥 ×1 · 本轮产量 +1'}</button>
            <button className="primary-button" disabled={!free || !ready || !(pet.inventory.harvest_sickle ?? 0)} onClick={() => update(p => harvestCommunityCrop(p, plotId, crop.plantedAt, Date.now(), true))}>精细收割 {getCommunityCropYield(pet, plotId, true)} 份 · 镰刀耐久 −1</button>
            <button className="secondary-button" onClick={onShop}>补充种植用具</button>
          </div></section>
          : <section className="community-care-section"><h3>今天想种些什么</h3><div className="community-seed-packets">{(Object.keys(communityCrops) as (keyof typeof communityCrops)[]).filter(id => id !== 'berry' || Boolean(pet.inventory.forest_berry_seed || c.expedition.regions.forest.surveyed)).map(id => {
            const d = communityCrops[id];
            return <button type="button" className="community-seed-packet" data-crop={id} key={id} disabled={!free || !(pet.inventory[d.seed] ?? 0) || Boolean(getCropUnlockReason(pet, id))} onClick={() => { update(p => plantCommunityCrop(p, plotId, id)); setSeedChoices(previous => ({ ...previous, [plotId]: id })); setPanel(null); }}>
              <img src={cropIcon(id)} alt="" /><strong>{d.name}</strong><small>{d.hours} 小时 · 收获 {d.yield} 份 · {getProductionHeartReward(d.hours)} 心心</small><small>种子库存 {pet.inventory[d.seed] ?? 0}{d.seedPrice ? ` · 原价 ${d.seedPrice}` : ''}</small><b>{getCropUnlockReason(pet, id) || '种下种子 ×1'}</b>
            </button>;
          })}</div></section>}
        <section className="community-care-section"><h3>补充种子</h3><div className="community-actions">
          <button className="secondary-button" disabled={!free || Boolean(pet.adventure.pending)} onClick={() => onExplore('seeds')}>去溪谷补种子</button>
          <button className="secondary-button" onClick={onShop}>购买作物种子</button>
        </div></section>
        <button className="text-button" disabled={!free || !c.herbDiscovered} onClick={() => onKitchen('herb_porridge')}>去厨房做暖粥</button>
        <button className="text-button" onClick={() => onKitchen()}>打开厨房与加工台</button>
      </>}
    </CommunityDetailDialog>}
  </>;
};
