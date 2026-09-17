var FarmPrototype = (() => {
  const M = FarmModel, A = FarmArt, I = A.icon;
  let state = M.createState(), page = 'farm', filter = 'all', modal = null, offset = 0, toastTimer, demoOpen = false;
  const app = document.getElementById('app'), dialog = document.getElementById('dialog');
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const number = n => Number(n).toLocaleString('zh-CN');
  const time = at => new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const left = at => { const min = Math.max(0, Math.ceil((at - state.time) / 60000)); return min >= 60 ? `${Math.floor(min / 60)} 小时${min % 60 ? ` ${min % 60} 分` : ''}` : `${min} 分钟`; };
  const itemArt = (id, cls = '') => ASSETS[id] ? `<img class="item-art ${cls}" src="${ASSETS[id]}" alt="" aria-hidden="true">` : `<span class="item-art ${cls}" aria-hidden="true">${M.items[id]?.glyph || '🪙'}</span>`;
  const petArt = (id = 'furo', cls = '') => `<img class="${cls}" src="${ASSETS[id]}" alt="${id === 'furo' ? 'Furo' : id}">`;
  const button = (label, action, id = '', cls = '', disabled = false) => `<button type="button" class="button ${cls}" data-a="${action}" data-id="${id}"${disabled ? ' disabled' : ''}>${label}</button>`;
  const textButton = (label, action, id = '') => `<button type="button" class="text-button" data-a="${action}" data-id="${id}">${label}</button>`;
  const readyUnits = () => state.units.filter(u => u.ready > 0);
  function unitStatus(u) {
    if (!u.item) return '等待安排';
    if (u.ready >= u.cap) return '可以收获';
    if (u.kind === 'tree' && u.remaining <= 0) return '等待清理';
    if (!u.nextAt) return u.kind === 'animal' ? '等待补充饲料' : '等待安排';
    return `还需 ${left(u.nextAt)}`;
  }
  function toast(text) {
    const el = document.getElementById('toast'); el.textContent = text; el.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3300);
  }
  function heading(eyebrow, title, desc, extra = '') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${extra}</div>`; }
  function nav() {
    return `<header class="topbar"><div class="brand"><span class="brand-mark">${I('leaf')}</span><div class="brand-name">Pocket<small>陪你，把日子过成喜欢的样子</small></div></div><span class="top-caption">一方小院 · 一点收获</span><div class="wallet"><span class="pill">${I('coin', 'coin')}<b>${number(state.coins)}</b></span><span class="pill">${I('heart', 'heart')}<b>${number(state.hearts)}</b></span><span class="companion">${petArt('furo')}<span>Furo 的小日子</span></span></div></header>
      <nav class="main-nav" aria-label="主要页面">${[['farm', 'farm', '农场', readyUnits().length], ['market', 'stall', '门口小摊', state.listings.length], ['stock', 'box', '仓库与厨房', 0], ['guild', 'guild', '工会回收', 0]].map(([id, icon, label, badge]) => `<button class="nav-button ${page === id ? 'active' : ''}" data-a="nav" data-id="${id}" ${page === id ? 'aria-current="page"' : ''}>${I(icon)}${label}${badge ? `<span class="nav-badge">${badge}</span>` : ''}</button>`).join('')}<span class="nav-note">慢慢生长，也慢慢遇见。</span></nav>`;
  }
  function farmPage() {
    const ready = readyUnits(), chicken = M.unit(state, 'chicken'), cow = M.unit(state, 'cow');
    const readyCount = ready.reduce((sum, u) => sum + u.ready * u.amount, 0);
    const orchard = state.units.filter(u => u.kind === 'tree');
    return heading('A LITTLE FARM, A LOVELY DAY', '把日子，种得慢一点。', '收一篮新鲜，留一份给自己，也分一点给路过的人。', `<span class="season-tag">${I('sun')}初秋 · 晴 ${time(state.time)}</span>`) +
      `<div class="layout"><div><section class="scene-card" aria-label="农场总览"><div class="scene">${A.farm()}<div class="scene-title">FURO'S LITTLE FARM<span>新鲜的期待，正在这里生长</span></div>
        <button class="zone orchard ${orchard.some(u => u.ready) ? 'ready' : ''}" data-a="zone" data-id="orchard"><b>🌳 小小果园</b><small>${orchard.filter(u => u.ready).length} 块可收获 · 五块土地</small></button>
        <button class="zone chicken ${chicken.ready ? 'ready' : ''}" data-a="zone" data-id="chicken"><b>🥚 暖暖鸡舍</b><small>${chicken.ready ? `${chicken.ready * 2} 颗鸡蛋可收取` : unitStatus(chicken)}</small></button>
        <button class="zone cow ${cow.ready ? 'ready' : ''}" data-a="zone" data-id="cow"><b>🥛 晨光牛棚</b><small>${cow.ready ? `${cow.ready * 2} 瓶鲜奶可收取` : unitStatus(cow)}</small></button>
        <button class="zone field" data-a="zone" data-id="field"><b>🥕 四季菜地</b><small>看看今天长得怎么样</small></button>
        <button class="zone market" data-a="nav" data-id="market"><b>⛺ 门口的小摊</b><small>${state.open ? '正在营业' : '暂停营业'} · ${state.listings.length} 格有货</small></button>${petArt('furo', 'scene-pet')}</div><div class="scene-caption"><span>${I('leaf')}点一点区域，照料你的小农场</span><span>果园 · 菜地 · 养殖 · 摊位</span></div></section>
        <div class="section-heading"><h2>农场里的小事</h2><small>照料一次，期待就近一点</small></div><div class="facility-grid">${facilityCard('chicken', '🐓', 'chicken')}${facilityCard('cow', '🐄', 'cow')}<article class="facility"><div class="facility-head"><span class="facility-symbol">🌱</span><span class="status">${state.units.filter(u => u.kind === 'field' && u.item).length} 块在种植</span></div><h3>四季菜地</h3><p>番茄与胡萝卜，刚好做一餐</p><div class="progress"><i style="width:65%"></i></div>${button('去菜地看看', 'zone', 'field', 'full small')}</article></div>
      </div><aside class="stack"><section class="panel"><div class="panel-heading"><h2>这一篮，成熟了</h2>${I('leaf')}</div><div class="harvest-count"><strong>${ready.length}</strong><span>处等待收获</span></div><p style="font-size:11px">${ready.length ? `共 ${readyCount} 份收获，已经替你数好啦。` : '都收好了，让它们再长一会儿。'}</p><div class="harvest-items">${ready.length ? ready.map(u => `<span class="mini-item">${itemArt(u.item)}×${u.ready * u.amount}</span>`).join('') : '<span class="helper">收获后可去仓库做菜，也可以上架。</span>'}</div>${button(`${I('box')} 一起收进仓库`, 'harvest-all', '', 'primary full', !ready.length)}<div class="tiny-divider"></div><h3 style="font-size:12px">接下来的一点安排</h3><div class="task">${I('clock')}<div><b>照料鸡舍和牛棚</b><small>饲料分别可支持 ${chicken.feed} / ${cow.feed} 轮生产</small></div></div><div class="task">${I('stall')}<div><b>${state.listings.length ? '让小摊替你慢慢卖' : '给门口的小摊添点货'}</b><small>货架 ${state.listings.length}/${M.capacity(state)} · 留足食材再出售</small></div></div>${textButton(`整理仓库 ${I('arrow')}`, 'nav', 'stock')}</section><div class="quote-card">${petArt('furo')}<div><p>“今天的鸡蛋，<br>要不要留两颗做早餐？”</p><small>来自 Furo 的小小提议</small></div></div></aside></div>`;
  }
  function facilityCard(id, glyph, zone) {
    const u = M.unit(state, id), ratio = u.nextAt ? Math.max(0, Math.min(100, (1 - (u.nextAt - state.time) / u.duration) * 100)) : u.ready ? 100 : 0;
    return `<article class="facility"><div class="facility-head"><span class="facility-symbol">${glyph}</span><span class="status ${u.ready ? 'ready' : !u.nextAt ? 'pause' : ''}">${u.ready ? `存放 ${u.ready}/${u.cap} 轮` : !u.nextAt ? '等待饲料' : '安心生长'}</span></div><h3>${u.name}</h3><p>${unitStatus(u)}</p><div class="progress"><i style="width:${ratio}%"></i></div>${button('收取 / 照料', 'zone', zone, 'full small')}</article>`;
  }
  function records(entries, max = 5) {
    if (!entries.length) return '<p class="empty-copy">还没有成交记录。<br>摆好商品，等一位路过的客人。</p>';
    return `<div class="record-list">${entries.slice(0, max).map(sale => `<div class="record">${sale.avatar ? petArt(sale.avatar, 'record-avatar') : `<span class="record-avatar" aria-hidden="true">${sale.glyph || '🧳'}</span>`}<div class="record-copy"><b>${sale.visitor} 买了${M.items[sale.item].name}</b><p>${time(sale.at)} · ×${sale.quantity} · 额外 +${sale.extra}</p></div><span class="record-amount">+${sale.total}</span></div>`).join('')}</div>`;
  }
  function marketPage() {
    const visitor = state.lastVisitor;
    return heading('A SMALL STALL, SOME LITTLE ENCOUNTERS', '把多出来的美好，摆出来。', '有人买走新鲜，也有人带来一句问候。', button(`${I('plus')} 上架商品`, 'choose', '', 'primary', state.listings.length >= M.capacity(state))) +
      `<div class="layout"><div><section class="market-scene" aria-label="门口的小摊">${A.market()}<div class="market-sign"><i class="live-dot" style="${!state.open ? 'background:#b3aa88' : ''}"></i>${state.open ? '小摊正在营业' : '今天暂时歇一会儿'}</div>${petArt('furo', 'market-pet')}${visitor?.avatar ? petArt(visitor.avatar, 'market-pet visitor-pet') : `<span class="visitor-glyph" aria-hidden="true">${visitor?.glyph || '👒'}</span>`}<div class="speech">${visitor ? visitor.bought ? `${visitor.name}：${visitor.text}` : `${visitor.name} 逛了一圈，今天还没挑中。` : '这里有什么新鲜的好东西呀？'}</div></section>
      <div class="section-heading"><h2>今天的货架</h2><small>${state.listings.length} / ${M.capacity(state)} 格使用中 · 上架即留在摊位</small></div><div class="shelf-grid">${state.listings.map(l => `<article class="shelf"><div class="shelf-label">LITTLE FIND · ${String(l.id).padStart(2, '0')}</div>${itemArt(l.item)}<h3>${M.items[l.item].name} <small>×${l.quantity}</small></h3><div class="price-line"><b>${l.price} 金币 / 份</b><small>${M.items[l.item].group === 'treasure' ? '等收藏家' : '日常好物'}</small></div><p class="helper">${M.items[l.item].group === 'treasure' ? `比工会多 ${l.price - M.items[l.item].base} / 份` : '路过的客人会自动挑选'}</p>${textButton('下架并放回仓库', 'delist', l.id)}</article>`).join('')}${Array.from({ length: M.capacity(state) - state.listings.length }, () => `<button class="shelf empty" data-a="choose">${I('plus')}<b>给这一格添点新鲜</b><small>从仓库选择商品</small></button>`).join('')}</div>
      <section class="panel" style="margin-top:22px"><div class="panel-heading"><h2>来客留下的足迹</h2><small>最近的成交</small></div>${records(state.sales, 6)}</section></div>
      <aside class="stack"><section class="panel"><div class="panel-heading"><h2>小摊营业簿</h2><small>${state.open ? '营业中' : '已休息'}</small></div><p style="font-size:11px">本次经营收入</p><div class="stat-large">${number(state.revenue)}<span>金币</span></div><div class="stat-row"><span>售出商品</span><b>${state.sold} 份</b></div><div class="stat-row"><span>其中，摆摊多赚</span><b>+${number(state.premium)} 金币</b></div><div class="tiny-divider"></div><div class="fact-box"><strong>好东西，值得等一等。</strong><br>售价按基础出售价值增加约 30%，取整到金币。珍品需要等收藏家；日常食材更容易遇到买家。</div><p class="helper">只有已上架的商品会出售。离开页面也能营业，收获物不会自动补上货架。</p>${button(state.open ? '让小摊休息一会儿' : '重新开门营业', 'toggle-open', '', 'full', false)}</section>
      <section class="panel"><div class="panel-heading"><h2>多留一个位置</h2>${I('stall')}</div><p style="font-size:11px;line-height:1.9">扩充陈列位置，让日常食材和旅行珍品都能有自己的小角落。</p><div class="stat-row"><span>当前货架</span><b>${M.capacity(state)} 格 / 最多 5 格</b></div>${button(state.stallLevel >= 3 ? '货架已经备齐' : `扩充一格 · ${state.stallLevel === 1 ? 600 : 1000} 金币`, 'upgrade', '', 'soft full', state.stallLevel >= 3 || state.coins < (state.stallLevel === 1 ? 600 : 1000))}<p class="helper">增加陈列位置，客流由营业时间决定。</p></section></aside></div>`;
  }
  function stockPage() {
    const visible = Object.keys(M.items).filter(id => (state.inventory[id] || 0) > 0 && (filter === 'all' || filter === 'treasure' ? filter === 'all' || ['treasure', 'cash', 'special'].includes(M.items[id].group) : M.items[id].group === filter));
    return heading('KEEP A LITTLE, SHARE A LITTLE', '先留一份给自己。', '食材、好物和旅途收获，都在同一个小仓库。') +
      `<div class="layout"><div><div class="stock-note">${I('lock')}设定保留数量后，上架和工会回收都会为你留下这部分；做菜和建设可以使用。</div><div class="inventory-toolbar"><div class="filters" aria-label="库存分类">${[['all', '全部'], ['produce', '食材'], ['dish', '料理'], ['goods', '日常好物'], ['treasure', '旅行收藏']].map(([id, label]) => `<button class="filter ${filter === id ? 'active' : ''}" data-a="filter" data-id="${id}" aria-pressed="${filter === id}">${label}</button>`).join('')}</div></div><div class="inventory-grid">${visible.map(id => {
        const item = M.items[id], held = state.reserve[id] || 0;
        return `<article class="stock-card"><div class="stock-art-row">${itemArt(id)}<b>×${state.inventory[id]}</b></div><h3>${item.name}</h3><p>${held ? `自用保留 ${held} · 可出售 ${M.available(state, id)}` : item.group === 'special' ? '特殊探索与建设用品' : '留一点生活里的好东西'}</p><div class="stock-actions">${item.group === 'cash' ? button('兑换', 'redeem-dialog', id, 'soft', !M.available(state, id)) : button('上架', 'list-dialog', id, 'soft', !M.tradable(id) || !M.available(state, id) || state.listings.length >= M.capacity(state))}${button(`${I('lock')} 保留`, 'reserve-dialog', id)}</div></article>`;
      }).join('') || '<p class="empty-copy">这一类暂时没有库存。</p>'}</div></div><aside class="stack"><section class="panel"><div class="panel-heading"><h2>今天，做点什么？</h2>${I('pot')}</div>${Object.entries(M.recipes).map(([id, r]) => `<article class="recipe"><div class="recipe-title">${itemArt(id)}<div><h3>${r.name}</h3><p>做一份 · 制作心心 +${r.hearts}</p></div></div><div class="ingredients">${Object.entries(r.materials).map(([id, q]) => `<span class="${(state.inventory[id] || 0) < q ? 'missing' : ''}">${M.items[id].name} ${state.inventory[id] || 0}/${q}</span>`).join('')}</div>${button('准备制作', 'cook-dialog', id, 'soft full', Object.entries(r.materials).some(([id, q]) => (state.inventory[id] || 0) < q))}</article>`).join('')}<p class="helper">做好的料理放回仓库，可留下自用或上架。制作心心只在做菜时获得。</p></section><section class="panel"><div class="panel-heading"><h2>卖给路过的人</h2>${I('stall')}</div><p style="font-size:11px;line-height:1.9">上架后的物品暂存在摊位。需要用到时，可以下架取回剩余商品。</p>${textButton(`去门口小摊 ${I('arrow')}`, 'nav', 'market')}</section></aside></div>`;
  }
  function guildPage() {
    const ids = Object.keys(M.items).filter(id => M.items[id].group === 'treasure');
    return heading('FROM YOUR JOURNEY, TO A NEW BEGINNING', '每件收获，都有下一站。', '换成下一趟的盘缠，留给收藏家，或为前哨添一块砖。', button(state.claimTrip ? '远行收获已入库' : '收好远行收获', 'expedition', '', 'soft', state.claimTrip)) +
      `<div class="layout"><div><div class="guild-banner"><div class="guild-seal">${I('guild')}</div><div><div class="eyebrow">OUTPOST TRADING DESK</div><h2>前哨工会 · 物资回收处</h2><p>工会按明示价格立即收购。愿意多等一会儿，也可以把珍品带回门口的小摊。</p></div></div>${ids.map(id => {
        const item = M.items[id], avail = M.available(state, id), keep = state.reserve[id] || 0;
        return `<article class="treasure">${itemArt(id)}<div><div class="treasure-head"><h3>${item.name}</h3><small>仓库 ${state.inventory[id] || 0} 份</small></div><p>${item.source} · ${item.note}</p>${keep ? `<div class="material-note">${I('lock')}已保留 ${keep} 份，可出售 ${avail} 份</div>` : ''}<div class="trade-options">${button(`回收 ${number(item.base)} / 份`, 'recover-dialog', id, '', !avail)}${button(`摆摊 ${number(M.price(id))} / 份`, 'list-dialog', id, 'soft', !avail || state.listings.length >= M.capacity(state))}${textButton('调整保留', 'reserve-dialog', id)}</div></div></article>`;
      }).join('')}<div class="cash-row">${itemArt('coin_hoard')}<div><b>金币堆 ×${state.inventory.coin_hoard || 0}</b><p>现金类收获，直接兑换金币。</p></div>${button('兑换 · 360 / 份', 'redeem-dialog', 'coin_hoard', '', !M.available(state, 'coin_hoard'))}</div></div><aside class="stack"><section class="panel"><div class="panel-heading"><h2>留给下一次出发</h2>${I('leaf')}</div><div class="project-art" aria-hidden="true">${state.built ? '🔭' : '🏡'}</div><h3 class="project-name">${state.built ? '观测台，重新亮起来了' : '修复前哨观测台'}</h3><p class="project-desc">${state.built ? '保留下来的机芯有了新的用处。这份建设进度会留在本次试玩中。' : '让带回来的古旧机芯再次转动，给下一段旅途留一个看星星的地方。'}</p><p class="project-cost">${state.built ? '✓ 建设完成' : `古旧机芯 1 个 · 900 金币（仓库 ${state.inventory.mechanism || 0} 个）`}</p>${button(state.built ? '已经修好了' : '查看建设', 'build-dialog', '', 'primary full', state.built || state.coins < 900 || (state.inventory.mechanism || 0) < 1)}<p class="helper">建设会使用你保留的材料，完成后不会重复扣除。</p></section><section class="panel"><div class="panel-heading"><h2>两种出售方式</h2>${I('book')}</div><div class="task">${I('coin')}<div><b>现在需要金币</b><small>工会回收，即时到账</small></div></div><div class="task">${I('clock')}<div><b>愿意慢慢等客人</b><small>摆摊多赚约 30%，占用一个货架</small></div></div><p class="helper">已上架的珍品暂存在摊位，工会只会处理仓库中可出售的部分。</p></section></aside></div>`;
  }
  function demo() {
    return `<details class="demo-controls" id="demo-controls"${demoOpen ? ' open' : ''}><summary>试玩控制 <span>演示数据 · 价格待平衡 · 刷新重置 · 不读写游戏存档</span></summary><div class="demo-content">${button(`${I('clock')} 等下一位来客`, 'skip-guest', '', 'small')}${button('快进 1 小时', 'skip-hour', '', 'small')}${button(`${I('moon')} 离线 8 小时后回来`, 'offline', '', 'small')}${button(`${I('reset')} 重新试玩`, 'reset-dialog', '', 'small')}<p>演示时间 ${time(state.time)}；生产与交易共用这条时间线。模拟离线仅结算已上架商品，货物售完就停止销售。</p></div></details><footer class="footer"><span>POCKET · 一方小院，一点期待</span><span>FARM & MARKET / INTERACTIVE STUDY</span></footer>`;
  }
  function render() {
    app.innerHTML = `<div class="shell">${nav()}<main id="main">${({ farm: farmPage, market: marketPage, stock: stockPage, guild: guildPage })[page]()}</main>${demo()}</div>`;
    renderDialog();
  }
  function open(type, id = '', extra = {}) { modal = { type, id, ...extra }; renderDialog(); }
  function close() { modal = null; if (dialog.open) dialog.close(); dialog.innerHTML = ''; }
  function unitPanel(u) {
    const symbol = u.kind === 'animal' ? u.id === 'cow' ? '🐄' : '🐓' : u.kind === 'field' ? '🌱' : M.trees[u.tree]?.glyph || '🌳';
    let actions = '', detail = '';
    if (!u.item) {
      if (u.kind === 'tree') actions = `<div class="plant-options">${Object.entries(M.trees).map(([id, t]) => button(`${t.name} · ${t.price}`, 'plant', `${u.id}:${id}`, '', state.coins < t.price)).join('')}</div>`;
      else actions = `<div class="plant-options">${['carrot', 'tomato'].map(id => button(`种${M.items[id].name} · 12 金币`, 'plant', `${u.id}:${id}`, '', state.coins < 12)).join('')}</div>`;
    } else {
      detail = `${u.ready ? `待收取 ${u.ready * u.amount} ${u.item === 'coins' ? '金币' : `份${M.items[u.item].name}`} · ` : ''}${u.kind === 'tree' ? `还可收获 ${u.remaining} 次` : u.kind === 'animal' ? `存放 ${u.ready}/${u.cap} 轮 · 饲料 ${u.feed}/6 轮` : '本轮产出 4 份，收获后重新播种'}`;
      actions = `<div class="unit-actions">${button(u.ready ? '收进仓库' : '还在生长', 'harvest', u.id, 'primary', !u.ready)}${u.kind === 'tree' && u.remaining <= 0 ? button(`清理 · ${['money', 'golden'].includes(u.tree) ? 80 : 20} 金币`, 'clear-tree', u.id) : button(u.cared ? '这轮照料过了' : u.kind === 'animal' ? '照料 · 缩短 10%' : '浇水 · 缩短 10%', 'care', u.id, '', !u.nextAt || u.cared || u.nextAt - state.time <= 60000)}${u.kind === 'animal' ? button(u.feed >= 6 ? '饲料已备足' : `补足饲料 · ${(6 - u.feed) * 8} 金币`, 'feed', u.id, '', u.feed >= 6 || state.coins < (6 - u.feed) * 8) : ''}</div>`;
    }
    return `<article class="modal-unit"><div class="unit-heading"><span aria-hidden="true">${symbol}</span><div><h3>${u.name}${u.kind === 'field' && u.item ? ` · ${M.items[u.item].name}` : ''}</h3><p>${unitStatus(u)}</p></div>${u.ready ? '<span class="status ready">可收获</span>' : ''}</div>${detail ? `<p class="unit-footnote">${detail}</p>` : ''}${actions}</article>`;
  }
  function tradeForm(type, id) {
    const item = M.items[id], recipe = M.recipes[id];
    const max = type === 'reserve' ? 999 : type === 'cook' ? Math.min(999, ...Object.entries(recipe.materials).map(([id, q]) => Math.floor((state.inventory[id] || 0) / q))) : M.available(state, id);
    const q = type === 'reserve' ? state.reserve[id] || 0 : Math.min(type === 'list' && item.group !== 'treasure' ? 3 : 1, max);
    const unitPrice = type === 'list' ? M.price(id) : type === 'recover' || type === 'redeem' ? item.base : type === 'cook' ? recipe.hearts : 0;
    const label = { list: '上架数量', recover: '回收数量', redeem: '兑换数量', reserve: '至少保留', cook: '制作份数' }[type];
    const notes = { list: '上架后移入摊位，等待客人购买；下架可以取回尚未卖出的商品。', recover: '确认后立即扣除对应珍品，金币直接到账。保留数量已经排除在可出售范围外。', redeem: '按每堆 360 金币兑换，不参与摆摊加价。', reserve: '保留数量会限制出售和回收；做菜、建设仍可使用。已上架的商品需先下架才能保留。', cook: '使用仓库食材制作，包含为自己保留的食材。成品和制作心心一起到账。' };
    const verb = { list: '确认上架', recover: '确认回收', redeem: '确认兑换', reserve: '保存保留数量', cook: '开始制作' }[type];
    return `<div class="trade-item">${itemArt(id)}<div><h3>${item.name}</h3><p>仓库 ${state.inventory[id] || 0} 份${type === 'cook' ? '' : ` · 保留 ${state.reserve[id] || 0} 份`}</p>${type === 'list' ? `<p>每份 ${unitPrice} 金币 · 基础出售价值 ${item.base}</p>` : ''}</div></div><form data-form="${type}" data-id="${id}"><div class="form-field"><label for="quantity">${label}<small>${type === 'reserve' ? '可以为未来收获预留数量' : `本次最多 ${max} 份`}</small></label><input id="quantity" name="quantity" type="number" inputmode="numeric" min="${type === 'reserve' ? 0 : 1}" max="${max}" step="1" required value="${q}" data-price="${unitPrice}" data-kind="${type}"></div>${type === 'cook' ? `<div class="ingredients">${Object.entries(recipe.materials).map(([id, q]) => `<span>${M.items[id].name} ×${q} / 份</span>`).join('')}</div>` : ''}${type !== 'reserve' ? `<div class="quote-total"><span>${type === 'list' ? '全部售出预计获得' : type === 'cook' ? '本次制作心心' : '确认后获得'}</span><div><strong id="quote-number">${number(q * unitPrice)}</strong> <small>${type === 'cook' ? '心心' : '金币'}</small></div></div>` : ''}<div class="form-note">${notes[type]}${type === 'list' && item.group === 'treasure' ? '<br>这件珍品需要等待收藏家来访。' : ''}</div><button type="submit" class="button primary full"${max < 1 && type !== 'reserve' ? ' disabled' : ''}>${verb}</button></form>`;
  }
  function renderDialog() {
    if (!modal) { if (dialog.open) dialog.close(); return; }
    const { type, id } = modal; let title = '', subtitle = '', body = '';
    if (type === 'zone') {
      title = { orchard: '小小果园', field: '四季菜地', chicken: '暖暖鸡舍', cow: '晨光牛棚' }[id];
      subtitle = id === 'orchard' ? '五块土地，接着种下新的期待。' : id === 'field' ? '挑一种蔬菜，照料它，再收进厨房。' : '饲料充足时持续生产，收集篮满了就歇一歇。';
      const units = state.units.filter(u => id === 'orchard' ? u.kind === 'tree' : id === 'field' ? u.kind === 'field' : u.id === id);
      body = units.map(unitPanel).join('');
    } else if (type === 'choose') {
      title = '挑一点，摆上小摊'; subtitle = `空余货架 ${M.capacity(state) - state.listings.length} 格 · 已扣除自用保留数量`;
      const ids = Object.keys(M.items).filter(id => M.tradable(id) && M.available(state, id) > 0);
      body = state.listings.length >= M.capacity(state) ? '<p class="empty-copy">货架已经摆满，先下架一件或扩充位置。</p>' : `<div class="choose-grid">${ids.map(id => `<button class="choose-item" data-a="list-dialog" data-id="${id}">${itemArt(id)}<b>${M.items[id].name}</b><small>可上架 ${M.available(state, id)} · ${M.price(id)} 金币 / 份</small></button>`).join('')}</div>${!ids.length ? '<p class="empty-copy">还没有可出售的商品，先去农场收获吧。</p>' : ''}`;
    } else if (['list', 'recover', 'reserve', 'cook', 'redeem'].includes(type)) {
      title = { list: '给货架添点新鲜', recover: '交给工会回收', reserve: '这一份，留给自己', cook: '做一份热乎的小心意', redeem: '把金币收进口袋' }[type];
      subtitle = M.items[id].name; body = tradeForm(type, id);
    } else if (type === 'offline') {
      title = '欢迎回到你的小农场'; subtitle = '这 8 小时里，小小的生活仍在继续。';
      body = `<div class="offline-hero">${I('sun')}<h3>有新收获，也有新来客。</h3><p>已经替你记好这段时间的收支。</p></div><div class="offline-stats"><div><b>+${number(modal.income)}</b><small>摆摊金币 · 已到账</small></div><div><b>${modal.sold}</b><small>已售出商品</small></div></div>${records(modal.sales, 4)}<div class="tiny-divider"></div><p class="form-note">农场有 ${readyUnits().length} 处可以收获。${state.listings.length ? '未售出的商品继续留在摊位。' : '摊位已没有在售商品，补上货再继续营业吧。'}存满的收集篮会暂停生产，记得去收取。</p>${button('收好营业记录', 'close', '', 'primary full')}`;
    } else if (type === 'build') {
      title = '修复前哨观测台'; subtitle = '让这一趟带回来的材料，成为下一趟的起点。';
      body = `<div class="project-art" aria-hidden="true">🔭</div><p class="form-note">将消耗古旧机芯 1 个（包含保留材料）和 900 金币。完成后可在工会页面看到修复结果。</p>${button('确认建设 · 900 金币', 'build', '', 'primary full', state.built || state.coins < 900 || (state.inventory.mechanism || 0) < 1)}`;
    } else if (type === 'reset') {
      title = '从新的一篮收获开始'; subtitle = '本次试玩的收获、交易和建设进度将重置。';
      body = `<p class="form-note">重新载入初始演示数据，方便再次比较不同选择。</p>${button('重新开始试玩', 'reset', '', 'primary full')}`;
    }
    dialog.innerHTML = `<header class="modal-header"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-a="close" aria-label="关闭面板">${I('close')}</button></header><div class="modal-body">${body}</div>`;
    if (!dialog.open) dialog.showModal();
  }
  function finish(ok, message, dismiss = false) { if (ok && dismiss) close(); render(); toast(ok ? message : '当前数量、库存或余额已变化，请重新选择。'); return ok; }
  function skip(ms, offline = false) {
    const before = { income: state.revenue, sold: state.sold, at: state.time };
    offset += ms; M.advance(state, state.time + ms);
    if (offline) open('offline', '', { income: state.revenue - before.income, sold: state.sold - before.sold, sales: state.sales.filter(s => s.at > before.at) });
    render(); if (!offline) toast(`时间来到 ${time(state.time)}，收入 +${state.revenue - before.income} 金币。`);
  }
  const handlers = {
    nav(id) { if (!['farm', 'market', 'stock', 'guild'].includes(id)) return; page = id; close(); render(); window.scrollTo({ top: 0, behavior: 'instant' }); },
    zone(id) { if (['orchard', 'field', 'chicken', 'cow'].includes(id)) open('zone', id); },
    choose() { open('choose'); },
    close,
    'harvest-all'() { finish(M.harvestAll(state), '这一篮收获，已经放进仓库。'); },
    harvest(id) { finish(M.harvest(state, id), '收获已放进仓库。'); },
    care(id) { finish(M.care(state, id), '照料好了，这一轮会更快一点。'); },
    feed(id) { finish(M.feed(state, id), '饲料补足了，可以安心生产。'); },
    plant(id) { const [unit, choice] = id.split(':'); finish(M.plant(state, unit, choice), '已经种下，慢慢期待下一次收获。'); },
    'clear-tree'(id) { finish(M.clearTree(state, id), '土地清理好了，可以重新种植。'); },
    filter(id) { if (['all', 'produce', 'dish', 'goods', 'treasure'].includes(id)) { filter = id; render(); } },
    'list-dialog'(id) { if (M.tradable(id)) open('list', id); },
    'reserve-dialog'(id) { if (M.items[id]) open('reserve', id); },
    'recover-dialog'(id) { if (M.items[id]?.group === 'treasure') open('recover', id); },
    'redeem-dialog'() { open('redeem', 'coin_hoard'); },
    'cook-dialog'(id) { if (M.recipes[id]) open('cook', id); },
    delist(id) { finish(M.delist(state, Number(id)), '剩余商品已放回仓库。'); },
    'toggle-open'() { state.open = !state.open; render(); toast(state.open ? '小摊重新营业啦。' : '小摊已休息，商品会留在货架。'); },
    upgrade() { finish(M.upgrade(state), '多了一个货架位置。'); },
    expedition() { finish(M.expedition(state), '远行收获已入库，可以选择保留、回收或摆摊。'); },
    'build-dialog'() { open('build'); },
    build() { finish(M.build(state), '观测台修好了，保留的材料有了新的用处。', true); },
    'skip-guest'() { skip(Math.max(1, state.nextVisitAt - state.time)); },
    'skip-hour'() { skip(M.HOUR); },
    offline() { skip(8 * M.HOUR, true); },
    'reset-dialog'() { open('reset'); },
    reset() { close(); state = M.createState(); offset = 0; page = 'farm'; filter = 'all'; render(); toast('新的一天，从这一篮收获开始。'); },
  };
  function submit(type, id, q) {
    if (!modal || modal.type !== type || modal.id !== id) return false;
    const actions = { list: () => M.list(state, id, q), recover: () => M.recover(state, id, q), reserve: () => M.setReserve(state, id, q), cook: () => M.cook(state, id, q), redeem: () => M.redeem(state, q) };
    if (!actions[type]) return false;
    return finish(actions[type](), { list: '上架好了，等客人来挑选。', recover: '工会已收下物资，金币到账。', reserve: '自用数量已经记好了。', cook: '料理做好了，成品和心心已收好。', redeem: '金币已经到账。' }[type], true);
  }
  function syncTime() { return M.advance(state, Date.now() + offset); }
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-a]'); if (!target || target.disabled) return;
    const action = handlers[target.dataset.a]; if (!action) return;
    syncTime(); action(target.dataset.id || '');
  });
  document.addEventListener('submit', event => {
    const form = event.target; if (!form.dataset.form) return;
    event.preventDefault(); syncTime(); submit(form.dataset.form, form.dataset.id, Number(form.elements.quantity.value));
  });
  document.addEventListener('input', event => {
    const el = event.target; if (el.id !== 'quantity') return;
    const quote = document.getElementById('quote-number'); if (quote) quote.textContent = el.validity.valid ? number(Number(el.value) * Number(el.dataset.price)) : '—';
  });
  document.addEventListener('toggle', event => { if (event.target.id === 'demo-controls') demoOpen = event.target.open; }, true);
  dialog.addEventListener('cancel', () => { modal = null; });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  setInterval(() => { if (!modal) { syncTime(); render(); } }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncTime(); if (!modal) render(); } });
  render();
  return { get state() { return state; }, get page() { return page; }, get modal() { return modal; }, render, handlers, submit, esc };
})();
