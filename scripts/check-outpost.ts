import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createCommunityTestPet } from './fixtures/community-pet';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { advanceExplorationBudget } from '../src/core/explorationBudget';
import { getExpeditionStartReason, startExpedition, returnExpedition, claimExpedition } from '../src/core/expedition';
import { regionIds } from '../src/core/expeditionData';
import { quoteExpeditionRations } from '../src/core/explorationRations';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { advancePet } from '../src/core/petLifecycle';
import { currentExpeditionRequest, expeditionRegionForMap, initialOutpostRequest, mapRegionForExpedition } from '../src/ui/outpostNavigation';
import type { PetState } from '../src/core/petTypes';
import { getSpecialtyCandidates, acceptSpecialtyOrder } from '../src/core/communitySpecialtyOrders';
import { getAdventureEnergyBonus } from '../src/core/adventureGrowth';
import { createBuiltinItemRegistry, getInventoryItem } from '../src/core/items';

const T = new Date(2026, 8, 21, 10).getTime(), H = 3600000;
const originalNow = Date.now;
Date.now = () => T;
const noop = () => {};
const ready = () => {
  let pet = createCommunityTestPet('projects', T);
  pet.level = 20; pet.coins = 50000;
  pet.hunger = pet.health = pet.cleanliness = pet.mood = getPetStatCap(pet);
  pet.energy = getPetEnergyCap(pet);
  pet = advanceExplorationBudget(pet, T);
  pet.community.expedition.loop!.available = 24;
  return pet;
};
const reload = (pet: PetState, at = T) => parseSaveFileText(createSaveFileText(pet, null, at), at).pet;
for (const region of regionIds) assert.equal(expeditionRegionForMap[mapRegionForExpedition[region]], region);
assert.equal(initialOutpostRequest(ready()), undefined, 'a free companion opens the hall');
assert.deepEqual(initialOutpostRequest(ready(), { view: 'idle', region: 'valley', target: 'lotus_seed' }), { view: 'idle', region: 'valley', target: 'lotus_seed' });
const paused = createCommunityTestPet('long-trip', T);
assert.equal(currentExpeditionRequest(paused)?.view, 'route');
assert.deepEqual(initialOutpostRequest(reload(paused)), { view: 'route', region: 'valley', target: 'valley_mushroom' });
assert.deepEqual(initialOutpostRequest(paused, { view: 'journal' }), { view: 'journal' }, 'reading history does not resume a paused trip');

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
try {
  const [page, panel, journal, rations, map, community, orders, inventory] = await Promise.all([
    server.ssrLoadModule('/src/ui/AdventurePage.tsx'), server.ssrLoadModule('/src/ui/expedition/ExpeditionPanel.tsx'),
    server.ssrLoadModule('/src/ui/TravelJournal.tsx'), server.ssrLoadModule('/src/ui/expedition/ExpeditionRations.tsx'),
    server.ssrLoadModule('/src/ui/AdventureMap.tsx'), server.ssrLoadModule('/src/ui/CommunityPage.tsx'),
    server.ssrLoadModule('/src/ui/community/CommunitySpecialtyOrders.tsx'),
    server.ssrLoadModule('/src/ui/InventoryModal.tsx'),
  ]);
  const render = (component: any, props: any) => {
    const html = renderToStaticMarkup(createElement(component, props));
    assert(!/NaN|\[object Object\]|src="undefined"/.test(html));
    assert(!/社区与远方|走远一点|看看邻居的新计划/.test(html));
    return html;
  };
  const props = { registry: createBuiltinItemRegistry(), icons: {}, onUseHomeItem: noop, pet: ready(), actorId: 'official.furo', actorName: 'Furo', portrait: '', update: noop, onCommunity: noop, onKitchen: noop, onShop: noop, onClose: noop, onNavigate: noop, onMap: noop };
  const pageProps = { ...props, registry: props.registry, icons: {}, onBack: noop, onBuy: noop, onUseHomeItem: noop };
  const initialState = JSON.stringify(props.pet);
  const hall = render(page.AdventurePage, pageProps);
  assert(hall.includes('前哨常用功能') && hall.includes('挂机出发') && hall.includes('旅行日志'));
  assert(!hall.includes('role="dialog"'), 'the empty hall does not open a preparation window');
  const target = render(page.AdventurePage, { ...pageProps, initialOutpost: { view: 'idle', region: 'valley', target: 'lotus_seed' } });
  assert(target.includes('value="lotus_seed" selected=""') && target.includes('莲子 ×2'), 'an order opens the requested target directly');
  assert(target.includes('outpost-action-bar') && target.includes('outpost-duration'));
  assert(!target.includes('exp-hero') && !target.includes('exp-map'));
  assert.equal((target.match(/role="dialog"/g) ?? []).length, 1, 'packing uses one dialog');
  assert(target.includes('preparation-inventory') && target.includes('outpost-scroll--preparation'));
  assert(target.indexOf('adventure-pack-pane--bag') < target.indexOf('adventure-pack-pane--warehouse'));
  assert(!target.includes('独立工具位') && !target.includes('复制到全部时段'));
  const hud = hall.slice(hall.indexOf('<header class="adventure-hud">'), hall.indexOf('</header>'));
  assert(!hud.includes('<img') && !hud.includes('hint='));
  assert.equal((hud.match(/role="meter"/g) ?? []).length, 5);
  assert(!/健康低于 20%|健康需 ≥40%|&lt;20%/.test(target));
  const prospect = render(panel.ExpeditionPanel, { ...props, request: { view: 'route', region: 'valley', target: 'aquamarine' } });
  assert(prospect.includes('value="aquamarine" selected=""') && prospect.includes('定向短途'));
  assert(!prospect.includes('挂机时长'), 'manual scouting and idle planning have separate controls');
  for (const region of regionIds) {
    const camping = render(panel.ExpeditionPanel, { ...props, request: { view: 'camp', region } });
    assert(camping.includes('营地建设') && camping.includes('修通往返步道'));
    const html = render(map.AdventureMap, { adventure: props.pet.adventure, pet: props.pet, selection: { region: mapRegionForExpedition[region], node: 'camp' }, landscape: false,
      onToggleLandscape: noop, onSelect: noop, onPrepare: noop, onResume: noop, onCollect: noop, onClose: noop, onOutpost: noop });
    assert(html.includes('营地建设 · 1/2 级') && html.includes('安排挂机探索'));
    if (region !== 'valley') assert(html.includes('独立地点任务仍在筹备'), 'working region routes do not unlock unfinished node tasks');
    for (const hours of [2, 4, 8]) {
      assert.equal(getExpeditionStartReason(props.pet, [region], 'idle', hours, T), '');
      const html = render(rations.ExpeditionRations, { pet: props.pet, region, hours, setHours: noop, selection: { food: {}, autoFill: true }, onChange: noop });
      assert(html.includes('全程至少') && !html.includes('第 1 段'));
      assert(html.includes(`共 ${quoteExpeditionRations(props.pet, region, hours).coins} 金币`));
      assert(!html.includes('<details class="exp-bag" open'), 'meal details start folded');
      const shortBudget = structuredClone(props.pet); shortBudget.community.expedition.loop!.available = hours - 1;
      assert(getExpeditionStartReason(shortBudget, [region], 'idle', hours, T).includes(`需要采集机会 ${hours} 次`));
      const shortCoins = structuredClone(props.pet); shortCoins.coins = quoteExpeditionRations(props.pet, region, hours).coins - 1;
      assert(getExpeditionStartReason(shortCoins, [region], 'idle', hours, T).includes('金币不足'));
      assert(getExpeditionStartReason(props.pet, [region], 'idle', hours, T, 'patrol', { food: {}, autoFill: false }).includes('全程需要'));
    }
  }
  assert.equal(JSON.stringify(props.pet), initialState, 'previews and journals never spend resources');
  const locked = createCommunityTestPet('community', T);
  const lockedIdle = render(panel.ExpeditionPanel, { ...props, pet: locked, request: { view: 'idle', region: 'valley' } });
  assert(lockedIdle.includes('去地图查看') && /<button[^>]*disabled=""[^>]*>[\s\S]*?挂机出发<\/button>/.test(lockedIdle));
  locked.community.expedition.regions.valley.surveyed = true;
  const unbuilt = render(panel.ExpeditionPanel, { ...props, pet: locked, request: { view: 'idle', region: 'valley' } });
  assert(unbuilt.includes('去建设营地'));
  const depleted = ready(); depleted.community.expedition.loop!.available = 1;
  assert(render(panel.ExpeditionPanel, { ...props, pet: depleted, request: { view: 'idle', region: 'valley' } }).includes('需要采集机会 2 次'));

  let trip = startExpedition(ready(), ['valley'], {}, false, 'official.furo', 'Furo', 'idle', 4, T);
  assert(trip.community.expedition.active);
  const inFlight = render(page.AdventurePage, { ...pageProps, pet: reload(trip) });
  assert(inFlight.includes('挂机行程') && inFlight.includes('提前召回伙伴'));
  assert(!inFlight.includes('outpost-duration'), 'reopening an active trip never offers another departure');
  assert(render(page.AdventurePage, { ...pageProps, pet: reload(paused) }).includes('行程已存下'));
  trip = advancePet(trip, T + H);
  const receipt = returnExpedition(trip, trip.community.expedition.active!.id, T + H);
  const receiptPage = render(page.AdventurePage, { ...pageProps, pet: reload(receipt, T + H) });
  assert(receiptPage.includes('收好旅途物资') && receiptPage.includes('收好这一趟的物资'));
  assert(!receiptPage.includes('outpost-duration'));
  const receiptBefore = JSON.stringify(receipt.community.expedition.pending);
  const pendingLog = render(journal.TravelJournal, { pet: receipt, onClose: noop, onMap: noop, onReceipt: noop });
  assert(pendingLog.includes('物资待领取') && pendingLog.includes('处理回程物资'));
  assert.equal(JSON.stringify(receipt.community.expedition.pending), receiptBefore, 'opening a journal cannot claim or rewrite a receipt');
  const full = structuredClone(receipt); full.inventory.valley_mushroom = 9999;
  const partiallyClaimed = claimExpedition(full, full.community.expedition.pending!.id, T + H);
  assert(partiallyClaimed.community.expedition.pending, 'full warehouse retains remaining idle cargo');
  assert(render(page.AdventurePage, { ...pageProps, pet: partiallyClaimed }).includes('收好旅途物资'));
  const claimed = claimExpedition(receipt, receipt.community.expedition.pending!.id, T + H);
  const saved = reload(claimed, T + H);
  assert(!saved.community.expedition.pending);
  const records = journal.getTravelRecords(saved);
  assert.equal(records.length, 1);
  assert.equal(records[0].at, saved.community.expedition.lastReceipt!.at);
  assert.equal(records[0].coins, undefined, 'the compact latest receipt does not invent historical rewards');
  assert(records[0].lines.some((line: string) => line.includes('分给了路过的邻居 mint')), 'structured food settlement remains visible after compact save reload');
  const overlap = structuredClone(receipt); overlap.community.expedition.lastReceipt = saved.community.expedition.lastReceipt;
  assert.equal(journal.getTravelRecords(overlap).length, 1, 'overlapping pending and latest receipts appear once');
  assert(render(journal.TravelJournal, { pet: createCommunityTestPet('community', T), onClose: noop, onMap: noop, onReceipt: noop }).includes('第一段旅途'));
  const memories = ready(); memories.community.expedition.projects.riverside.completed = 1;
  const discoveryLog = render(journal.TravelJournal, { pet: memories, onClose: noop, onMap: noop, onReceipt: noop, initialTab: 'discoveries' });
  assert(discoveryLog.includes('过去的社区回忆') && !discoveryLog.includes('选择这个主题'));

  const farm = render(community.CommunityPage, { ...props, onBack: noop, onExplore: noop, onAdventure: noop, onOpenOutpost: noop, initialPlace: 'journey', orchard: null });
  assert(farm.includes('珍宝展台') && farm.includes('制作溪光水景'));
  assert(farm.includes('旅途与日常'));
  assert(!farm.includes('办一次河岸聚餐') && !farm.includes('查看社区项目'));
  const farmProps = { ...props, onBack: noop, onExplore: noop, onAdventure: noop, onOpenOutpost: noop, initialPlace: 'growth', orchard: null };
  const newGrowth = render(community.CommunityPage, farmProps);
  assert(!newGrowth.includes('河岸长桌聚餐') && !newGrowth.includes('星空之夜准备'), 'retired projects are not unfinished growth tasks');
  const savedGrowth = render(community.CommunityPage, { ...farmProps, pet: reload(memories) });
  assert(savedGrowth.includes('河岸长桌聚餐'), 'completed community growth is retained');
  assert.equal(getAdventureEnergyBonus(memories), getAdventureEnergyBonus(props.pet) + 3);
  for (const id of ['valley_amber', 'creek_aquamarine']) {
    const pet = ready(); pet.inventory[id] = 1;
    const element = inventory.InventoryModal({ pet, items: [getInventoryItem(id)!], itemIconMap: {}, browse: { category: 'all', query: '', selectedId: id, quantity: 1 }, onBrowseChange: noop, isPetBusy: false,
      onClose: noop, onOpenShop: noop, onOpenGarden: noop, onOpenCommunity: noop, onOpenTravelCrafts: noop, onOpenKitchen: noop, onUseItem: noop });
    const html = renderToStaticMarkup(element.props.renderActions(getInventoryItem(id)!, 1));
    assert(html.includes('去农场制作') && !html.includes('社区项目'), 'treasures point to the farm crafting window');
  }
  const candidate = getSpecialtyCandidates(props.pet)[0]; assert(candidate);
  const withOrder = acceptSpecialtyOrder(props.pet, candidate.id);
  assert(render(orders.CommunitySpecialtyOrders, { pet: withOrder, update: noop, onOpenOutpost: noop }).includes('安排采集'));
  console.log('Outpost passed: explicit destinations, five-region mapping, folded 2/4/8h rations, camp gates, saved trips, paused routes, partial claims, persistent and empty journals, farm collections and order entries. Visual/touch acceptance is manual.');
} finally {
  Date.now = originalNow;
  await server.close();
}
