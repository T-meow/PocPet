import { buildCommunityGarden, communityConfig as C, communityCrops, deliverCommunityOrder, harvestCommunityCrop, plantCommunityCrop, repairCommunityGarden, saveCommunitySeed, saveForestBerrySeed } from '../../core/community';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { CommunityPanelProps } from './types';
import { timeLeft } from './types';

export const CommunityWarmOrder = ({ pet, update, onKitchen }: CommunityPanelProps) => {
  const done = pet.community.firstOrderDelivered;
  return <section className="community-card"><div className="community-section-heading"><h3>给修渠邻居的一碗暖粥</h3><span className="community-tag">{done ? '已完成' : '常驻故事'}</span></div>
    <p>{done ? '邻居把空碗洗得干干净净。溪谷带回的种子，已经成了大家日常的一部分。' : '修好菜地，把第一份香草做成暖粥，感谢一起修渠的邻居。'}</p>
    <p className="community-muted">菜地开放后交付暖粥 ×1，可用已有料理。首次：80 金币、5 小心心、体力上限 +3。</p>
    {!done && <div className="community-actions"><button className="primary-button" disabled={!canSpendCompanionTime(pet) || !pet.community.gardenBuilt || !(pet.inventory.dish_herb_porridge ?? 0)} onClick={() => update(deliverCommunityOrder)}>交付暖粥（持有 {pet.inventory.dish_herb_porridge ?? 0}）</button><button className="secondary-button" disabled={!canSpendCompanionTime(pet) || !pet.community.herbDiscovered} onClick={() => onKitchen('herb_porridge')}>去厨房做暖粥</button></div>}
  </section>;
};

export const CommunityField = ({ pet, update, onExplore, onKitchen, onShop, registry }: CommunityPanelProps) => {
  const c = pet.community, crop = c.crop, free = canSpendCompanionTime(pet), now = Date.now();
  if (!c.gardenBuilt) return <section className="community-card"><h3>让水重新流过菜地</h3><p>溪谷的水渠通向这里。找到阀芯，和伙伴一起清理，再投入建材开放菜地。</p>
    <ol className="community-steps">{[[c.irrigationFound, '溪谷发现灌溉阀芯'], [c.repairStep >= 1, '清理菜地杂草'], [c.repairStep >= 2, '疏通旧水渠'], [false, `160 金币 · 木料 3 · 石料 2`]].map(([done, label]) => <li key={String(label)} data-done={Boolean(done)}><span>{done ? '✓' : '○'}</span>{label}</li>)}</ol>
    {!c.irrigationFound ? <button className="primary-button" disabled={!free || Boolean(pet.adventure.pending) || !(pet.adventure.completed.tutorial ?? 0)} onClick={() => onExplore('irrigation')}>去溪谷寻找灌溉零件</button>
      : c.repairStep < 2 ? <><p>本次饱食 −4、体力 −4，增加园艺练习。</p><button className="primary-button" disabled={!free || pet.hunger < C.repairHunger || pet.energy < C.repairEnergy} onClick={() => update(p => repairCommunityGarden(p, c.repairStep))}>{c.repairStep === 0 ? '清理杂草' : '疏通水渠'}</button></>
        : <><p>已有：金币 {pet.coins} · 木料 {pet.inventory.community_wood ?? 0} · 石料 {pet.inventory.community_stone ?? 0}</p><div className="community-actions"><button className="primary-button" disabled={!free || pet.coins < C.buildCoins || (pet.inventory.community_wood ?? 0) < C.wood || (pet.inventory.community_stone ?? 0) < C.stone} onClick={() => update(buildCommunityGarden)}>投入材料，开放菜地</button><button className="secondary-button" onClick={onShop}>补充建材</button></div></>}
  </section>;
  return <>
    <section className="community-card"><div className="community-section-heading"><h3>水渠旁的小菜地</h3><span className="community-tag">{crop ? now >= crop.readyAt ? '可以收获' : '正在生长' : '等待播种'}</span></div>
      {crop ? <><h4>{communityCrops[crop.id].name} · {timeLeft(crop.readyAt, now)}</h4><progress aria-label="作物生长进度" max={Math.max(1, crop.readyAt - crop.plantedAt)} value={Math.min(crop.readyAt - crop.plantedAt, Math.max(0, now - crop.plantedAt))} /><p>本轮收获 {communityCrops[crop.id].yield} 份。成熟后会一直等你，仓库满时也不会丢失。</p><button className="primary-button" disabled={!free || now < crop.readyAt} onClick={() => update(p => harvestCommunityCrop(p, crop.plantedAt))}>收获{communityCrops[crop.id].name}</button></>
        : <div className="community-seeds">{(Object.keys(communityCrops) as (keyof typeof communityCrops)[]).filter(id => id !== 'berry' || Boolean(pet.inventory.forest_berry_seed || pet.community.expedition.regions.forest.surveyed)).map(id => { const d = communityCrops[id]; return <article key={id}><span className="community-crop-glyph" aria-hidden="true">{d.glyph}</span><h4>{d.name}</h4><p>{d.hours} 小时 · 收获 {d.yield} 份<br />种子库存 {pet.inventory[d.seed] ?? 0}</p><button className="primary-button" disabled={!free || !(pet.inventory[d.seed] ?? 0)} onClick={() => update(p => plantCommunityCrop(p, id))}>种植 · 种子 ×1</button></article>; })}</div>}
    </section>
    <section className="community-card"><h3>给下一轮留一点种子</h3><p>香草收获 4 份，留出 2 份可换种子 ×1，另 2 份用于料理或委托。</p><div className="community-note">香草 {pet.inventory.creek_herb ?? 0} · 种子 {pet.inventory.creek_herb_seed ?? 0}</div><div className="community-actions"><button className="secondary-button" disabled={!free || !c.herbDiscovered || (pet.inventory.creek_herb ?? 0) < 2} onClick={() => update(saveCommunitySeed)}>香草 ×2 → 种子 ×1</button><button className="secondary-button" disabled={!free || Boolean(pet.adventure.pending)} onClick={() => onExplore('seeds')}>去溪谷补种子</button><button className="secondary-button" onClick={onShop}>购买胡萝卜种子</button>{Boolean(pet.inventory.forest_berry) && <button className="secondary-button" disabled={!free || (pet.inventory.forest_berry ?? 0) < 2} onClick={() => update(saveForestBerrySeed)}>林莓 ×2 → 种子 ×1</button>}</div></section>
    <section className="community-card"><h3>从菜地到餐桌</h3><p>香草 ×1 ＋ 大米 ×1 → 香草暖粥。先留种，再把余量做成旅途补给或交给邻居。</p><button className="primary-button" disabled={!free || !c.herbDiscovered} onClick={() => onKitchen('herb_porridge')}>去厨房</button></section>
    <CommunityWarmOrder {...{ pet, update, onExplore, onKitchen, onShop, registry }} />
  </>;
};
