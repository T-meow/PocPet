import { useState } from 'react';
import { careCommunityCrop, getCommunityCropYield, communityCrops, harvestCommunityCrop, plantCommunityCrop } from '../../core/community';
import { CommunityUpgradeDialog } from './CommunityUpgradeTask';
import { toolDurabilityLabel } from '../../core/toolDurability';
import { canSpendCompanionTime } from '../../core/kitchen';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import { CommunityProductionScene } from './CommunityProductionScene';
import type { CommunityPanelProps } from './types';
import { timeLeft } from './types';
import { getCropUnlockReason } from '../../core/foodCatalog';

export const CommunityField = (props: CommunityPanelProps) => {
  const { pet, update, onExplore, onKitchen, onShop, onAdventure } = props;
  const [panel, setPanel] = useState<'care' | 'construction' | null>(null);
  const [selectedId, setSelectedId] = useState(1);
  const c = pet.community, plot = c.plots.find(p => p.id === selectedId) ?? c.plots[0], crop = plot.crop, plotId = plot.id;
  const free = !pet.timePause && canSpendCompanionTime(pet), now = Date.now();
  const ready = Boolean(crop && now >= crop.readyAt);
  const growth = crop ? Math.min(1, Math.max(0, (now - crop.plantedAt) / Math.max(1, crop.readyAt - crop.plantedAt))) : 0;
  const status = !c.gardenBuilt ? '踩点结算后免费开放' : ready ? '可以收获了' : crop ? '正在慢慢生长' : '等待播种';
  const selector = <div className="community-plot-selector" role="group" aria-label="选择菜地">
    {c.plots.map(p => <button type="button" key={p.id} aria-pressed={p.id === plotId} className="community-plot-card" onClick={() => setSelectedId(p.id)}>
      <strong>第 {p.id} 块菜地</strong><span>{p.crop ? `${communityCrops[p.crop.id].glyph} ${communityCrops[p.crop.id].name}` : '待播种'}</span><small>{p.crop ? now >= p.crop.readyAt ? '已成熟 · 可收获' : timeLeft(p.crop.readyAt, now) : '独立播种与照料'}</small>
    </button>)}
    {c.plots.length < 3 && <button type="button" className="community-plot-card community-plot-expand" aria-haspopup="dialog" onClick={() => setPanel('construction')}><strong>＋ 第 {c.plots.length + 1} 块</strong><span>查看扩建任务</span></button>}
  </div>;
  return <>
    {c.gardenBuilt && selector}
    <CommunityProductionScene kind="field" title={crop ? `${communityCrops[crop.id].name}在水渠边生长` : '留一块地，种下今天'} subtitle={`第 ${plotId} 块菜地 · 共 ${c.plots.length} 块`}
      status={status} crop={crop?.id} growth={growth} ready={ready}
      supplies={crop ? `长势 ${Math.floor(growth * 100)}% · 这轮收获 ${getCommunityCropYield(pet, plotId)} 份` : c.gardenBuilt ? '16 种作物 · 从一颗种子开始' : '完成并结算新手踩点，菜地自动开放'}
      detail={crop ? ready ? '成熟的作物会一直等你' : `距离成熟 · ${timeLeft(crop.readyAt, now)}` : c.gardenBuilt ? '打开照料，挑选要种下的种子' : '免费开放第 1 块菜地，体力上限永久 +4'}
      harvest={crop ? `${communityCrops[crop.id].name} · ${ready ? '已经成熟' : '正在生长'}` : '这片土地还空着'} harvestDisabled={!free || !c.gardenBuilt || !ready}
      onHarvest={() => { if (crop) update(p => harvestCommunityCrop(p, plotId, crop.plantedAt)); }} onCare={() => setPanel('care')}
      onConstruction={c.gardenBuilt ? () => setPanel('construction') : undefined} />
    {panel === 'construction' && <CommunityUpgradeDialog {...props} id="garden" onClose={() => setPanel(null)} />}
    {panel === 'care' && <CommunityDetailDialog title={c.gardenBuilt ? `照料第 ${plotId} 块菜地` : '开放第一块菜地'} eyebrow="顺着季节，照顾每一颗种子" onClose={() => setPanel(null)}>
      {!c.gardenBuilt ? <>
        <p>到前哨基地完成四节点新手踩点并领取结算，第一块菜地自动免费开放，体力上限永久 +4。</p>
        {onAdventure && <button className="primary-button" onClick={onAdventure}>去前哨基地</button>}
      </> : <>
        {selector}
        {crop ? <section className="community-care-section"><h3>{communityCrops[crop.id].glyph} {communityCrops[crop.id].name} · {ready ? '已经成熟' : timeLeft(crop.readyAt, now)}</h3><progress aria-label="作物生长进度" max={1} value={growth} /><p>普通收获 {getCommunityCropYield(pet, plotId)} 份。可以额外照料，每轮浇水、施肥各一次；成熟后会一直等你。</p>
          <p>细嘴浇水壶：{toolDurabilityLabel(pet, 'field_watering_can')} · 精收镰刀：{toolDurabilityLabel(pet, 'harvest_sickle')} · 堆肥 {pet.inventory.nutrient_compost ?? 0} 份</p><div className="community-actions">
            <button className="secondary-button" disabled={!free || ready || crop.watered || !(pet.inventory.field_watering_can ?? 0)} onClick={() => update(p => careCommunityCrop(p, plotId, crop.plantedAt, 'water'))}>{crop.watered ? '本轮已浇水' : '浇水 · 生长时间 −20% · 耐久 −1'}</button>
            <button className="secondary-button" disabled={!free || ready || crop.fertilized || !(pet.inventory.nutrient_compost ?? 0)} onClick={() => update(p => careCommunityCrop(p, plotId, crop.plantedAt, 'fertilize'))}>{crop.fertilized ? '本轮已施肥 · 产量 +1' : '堆肥 ×1 · 本轮产量 +1'}</button>
            <button className="primary-button" disabled={!free || !ready || !(pet.inventory.harvest_sickle ?? 0)} onClick={() => update(p => harvestCommunityCrop(p, plotId, crop.plantedAt, Date.now(), true))}>精细收割 {getCommunityCropYield(pet, plotId, true)} 份 · 镰刀耐久 −1</button>
            <button className="secondary-button" onClick={onShop}>补充种植用具</button>
          </div><small>精细收割可与堆肥叠加；仓库放不下时不扣镰刀耐久。</small></section>
          : <section className="community-care-section"><h3>今天想种些什么</h3><div className="community-seed-packets">{(Object.keys(communityCrops) as (keyof typeof communityCrops)[]).filter(id => id !== 'berry' || Boolean(pet.inventory.forest_berry_seed || c.expedition.regions.forest.surveyed)).map(id => {
            const d = communityCrops[id];
            return <button type="button" className="community-seed-packet" data-crop={id} key={id} disabled={!free || !(pet.inventory[d.seed] ?? 0) || Boolean(getCropUnlockReason(pet, id))} onClick={() => { update(p => plantCommunityCrop(p, plotId, id)); setPanel(null); }}>
              <span aria-hidden="true">{d.glyph}</span><strong>{d.name}</strong><small>{d.hours} 小时 · 收获 {d.yield} 份</small><small>种子库存 {pet.inventory[d.seed] ?? 0}{d.seedPrice ? ` · 原价 ${d.seedPrice}` : ''}</small><b>{getCropUnlockReason(pet, id) || '种下种子 ×1'}</b>
            </button>;
          })}</div></section>}
        <section className="community-care-section"><h3>补充种子</h3><p>香草种子来自溪谷每日首次搜寻 ×2、水渠故事首次奖励 ×2；林莓种子在林地定向寻找，每次 ×2，消耗探索机会。这两种种子商店不出售。</p><div className="community-actions">
          <button className="secondary-button" disabled={!free || Boolean(pet.adventure.pending)} onClick={() => onExplore('seeds')}>去溪谷补种子</button>
          <button className="secondary-button" onClick={onShop}>购买作物种子</button>
        </div></section>
        <p className="community-care-footnote">香草 ×1 ＋ 大米 ×1，可以煮一碗暖粥。邻居的暖粥委托贴在公告板上。</p>
        <button className="text-button" disabled={!free || !c.herbDiscovered} onClick={() => onKitchen('herb_porridge')}>去厨房做暖粥</button>
        <p>小麦种子 24 金币，8 小时收获 4 份，可在厨房加工台免费磨出面粉 8 份。种子成本每份面粉 3 金币。</p><button className="text-button" onClick={() => onKitchen()}>打开厨房与加工台</button>
      </>}
    </CommunityDetailDialog>}
  </>;
};
