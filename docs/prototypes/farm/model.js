var FarmModel = (() => {
  const HOUR = 3600000;
  const items = {
    apple: { name: '苹果', glyph: '🍎', group: 'produce', base: 9, note: '果园收获，也可以做成布丁。' },
    carrot: { name: '胡萝卜', glyph: '🥕', group: 'produce', base: 6, note: '菜地作物，蛋饼的好搭档。' },
    tomato: { name: '番茄', glyph: '🍅', group: 'produce', base: 6, note: '清爽多汁的日常蔬菜。' },
    egg: { name: '鸡蛋', glyph: '🥚', group: 'produce', base: 7, note: '鸡舍出产，留下几颗做早餐。' },
    milk: { name: '鲜奶', glyph: '🥛', group: 'produce', base: 10, note: '牛棚出产，可加工为蛋奶布丁。' },
    rice: { name: '大米', glyph: '🍚', group: 'produce', base: 6, note: '厨房常用原料。' },
    flour: { name: '面粉', glyph: '🌾', group: 'produce', base: 5, note: '厨房常用原料。' },
    omelet: { name: '胡萝卜蛋饼', glyph: '🍳', group: 'dish', base: 14, note: '消耗鸡蛋和胡萝卜制作，基础制作心心 +1。' },
    pudding: { name: '鲜奶水果布丁', glyph: '🍮', group: 'dish', base: 24, note: '消耗鲜奶、鸡蛋和苹果制作，基础制作心心 +3。' },
    wet_wipes: { name: '湿巾', glyph: '🧻', group: 'goods', base: 4, note: '护理树的日常产物。' },
    flowers: { name: '小花束', glyph: '💐', group: 'goods', base: 10, note: '礼物树的日常产物。' },
    golden_apple: { name: '金苹果', glyph: '🍏', group: 'special', base: 0, note: '留作特殊探索和建设，本次不参与交易。' },
    amber: { name: '溪谷琥珀', glyph: '🔶', group: 'treasure', base: 480, note: '冒险珍品，收藏家感兴趣。', source: '溪谷 · 河床深处' },
    mechanism: { name: '古旧机芯', glyph: '⚙️', group: 'treasure', base: 1000, note: '前哨观测台建设需要 1 个，建议保留。', source: '旧观测站 · 遗迹搜寻' },
    pearl: { name: '月光珍珠', glyph: '🦪', group: 'treasure', base: 720, note: '海岸发现的珍品，可以回收或摆摊。', source: '潮汐海岸 · 退潮采集' },
    coin_hoard: { name: '一堆金币', glyph: '💰', group: 'cash', base: 360, note: '固定兑换 360 金币。' },
  };
  const trees = {
    fruit: { name: '食材树', item: 'apple', amount: 4, hours: 12, rounds: 10, price: 120, glyph: '🌳' },
    care: { name: '护理树', item: 'wet_wipes', amount: 3, hours: 12, rounds: 10, price: 180, glyph: '🌿' },
    gift: { name: '礼物树', item: 'flowers', amount: 3, hours: 12, rounds: 10, price: 240, glyph: '🌸' },
    money: { name: '摇钱树', item: 'coins', amount: 300, hours: 36, rounds: 8, price: 3000, glyph: '🌳' },
    golden: { name: '金苹果树', item: 'golden_apple', amount: 2, hours: 48, rounds: 10, price: 8888, glyph: '🌳' },
  };
  const recipes = {
    omelet: { name: '胡萝卜蛋饼', materials: { egg: 1, carrot: 1 }, hearts: 1 },
    pudding: { name: '鲜奶水果布丁', materials: { milk: 1, egg: 1, apple: 1 }, hearts: 3 },
  };
  const visitorTypes = [
    { name: 'Doro', avatar: 'doro', likes: 'produce', text: '这些刚收的水果，看起来真不错。' },
    { name: '散步的邻居', glyph: '👒', likes: 'goods', text: '正好顺路，带一点回家。' },
    { name: 'mint', avatar: 'mint', likes: 'dish', text: '闻到甜甜的香气，就过来看看。' },
    { name: '旅行收藏家', glyph: '🧳', likes: 'treasure', text: '旅途中遇见的宝贝，总有自己的故事。' },
  ];
  const add = (s, id, quantity) => { s.inventory[id] = (s.inventory[id] || 0) + quantity; };
  const tradable = id => Boolean(items[id] && !['special', 'cash'].includes(items[id].group));
  const price = id => items[id] ? Math.floor(items[id].base * 1.3) : 0;
  const available = (s, id) => Math.max(0, (s.inventory[id] || 0) - (s.reserve[id] || 0));
  const validCount = q => Number.isSafeInteger(q) && q > 0 && q <= 999;
  const record = (s, text, kind = 'farm') => { s.logs.unshift({ at: s.time, text, kind }); s.logs = s.logs.slice(0, 40); };
  const hours = n => n * HOUR;
  const makeTree = (id, type, now, ready = 0) => ({ id, kind: 'tree', tree: type, name: trees[type].name, item: trees[type].item, amount: trees[type].amount, duration: hours(trees[type].hours), remaining: trees[type].rounds, ready, cap: 1, nextAt: ready ? 0 : now + hours(3), cared: false });
  function createState(now = Date.now()) {
    return { time: now, startedAt: now, coins: 3680, hearts: 128, inventory: { apple: 8, carrot: 4, tomato: 3, egg: 6, milk: 3, rice: 5, flour: 4, omelet: 2, pudding: 1, amber: 2, mechanism: 2, pearl: 1, coin_hoard: 1, golden_apple: 2 }, reserve: { egg: 2, milk: 1, mechanism: 1 },
      units: [makeTree('tree1', 'fruit', now, 1), makeTree('tree2', 'care', now), makeTree('tree3', 'gift', now), { id: 'tree4', kind: 'tree', name: '果园 04', tree: '', ready: 0 }, { id: 'tree5', kind: 'tree', name: '果园 05', tree: '', ready: 0 },
        { id: 'field1', name: '一号菜地', kind: 'field', item: 'carrot', amount: 4, duration: hours(4), ready: 1, cap: 1, nextAt: 0, cared: false },
        { id: 'field2', name: '二号菜地', kind: 'field', item: 'tomato', amount: 4, duration: hours(4), ready: 0, cap: 1, nextAt: now + hours(2), cared: false },
        { id: 'chicken', name: '暖暖鸡舍', kind: 'animal', item: 'egg', amount: 2, duration: hours(3), ready: 2, cap: 3, feed: 4, nextAt: now + hours(2), cared: false },
        { id: 'cow', name: '晨光牛棚', kind: 'animal', item: 'milk', amount: 2, duration: hours(6), ready: 1, cap: 3, feed: 3, nextAt: now + hours(4), cared: false }],
      listings: [], nextListingId: 1, stallLevel: 1, open: true, nextVisitAt: now + hours(.5), visits: 0, sold: 0, revenue: 0, premium: 0, sales: [], logs: [], seed: 9384, lastVisitor: null, claimTrip: false, built: false };
  }
  function unit(s, id) { return s.units.find(u => u.id === id); }
  function startCycle(s, u) {
    if (!u.item || u.ready >= u.cap || u.kind === 'animal' && u.feed <= 0 || u.kind === 'tree' && u.remaining <= 0) { u.nextAt = 0; return; }
    if (!u.nextAt) { u.nextAt = s.time + u.duration; u.cared = false; }
  }
  function rng(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
  function visit(s) {
    const visitor = visitorTypes[s.visits % visitorTypes.length]; s.visits++;
    const roll = rng(s);
    if (!s.open) return;
    const candidates = s.listings.filter(l => items[l.item].group === visitor.likes);
    const ordinary = s.listings.filter(l => items[l.item].group !== 'treasure');
    const pool = candidates.length ? candidates : visitor.likes === 'treasure' ? [] : ordinary;
    const listing = pool[Math.floor(roll * pool.length)];
    if (!listing || roll > .88) { s.lastVisitor = { ...visitor, bought: false, at: s.time }; return; }
    const quantity = Math.min(listing.quantity, visitor.likes === 'produce' ? 2 : 1);
    const total = quantity * listing.price, extra = quantity * (listing.price - items[listing.item].base);
    listing.quantity -= quantity; s.coins += total; s.sold += quantity; s.revenue += total; s.premium += extra;
    const sale = { visitor: visitor.name, avatar: visitor.avatar, glyph: visitor.glyph, item: listing.item, quantity, total, extra, at: s.time };
    s.sales.unshift(sale); s.sales = s.sales.slice(0, 24); s.lastVisitor = { ...visitor, bought: true, item: listing.item, quantity, at: s.time };
    s.listings = s.listings.filter(l => l.quantity > 0);
    record(s, `${visitor.name} 买走${items[listing.item].name} ×${quantity}，收入 ${total} 金币。`, 'sale');
  }
  function advance(s, target) {
    if (!Number.isFinite(target) || target <= s.time) return false;
    // Both continuous play and time skips use the same chronological events.
    while (true) {
      const next = Math.min(s.nextVisitAt, ...s.units.filter(u => u.nextAt > 0).map(u => u.nextAt));
      if (next > target) break;
      s.time = next;
      for (const u of s.units) if (u.nextAt === next) { u.ready++; if (u.kind === 'animal') u.feed--; u.nextAt = 0; startCycle(s, u); }
      if (s.nextVisitAt === next) { visit(s); s.nextVisitAt += hours(.5); }
    }
    s.time = target; return true;
  }
  function harvest(s, id) {
    const u = unit(s, id); if (!u || !u.ready) return false;
    const count = u.ready * u.amount;
    if (u.item === 'coins') s.coins += count; else add(s, u.item, count);
    record(s, `${u.name}收获${u.item === 'coins' ? '金币' : items[u.item].name} ×${count}。`);
    u.ready = 0;
    if (u.kind === 'tree') u.remaining--;
    if (u.kind === 'field') { u.item = ''; u.nextAt = 0; }
    else startCycle(s, u);
    return true;
  }
  function harvestAll(s) { let changed = false; for (const u of s.units) if (harvest(s, u.id)) changed = true; return changed; }
  function plant(s, id, choice) {
    const u = unit(s, id); if (!u || u.item) return false;
    if (u.kind === 'tree') {
      const t = trees[choice]; if (!t || s.coins < t.price) return false;
      s.coins -= t.price; Object.assign(u, makeTree(id, choice, s.time)); u.nextAt = s.time + hours(choice === 'money' || choice === 'golden' ? 72 : 12);
    } else if (u.kind === 'field') {
      if (!['carrot', 'tomato'].includes(choice) || s.coins < 12) return false;
      s.coins -= 12; u.item = choice; u.nextAt = s.time + u.duration; u.cared = false;
    } else return false;
    record(s, `${u.name}已安排新一轮生产。`); return true;
  }
  function clearTree(s, id) {
    const u = unit(s, id); if (!u || u.kind !== 'tree' || !u.tree || u.remaining > 0 || u.ready) return false;
    const cost = ['money', 'golden'].includes(u.tree) ? 80 : 20; if (s.coins < cost) return false;
    s.coins -= cost; Object.assign(u, { tree: '', item: '', nextAt: 0, name: '空闲果园土地' }); return true;
  }
  function care(s, id) {
    const u = unit(s, id); if (!u || !u.nextAt || u.cared || u.nextAt - s.time <= 60000) return false;
    u.nextAt = Math.max(s.time + 60000, u.nextAt - u.duration * .1); u.cared = true; return true;
  }
  function feed(s, id) {
    const u = unit(s, id); if (!u || u.kind !== 'animal' || u.feed >= 6) return false;
    const cost = (6 - u.feed) * 8; if (s.coins < cost) return false;
    s.coins -= cost; u.feed = 6; startCycle(s, u); return true;
  }
  function setReserve(s, id, q) {
    if (!items[id] || !Number.isSafeInteger(q) || q < 0 || q > 999) return false;
    s.reserve[id] = q; return true;
  }
  const capacity = s => s.stallLevel + 2;
  function list(s, id, q) {
    if (!tradable(id) || !validCount(q) || available(s, id) < q || s.listings.length >= capacity(s)) return false;
    s.inventory[id] -= q;
    s.listings.push({ id: s.nextListingId++, item: id, quantity: q, price: price(id), listedAt: s.time });
    record(s, `${items[id].name} ×${q} 已上架，每份 ${price(id)} 金币。`, 'stall'); return true;
  }
  function delist(s, id) {
    const i = s.listings.findIndex(l => l.id === id); if (i < 0) return false;
    const l = s.listings[i]; add(s, l.item, l.quantity); s.listings.splice(i, 1); return true;
  }
  function upgrade(s) {
    const cost = s.stallLevel === 1 ? 600 : 1000;
    if (s.stallLevel >= 3 || s.coins < cost) return false;
    s.coins -= cost; s.stallLevel++; return true;
  }
  function cook(s, id, q) {
    const r = recipes[id]; if (!r || !validCount(q) || Object.entries(r.materials).some(([id, count]) => (s.inventory[id] || 0) < count * q)) return false;
    for (const [id, count] of Object.entries(r.materials)) s.inventory[id] -= count * q;
    add(s, id, q); s.hearts += r.hearts * q; record(s, `做好${r.name} ×${q}，制作心心 +${r.hearts * q}。`, 'kitchen'); return true;
  }
  function recover(s, id, q) {
    if (items[id]?.group !== 'treasure' || !validCount(q) || available(s, id) < q) return false;
    s.inventory[id] -= q; s.coins += items[id].base * q; record(s, `工会回收${items[id].name} ×${q}，收入 ${items[id].base * q} 金币。`, 'guild'); return true;
  }
  function redeem(s, q) {
    if (!validCount(q) || available(s, 'coin_hoard') < q) return false;
    s.inventory.coin_hoard -= q; s.coins += 360 * q; return true;
  }
  function expedition(s) {
    if (s.claimTrip) return false;
    s.claimTrip = true; add(s, 'amber', 2); add(s, 'mechanism', 1); add(s, 'pearl', 1); record(s, '远行收获入库：溪谷琥珀 ×2、古旧机芯 ×1、月光珍珠 ×1。', 'guild'); return true;
  }
  function build(s) {
    if (s.built || s.coins < 900 || (s.inventory.mechanism || 0) < 1) return false;
    s.inventory.mechanism--; s.coins -= 900; s.built = true; record(s, '用保留的古旧机芯修好了前哨观测台。', 'guild'); return true;
  }
  return { HOUR, items, trees, recipes, visitorTypes, createState, advance, unit, harvest, harvestAll, plant, clearTree, care, feed, available, setReserve, tradable, price, capacity, list, delist, upgrade, cook, recover, redeem, expedition, build };
})();
