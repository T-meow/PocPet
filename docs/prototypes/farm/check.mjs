// Behavior checks use Node only; visual and touch review belongs to the user.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import postcss from 'postcss';
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const ctx = vm.createContext({ console }); vm.runInContext(read('model.js'), ctx);
const M = ctx.FarmModel, start = Date.UTC(2026, 8, 17, 1), H = M.HOUR;
const fresh = () => M.createState(start);
const copy = value => JSON.parse(JSON.stringify(value));
const balance = s => JSON.stringify({ coins: s.coins, hearts: s.hearts, inventory: s.inventory, listings: s.listings });
let s = fresh();
// Harvest, empty land, plant costs and the one-care-per-cycle rule.
const eggs = s.inventory.egg, milk = s.inventory.milk, coins = s.coins;
assert(M.harvestAll(s)); assert.equal(s.inventory.egg, eggs + 4); assert.equal(s.inventory.milk, milk + 2);
assert(!M.harvestAll(s)); assert.equal(M.unit(s, 'field1').item, '');
assert(M.plant(s, 'field1', 'tomato')); assert.equal(s.coins, coins - 12);
assert(!M.plant(s, 'field1', 'carrot')); assert(M.care(s, 'field1')); assert(!M.care(s, 'field1'));
M.advance(s, start + 4 * H); assert(M.harvest(s, 'field1')); assert.equal(s.inventory.tomato, 7);
assert(M.plant(s, 'tree4', 'money')); const cash = s.coins;
M.advance(s, s.time + 72 * H); assert(M.harvest(s, 'tree4')); assert.equal(s.coins, cash + 300);
// Livestock pauses at capacity or when feed runs out; it resumes from the action time.
s = fresh(); M.advance(s, start + 48 * H);
assert.equal(M.unit(s, 'chicken').ready, 3); assert.equal(M.unit(s, 'chicken').nextAt, 0);
assert(M.harvest(s, 'chicken')); assert.equal(M.unit(s, 'chicken').nextAt, s.time + 3 * H);
const cow = M.unit(s, 'cow'); cow.ready = 0; cow.nextAt = s.time + H; cow.feed = 1;
M.advance(s, s.time + H); assert.equal(cow.feed, 0); assert.equal(cow.ready, 1); assert.equal(cow.nextAt, 0);
const beforeFeed = s.coins; assert(M.feed(s, 'cow')); assert.equal(s.coins, beforeFeed - 48); assert.equal(cow.nextAt, s.time + 6 * H);
assert(!M.feed(s, 'cow'));
// Trees finish their finite harvest count, then can be cleared and replanted.
s = fresh(); const tree = M.unit(s, 'tree1'); tree.remaining = 1;
assert(M.harvest(s, 'tree1')); assert.equal(tree.remaining, 0); assert.equal(tree.nextAt, 0);
assert(!M.harvest(s, 'tree1')); assert(M.clearTree(s, 'tree1')); assert.equal(tree.item, ''); assert(!M.clearTree(s, 'tree1'));
assert(M.plant(s, 'tree1', 'care')); assert.equal(tree.remaining, 10);
// Escrow conserves items; reserved inventory cannot be listed or recovered.
s = fresh(); assert.equal(M.available(s, 'mechanism'), 1);
let before = balance(s); assert(!M.list(s, 'mechanism', 2)); assert.equal(balance(s), before);
assert(M.list(s, 'mechanism', 1)); assert.equal(s.inventory.mechanism, 1); assert.equal(M.available(s, 'mechanism'), 0);
before = balance(s); assert(!M.recover(s, 'mechanism', 1)); assert.equal(balance(s), before);
const listingId = s.listings[0].id; assert(M.delist(s, listingId)); assert.equal(s.inventory.mechanism, 2); assert(!M.delist(s, listingId));
assert(M.list(s, 'egg', 4)); assert(M.list(s, 'milk', 2)); assert(M.list(s, 'amber', 1));
assert(!M.list(s, 'apple', 1)); assert(M.upgrade(s)); assert(M.list(s, 'apple', 1));
for (const q of [-1, 0, .5, NaN, Infinity, 10000]) { before = balance(s); assert(!M.list(s, 'carrot', q)); assert(!M.recover(s, 'pearl', q)); assert(!M.cook(s, 'pudding', q)); assert.equal(balance(s), before); }
assert(!M.list(s, 'golden_apple', 1)); assert(!M.list(s, 'coin_hoard', 1)); assert(!M.recover(s, 'egg', 1));
// Cooking consumes reserved self-use ingredients and grants its rewards once.
s = fresh(); M.setReserve(s, 'egg', 6); const hearts = s.hearts;
assert(M.cook(s, 'pudding', 3)); assert.equal(s.inventory.milk, 0); assert.equal(s.inventory.egg, 3); assert.equal(s.inventory.pudding, 4); assert.equal(s.hearts, hearts + 9);
before = balance(s); assert(!M.cook(s, 'pudding', 1)); assert.equal(balance(s), before);
assert(M.recover(s, 'mechanism', 1)); assert(M.build(s)); assert.equal(s.inventory.mechanism, 0); assert(!M.build(s));
const c = s.coins; assert(M.redeem(s, 1)); assert.equal(s.coins, c + 360); assert(!M.redeem(s, 1));
assert(M.expedition(s)); before = balance(s); assert(!M.expedition(s)); assert.equal(balance(s), before);
// The complete player loop: collect, cook, list, sell, then recover/build.
s = fresh(); assert(M.harvestAll(s)); assert(M.cook(s, 'pudding', 1)); assert(M.list(s, 'pudding', 1)); assert(M.list(s, 'egg', 3)); assert(M.list(s, 'mechanism', 1));
const baselineCoins = s.coins; M.advance(s, start + 8 * H);
assert(s.revenue > 0); assert.equal(s.coins, baselineCoins + s.revenue); assert(s.sales.some(v => v.visitor === 'mint')); assert(s.sales.some(v => v.visitor === '旅行收藏家'));
assert.equal(s.inventory.mechanism, 1); assert(M.build(s));
// Offline and stepwise advancement produce the same transactions and farm state.
const once = fresh(), stepped = fresh();
for (const state of [once, stepped]) { assert(M.list(state, 'egg', 4)); assert(M.list(state, 'pudding', 1)); assert(M.list(state, 'amber', 2)); }
M.advance(once, start + 8 * H); for (let n = 1; n <= 96; n++) M.advance(stepped, start + n * H / 12);
assert.deepEqual(copy(once), copy(stepped)); assert.equal(once.sold, once.sales.reduce((n, sale) => n + sale.quantity, 0));
assert.equal(once.revenue, once.sales.reduce((n, sale) => n + sale.total, 0));
assert.equal(once.premium, once.sales.reduce((n, sale) => n + sale.extra, 0));
before = balance(once); assert(!M.advance(once, once.time)); assert(!M.advance(once, start)); assert.equal(balance(once), before);
s = fresh(); assert(M.list(s, 'egg', 3)); s.open = false; M.advance(s, start + 8 * H); assert.equal(s.revenue, 0); assert.equal(s.listings[0].quantity, 3);
s.open = true; M.advance(s, s.time + 8 * H); assert.equal(s.sold, 3);
// Standalone artifact, parsing, rendering, event wiring, and every action identifier.
const html = read('../farm.html'), script = html.match(/<script>([\s\S]*)<\/script>/)[1];
assert(!/fetch\(|localStorage|sessionStorage|<script[^>]+src=|<link[^>]+href=|@import/.test(html));
assert.equal((html.match(/data:image\/png;base64,/g) || []).length, 14);
postcss.parse(read('ui.css'));
const listeners = {}, elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { id, innerHTML: '', textContent: '', open: false, classList: { add() {}, remove() {} }, addEventListener(type, fn) { listeners[`${id}:${type}`] = fn; }, showModal() { this.open = true; }, close() { this.open = false; } });
  return elements.get(id);
}
const doc = { getElementById: element, hidden: false, addEventListener(type, fn) { listeners[type] = fn; } };
const browser = vm.createContext({ document: doc, window: { scrollTo() {} }, console, Date, setTimeout() {}, clearTimeout() {}, setInterval() {} });
vm.runInContext(script, browser, { timeout: 10000 }); const P = browser.FarmPrototype;
const markup = () => element('app').innerHTML + element('dialog').innerHTML;
function checkMarkup() {
  const textMarkup = markup().replace(/data:image\/[^"']+/g, '[embedded image]');
  assert(!/\bundefined\b|\bNaN\b/.test(textMarkup), textMarkup.match(/.{0,80}(?:undefined|NaN).{0,80}/)?.[0]);
  for (const [, action] of markup().matchAll(/data-a="([^"]+)"/g)) assert.equal(typeof P.handlers[action], 'function', action);
  assert(!/<button[^>]*>\s*<button/.test(markup()));
}
checkMarkup();
for (const page of ['farm', 'market', 'stock', 'guild']) { P.handlers.nav(page); assert.equal(P.page, page); checkMarkup(); }
for (const zone of ['orchard', 'field', 'chicken', 'cow']) { P.handlers.zone(zone); assert(element('dialog').open); checkMarkup(); P.handlers.close(); }
for (const category of ['all', 'produce', 'dish', 'goods', 'treasure']) { P.handlers.nav('stock'); P.handlers.filter(category); checkMarkup(); }
for (const [action, id] of [['choose', ''], ['list-dialog', 'egg'], ['reserve-dialog', 'egg'], ['recover-dialog', 'amber'], ['cook-dialog', 'pudding'], ['redeem-dialog', 'coin_hoard'], ['build-dialog', ''], ['reset-dialog', '']]) { P.handlers[action](id); checkMarkup(); P.handlers.close(); }
// Dispatch the same click and submit listeners used by the page, including stale submissions.
function click(action, id = '') { listeners.click({ target: { closest: () => ({ disabled: false, dataset: { a: action, id } }) } }); checkMarkup(); }
function form(type, id, quantity) { listeners.submit({ preventDefault() {}, target: { dataset: { form: type, id }, elements: { quantity: { value: String(quantity) } } } }); checkMarkup(); }
click('harvest-all'); click('cook-dialog', 'pudding'); form('cook', 'pudding', 1);
click('reserve-dialog', 'egg'); form('reserve', 'egg', 2);
click('nav', 'market'); click('choose'); click('list-dialog', 'egg'); form('list', 'egg', 3);
assert.equal(P.state.listings.length, 1); before = balance(P.state); form('list', 'egg', 3); assert.equal(balance(P.state), before);
click('list-dialog', 'amber'); form('list', 'amber', 1);
click('offline'); assert.equal(P.modal.type, 'offline'); assert(P.state.revenue > 0); checkMarkup(); click('close');
click('nav', 'guild'); click('recover-dialog', 'mechanism'); form('recover', 'mechanism', 1); assert.equal(P.state.inventory.mechanism, 1);
click('build-dialog'); click('build'); assert(P.state.built);
click('expedition'); click('redeem-dialog'); form('redeem', 'coin_hoard', 1);
click('upgrade'); click('toggle-open'); click('skip-hour'); click('toggle-open'); click('skip-guest');
click('reset-dialog'); click('reset'); assert.equal(P.page, 'farm'); assert.equal(P.state.listings.length, 0); assert(!P.state.built);
console.log('PASS: production, reserves, inventory escrow, cooking, recovery, construction, visitors, offline equivalence, standalone resources, CSS, page branches and click/submit flows. Visual review remains manual.');
