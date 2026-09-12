const M=globalThis.AdventureModel;
let S=M.createState();
const U={page:'map',region:'valley',tool:'rope',meal:false,minutes:120,goal:'gather',route:'standard',book:'landmarks',selected:null,previewNode:null,modal:null,clockOffset:0};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Math.round(n).toLocaleString('zh-CN');
const roleName=id=>({furo:'Furo',doro:'Doro',mint:'mint'})[id];
const now=()=>Date.now()+U.clockOffset;
const activeRegion=()=>regionById(U.region);
const neighborRole=id=>S.regions[id].neighborRole||(S.role==='doro'?'mint':'doro');
const pet=(role=S.role,cls='',happy=false)=>`<img class="pet ${cls}" src="${ASSETS[happy&&role==='furo'?'furo_happy':role]}" alt="${roleName(role)}" draggable="false">`;
const btn=(label,action,value='',cls='',disabled=false)=>`<button type="button" class="btn ${cls}" data-action="${action}" data-value="${esc(value)}"${disabled?' disabled':''}>${label}</button>`;
const badge=(label,kind='')=>`<span class="badge ${kind}">${label}</span>`;
const stat=(value,kind,label='')=>`<span class="resource ${kind}">${icon(kind)}<b>${num(value)}</b>${label?`<span>${label}</span>`:''}</span>`;
const duration=n=>n===30?'30 分钟':`${n/60} 小时`;
const clockText=ms=>{const secs=Math.ceil(Math.max(0,ms)/1000);return `${Math.floor(secs/3600)?Math.floor(secs/3600)+'小时 ':''}${Math.floor(secs%3600/60)}分 ${secs%60}秒`;};
const productIcon=(id,r)=>['野果','林莓','蜂蜜','海藻'].includes(id)?'sprout':id===r.items[2]?'star':'flower';
function heading(kicker,title,copy,aside='') {return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${copy}</p></div>${aside}</div>`;}
function regions() {
  return `<div class="region-list" aria-label="选择地区">${REGIONS.map((r,i)=>`<button class="region ${U.region===r.id?'selected':''}" style="--region-color:${r.color};--region-pale:${r.pale}" data-action="region" data-value="${r.id}" aria-pressed="${U.region===r.id}"${S.trip?' disabled':''}><span class="region-symbol">${icon(r.icon)}</span><span><small>0${i+1}</small><strong>${r.name}</strong></span>${!S.regions[r.id].unlocked?icon('lock'):U.region===r.id?'<span class="current-dot"></span>':''}</button>`).join('')}</div>`;
}
function lockedCard(r) {
  const prev=REGIONS[REGIONS.indexOf(r)-1],p=S.regions[prev.id];
  return `<div class="panel locked-panel">${icon('lock')}<h2>下一站，${r.name}</h2><p>在${prev.name}发现 3 个基础地标，<br>或完整完成 3 趟远行，即可出发。</p><div class="unlock-progress"><span>手动地标 <b>${Math.min(3,p.landmarks.length)} / 3</b></span><span>完整远行 <b>${Math.min(3,p.trips)} / 3</b></span></div>${btn('回到'+prev.name,'region',prev.id,'primary')}<p class="fine-print">下方「试玩控制」可切换五地漫游，预览全部地区。</p></div>`;
}
function toolsAndMeal() {
  return `<div class="form-section"><div class="section-label"><b>一件顺手的工具</b><span>永久工具 · 选 1 件</span></div><div class="tool-options">${[['rope','绳索','轻松过桥，少绕一步'],['lens','放大镜','细看采集物，发现侧门']].map(([id,label,copy])=>`<button class="tool-option ${U.tool===id?'chosen':''}" data-action="tool" data-value="${id}" aria-pressed="${U.tool===id}"><span class="tool-icon">${icon(id)}</span><strong>${label}</strong><small>${copy}</small>${U.tool===id?icon('check'):''}</button>`).join('')}</div></div><button class="meal-option ${U.meal?'chosen':''}" data-action="meal" aria-pressed="${U.meal}"${S.meals<1?' disabled':''}><img src="${ASSETS.bento}" alt=""><span><b>带一份家常便当</b><small>${U.page==='expedition'?'出发时食用，体力成本 −2':'沿途主动食用，可多走 2 步'} · 现有 ${S.meals} 份</small></span><span class="toggle" aria-hidden="true"></span></button>`;
}
function possibleProducts(r){return `<div class="product-pills">${r.items.map(id=>`<span>${icon(productIcon(id,r))}${id}</span>`).join('')}</div>`;}
function preparePanel(r) {
  if(!S.regions[r.id].unlocked)return lockedCard(r);
  const affordable=S.coins>=60&&S.energy>=8;
  return `<section class="panel preparation"><div class="section-label"><span class="eyebrow">PACK FOR A LITTLE JOURNEY</span>${badge('约 5–8 分钟')}</div><h2>把今天，交给一条小路</h2><p>沿途采集，或先去高处看看。<br>走累了，随时带着已有发现回家。</p><div class="route-tip">${icon('compass')}<span><b>${r.story}</b><small>${r.clue}</small></span></div>${toolsAndMeal()}<div class="departure-cost"><span>本次补给</span><div>${stat(60,'coin')}${stat(8,'energy')}</div></div><div class="expected"><span>完整探索预计</span>${stat(scaledHearts(40,S.level),'heart')}<span>与沿路物品</span></div>${btn('一起出发 '+icon('arrow'),'start-explore','','primary wide',!affordable||!!S.trip||!!S.pending)}<p class="fine-print">${S.pending?'先收好上一趟行囊，再开始新的旅行。':!affordable?'金币或体力不足，可在试玩控制中重置示例。':'7 步起行 · 便当未食用会带回 · 战斗可选'}</p></section>`;
}
function nodeDescription(r,node) {
  return {start:'路牌指向两个方向：溪边偏采集，高处偏地标。',gather:`路边有一些${r.items[0]}。仔细观察，也许还能找到${r.items[1]}。`,ridge:'高处有一块旧路牌。站在这里，能看见下一段小路。',bridge:'前面的桥有些松动。用绳索扶稳，或花一步从旁边绕过去。',lookout:'风在这里慢了下来。和伙伴一起，把风景留在本子里。',story:r.clue,camp:'一个可以再次回来的地方。坐一会儿，再决定回家。',battle:'守卫伸了个懒腰，想和你切磋一下。不参与也可以继续旅行。'}[node];
}
function mapCanvas(r) {
  const t=S.trip?.kind==='explore'?S.trip:null,p=S.regions[r.id],available=t?availableNodes(S):[];
  return `<section class="map-card" aria-label="${r.name}探索地图"><div class="map-caption"><span>${icon('sun')} ${r.id==='station'?'星光正好':'雨后初晴'} · ${r.tag}</span>${badge(t?`还可以走 ${t.steps} 步`:'随心走，慢慢发现','paper')}</div><div class="map-canvas">${landscape(r)}${routeLines()}<span class="map-watermark">${r.name}<small>POCKET FIELD NOTES</small></span>${NODE_IDS.map((n,i)=>{
    const [x,y]=NODE_POS[n],current=t?.node===n,visited=t?.visited.includes(n),known=p.landmarks.includes(n),next=available.includes(n),locked=n==='battle'&&S.level<12;
    return `<button class="map-node ${current?'current':''} ${next?'reachable':''} ${visited||known?'visited':''} ${locked?'locked':''}" style="left:${x}%;top:${y}%" data-action="${t?'move':'preview-node'}" data-value="${n}" aria-label="${r.landmarks[i]}${current?'，当前所在':next?'，可以前往':locked?'，Lv.12 解锁':''}"${t&&!next?' disabled':''}><span class="node-pin">${icon(n==='start'?'flag':n==='battle'?'shield':n==='camp'?'home':n==='story'?r.icon:n==='gather'?'sprout':n==='ridge'?'compass':n==='bridge'?'rope':'sun')}</span><span class="node-label">${r.landmarks[i]}${n==='battle'?'<small>Lv.12 可选挑战</small>':''}</span>${current?'<span class="you-here">我们在这里</span>':''}</button>`;
  }).join('')}<div class="map-pet">${pet(t?.role||S.role)}<span>${t?'旅途正在继续':'准备好了，就出发吧。'}</span></div></div><div class="map-footer"><span><i class="legend-dot reachable"></i> ${t?'亮起的地标可以前往':'点击地标查看线索'}</span><span>${icon('book')} 地标 ${p.landmarks.length} / 6</span></div></section>`;
}
function journeyPanel(r) {
  const t=S.trip;
  if(t.battle)return battlePanel(r,t);
  const choices=nodeChoices(S),next=availableNodes(S);
  return `<section class="panel event-panel"><div class="section-label">${badge(t.complete?'已抵达返程点':'旅途中','green')}<span>${t.visited.length-1} 处足迹</span></div><h2 id="event-heading" tabindex="-1">${nodeName(t.region,t.node)}</h2><p>${nodeDescription(r,t.node)}</p><div class="travel-bubble">${pet(t.role)}<span>${esc(t.history.at(-1))}</span></div>${!t.resolved?`<div class="choices">${choices.map(c=>btn(`<span><strong>${c.label}</strong><small>${c.hint}</small></span>${icon('arrow')}`,'choice',c.id,'choice',c.disabled)).join('')}</div>`:`<div class="next-route"><b>${next.length?'接下来，往哪里走？':t.steps<=0?'走累了，今天就到这里':'在这里结束，也很好'}</b>${next.map(n=>btn(`<span>${nodeName(t.region,n)}<small>${n==='gather'?'采集食材':n==='ridge'?'寻找地标':n==='battle'?'可选 · 挑战准备费 30 金币':n==='camp'?'歇一会儿，准备回家':'继续探索'} · 1 步</small></span>${icon('arrow')}`,'move',n,'route-choice')).join('')}${!next.length?'<p>已有的发现都留在行囊里了。</p>':''}</div>`}<div class="trip-bag"><span>${icon('backpack')} 本趟行囊</span><b>${Object.entries(t.items).map(([id,n])=>`${id} ×${n}`).join(' · ')||'等一场小小的发现'}</b><span>${stat(t.coins,'coin')}</span></div>${t.meal?btn(icon('food')+(t.mealUsed?'便当已经吃过了':'坐下来吃便当 · +2 步'),'eat','','soft wide',t.mealUsed):''}${btn(icon('home')+(t.complete?'带着收获回家':'今天先回家'),'return','','wide '+(t.complete?'primary':'ghost'))}</section>`;
}
function battlePanel(r,t) {
  const b=t.battle,intent=battleIntent(b);
  return `<section class="panel battle-panel"><div class="section-label">${badge('第 '+b.round+' 回合','purple')}${badge('轻回合挑战')}</div><div class="guardian">${icon('shield')}<span>✦</span></div><h2 id="event-heading" tabindex="-1">${nodeName(r.id,'battle')}</h2><div class="meter-label"><span>守卫耐力</span><b>${b.foeHp} / ${b.maxFoeHp}</b></div><div class="meter enemy"><i style="width:${b.foeHp/b.maxFoeHp*100}%"></i></div><div class="intent">${icon('shield')}<span><b>下一步：${intent.label} · ${intent.damage} 点</b><small>${intent.tip}</small></span></div><div class="meter-label"><span>${roleName(t.role)} 的本场耐力</span><b>${b.hp} / ${b.maxHp}</b></div><div class="meter"><i style="width:${b.hp/b.maxHp*100}%"></i></div><div class="battle-actions">${btn(icon('sword')+'攻击','battle','attack','soft')}${btn(icon('shield')+'防守','battle','guard','soft')}${btn(icon('star')+(b.skillUsed?'能力已用过':'运动 · 蓄力一击'),'battle','skill','primary',b.skillUsed)}</div><p class="fine-print">防守减少本回合受到的伤害；能力每场可用一次。</p>${btn('先退到安全的地方','battle','retreat','ghost wide')}<p class="fine-print">挑战结束后独立耐力清除，探索发现始终保留。</p></section>`;
}
function mapPage() {
  const r=activeRegion(),t=S.trip;
  return `${heading('LET’S WANDER · 一起去远方','今天，想去哪里走走？','不用赶路。带一件顺手的工具，让每个转弯都有一点小期待。',badge(icon('compass')+'地图探索','green'))}${regions()}<div class="adventure-grid">${mapCanvas(r)}${t?.kind==='explore'?journeyPanel(r):preparePanel(r)}</div>${!t&&U.previewNode?`<div class="inline-discovery">${icon('flag')}<div><b>${nodeName(r.id,U.previewNode)}</b><p>${nodeDescription(r,U.previewNode)}</p></div>${btn(icon('close'),'clear-preview','','icon-btn')}</div>`:''}<div class="below-map"><section class="small-panel"><span class="round-icon gold">${icon('sprout')}</span><div><h3>把远方的味道带回家</h3>${possibleProducts(r)}</div></section><section class="small-panel"><span class="round-icon blue">${icon('home')}</span><div><h3>${r.base}</h3><p>${S.regions[r.id].base?'已经有一处熟悉的落脚点了。':'找到地区故事里的地点，解锁快捷回访。'}</p></div>${btn(icon('arrow'),'page','base','icon-btn')}</section></div>`;
}
function expeditionSetup(r) {
  if(!S.regions[r.id].unlocked)return lockedCard(r);
  const q=expeditionQuote(S,U.minutes,U.meal),p=S.regions[r.id];
  return `<section class="panel expedition-form"><h2>安排一趟远行</h2><p>去采一点食材，或者只是看看风景。</p><div class="form-section"><div class="section-label"><b>这次想做什么</b></div><div class="goal-options">${[['gather','sprout','采集','偏向地区食材'],['sightsee','book','游览','优先未收集见闻'],['challenge','shield','挑战重访','手动通关后开放']].map(([id,i,label,hint])=>`<button class="goal ${U.goal===id?'chosen':''}" data-action="goal" data-value="${id}" aria-pressed="${U.goal===id}"${id==='challenge'&&(!p.battle||S.level<12)?' disabled':''}>${icon(i)}<b>${label}</b><small>${hint}</small></button>`).join('')}</div></div><div class="form-section"><div class="section-label"><b>离开多久</b><span>完成后自动回家</span></div><div class="duration-options">${[30,120,360].map(n=>`<button class="duration ${U.minutes===n?'chosen':''}" data-action="duration" data-value="${n}" aria-pressed="${U.minutes===n}"><b>${duration(n)}</b><small>${DURATIONS[n].parts} 次沿路收获</small></button>`).join('')}</div></div>${toolsAndMeal()}<div class="expedition-summary"><div><span>出发成本</span><span>${stat(q.coins,'coin')}${stat(q.energy,'energy')}</span></div><div><span>完整返回</span><span>${stat(q.hearts,'heart')}${stat(Math.round(q.coins*1.6),'coin')}</span></div><p>${U.route==='shortcut'?r.items[1]:r.items[0]+(U.goal==='sightsee'?'':' / '+r.items[1])}共 ${q.parts} 件 · ${U.goal==='sightsee'&&p.findings.length===r.findings.length?'见闻已集齐，继续带回物品':'1 条旅行见闻'}</p></div>${btn('和 '+roleName(S.role)+' 说声一路顺风 '+icon('arrow'),'start-expedition','','primary wide',S.coins<q.coins||S.energy<q.energy||!!S.trip||!!S.pending)}<p class="fine-print">${S.pending?'先收好上一趟结果，即可继续出发。':'只安排这一趟；提前召回保留已完成节点的物品。'}</p></section>`;
}
function travelScene(r,t=null,base=false) {
  const p=S.regions[r.id],stage=base?p.repair:0;
  return `<section class="travel-scene ${base?'base-scene':''}">${landscape(r,base?'base':'travel',stage)}<div class="scene-top">${badge(icon(base?'home':'wind')+' '+(base?r.base:t?'正在 '+r.name+' 的路上':'下一站 · '+r.name),'paper')}${badge(base?['初次落脚','修缮完成','多了一点家的样子'][stage]:r.tag,'paper')}</div><div class="scene-pet">${pet(t?.role||S.role,'',base&&p.repair>0)}</div>${base&&p.neighborMet&&neighborRole(r.id)!==S.role?`<div class="neighbor-pet">${pet(neighborRole(r.id))}<span>${roleName(neighborRole(r.id))}</span></div>`:''}<div class="scene-speech">${t?esc(t.companionLine):base?stage>0?'下次还来这里坐坐，好不好？':'这里可以躲雨，也可以慢慢聊天。':r.subtitle}</div></section>`;
}
function expeditionRunning(r,t) {
  const progress=expeditionProgress(t,now());
  return `<section class="panel travel-panel"><div class="section-label">${badge('正在远行','green')}${badge(duration(t.quote.minutes))}</div><h2>远方也有我们的时光</h2><p>${roleName(t.role)} 带着${t.tool==='rope'?'绳索':'放大镜'}出发了。<br>摸摸或说句话，旅途会继续。</p><div class="countdown"><small>距离到家还有</small><strong id="countdown">${clockText(progress.remaining)}</strong></div><div class="meter travel"><i id="travel-progress" style="width:${progress.ratio*100}%"></i></div><div class="milestones">${t.fixedItems.map((id,i)=>`<span class="${i<progress.nodes?'done':''}" id="milestone-${i}">${icon(i<progress.nodes?'check':'sprout')}<small>${Math.round(t.quote.minutes/t.fixedItems.length*(i+1))} 分</small></span>`).join('')}</div><div class="companion-actions">${btn(icon('hand')+'摸摸','companion','touch','soft')}${btn(icon('chat')+'聊两句','companion','chat','soft')}</div><div class="route-tip">${icon('backpack')}<span><b id="travel-collected">已走过 ${progress.nodes} / ${t.fixedItems.length} 个收获节点</b><small>物品与小心心会在回家收好行囊时到账。</small></span></div>${btn('提前接伙伴回家','recall','','ghost wide')}<div class="demo-time"><span>试玩时间</span>${btn('到下个节点','fast-forward','node','text-btn')}${btn('直接到家','fast-forward','end','text-btn')}</div></section>`;
}
function expeditionPage() {
  const t=S.trip?.kind==='expedition'?S.trip:null,r=t?regionById(t.region):activeRegion();
  return `${heading('A JOURNEY WHILE YOU’RE AWAY · 挂机远行',t?'忙你的事，也能陪它走一程':'把行囊收好，等一封远方的信',t?'伙伴正在路上。来看看它，或者安心等它回家。':'选择采集或游览，离线也会按计划完成。第一张地图可以直接远行。',badge(icon('clock')+'自动返程','blue'))}${regions()}<div class="adventure-grid expedition-grid"><div>${travelScene(r,t)}<div class="small-panel travel-notes"><span class="round-icon blue">${icon('book')}</span><div><h3>路上的收获，慢慢记下来</h3><p>${t?'出发时已选好路线。途中陪伴不会改变结束时间。':'普通见闻与食材都会记入图鉴。手动地标仍留给你亲自发现。'}</p>${possibleProducts(r)}</div></div></div>${t?expeditionRunning(r,t):expeditionSetup(r)}</div>`;
}
function basePage() {
  const r=activeRegion(),p=S.regions[r.id],busy=!!S.trip;
  return `${heading('A PLACE TO COME BACK TO · 地区基地','远方，也有一盏为你留的灯','熟悉的落脚点可以随时回访。坐一会儿，和邻居说说今天的小事。',badge(icon('home')+'快捷回访','gold'))}${regions()}<div class="adventure-grid"><div>${travelScene(r,null,true)}<div class="base-story"><span class="round-icon">${icon('flower')}</span><div><h3>${p.base?'一点点，把这里变成喜欢的样子':'第一次到访，就从一条小路开始'}</h3><p>${p.base?'修复会留下可见的变化，不需要每天回来打卡。':r.clue}</p></div></div></div><section class="panel base-panel"><div class="section-label">${badge(p.base?'已经解锁':'等待发现',p.base?'green':'')}${badge('不收探索补给费')}</div><h2>${r.base}</h2><p>${p.base?'在这里休息、布置，再决定下一段路。':'亲自到访地区故事的终点，才能拥有这里的落脚点。'}</p>${!p.base?`<div class="empty-state">${icon('home')}<p>还有一处小小的地方，<br>等着留下我们来过的痕迹。</p></div>${btn('去地图寻找','page','map','primary wide')}`:`<div class="build-list">${r.repair.map((name,i)=>`<div class="build-row"><span class="build-icon ${p.repair>i?'done':''}">${icon(p.repair>i?'check':'hammer')}</span><div><b>${name}</b><small>${i===0?'让落脚点有一处完整的屋檐':'添上家具，让伙伴有地方坐坐'}</small></div>${p.repair>i?badge('已完成','green'):btn(`${icon('coin')}${[180,260][i]}`,'repair','','soft',p.repair!==i||busy||S.coins<[180,260][i])}</div>`).join('')}</div><div class="neighbor-card"><span class="eyebrow">A LITTLE ENCOUNTER</span><h3>${p.neighborMet?'屋檐下的见面':roleName(neighborRole(r.id))+' 今天也在这里'}</h3><p>${p.neighborMet?r.neighbor:'屋檐下有人朝我们挥了挥手。坐下来，听听它刚刚看到的事情。'}</p>${btn(icon('chat')+(p.neighborMet?'回看这次见面':'坐下来聊两句'),'neighbor','','soft wide',busy)}</div>${btn(icon('compass')+'从这里出发探索','page','map','primary wide',busy)}<p class="fine-print">${busy?'伙伴正在旅行，回家后再一起修复和拜访。':'回访和回看对话不会重复获得旅行奖励。'}</p>`}</section></div>`;
}
function journalEntries(r) {
  const p=S.regions[r.id];
  if(U.book==='landmarks')return ['gather','ridge','bridge','lookout','story','camp'].map(n=>({id:n,title:nodeName(r.id,n),known:p.landmarks.includes(n),icon:n==='camp'?'home':n==='story'?r.icon:'flag',body:nodeDescription(r,n),source:'亲自探索',hint:n==='ridge'?'从起点选择高处路线':'沿地图上标记的小路亲自寻找'}));
  if(U.book==='products')return r.items.map(id=>({id,title:id,known:p.products.includes(id),icon:productIcon(id,r),body:r.uses[r.items.indexOf(id)],source:'带回的产物',hint:'通过地图探索或远行带回'}));
  if(U.book==='findings')return r.findings.map((f,i)=>({id:String(i),title:p.findings.includes(f)?f:'一页尚未写下的见闻',known:p.findings.includes(f),icon:'book',body:f,source:'远行见闻',hint:'完整结束远行；游览优先发现新的见闻'}));
  return S.memories.filter(m=>m.region===r.id).map((m,i)=>({id:String(i),title:m.title,known:true,icon:m.kind==='neighbor'?'chat':m.kind==='base'?'home':'star',body:m.body,source:m.kind==='neighbor'?'基地偶遇':m.kind==='base'?'基地变化':'地区故事'}));
}
function journalPage() {
  const r=activeRegion(),p=S.regions[r.id],entries=journalEntries(r),selected=entries.find(e=>e.id===U.selected);
  return `${heading('OUR FIELD NOTES · 旅行手账','一起走过的路，都算数','地标、沿路的收获，还有那些小小的见面。随时翻开，看一眼我们到过的远方。',badge(icon('book')+'长期收藏','purple'))}${regions()}<div class="journal-summary"><div>${icon('flag')}<strong>${p.landmarks.length}<small>/ 6</small></strong><span>亲自发现的地标</span></div><div>${icon('backpack')}<strong>${p.trips}</strong><span>完整远行</span></div><div>${icon('home')}<strong>${p.base?'已点亮':'待发现'}</strong><span>${r.base}</span></div><div>${icon('shield')}<strong>${p.battle?'已通关':'待挑战'}</strong><span>战斗路线重访</span></div></div><div class="journal-layout"><section class="panel journal-panel"><div class="book-tabs" aria-label="图鉴分类">${[['landmarks','地标'],['products','产物'],['findings','远行见闻'],['memories','共同回忆']].map(([id,label])=>`<button class="${U.book===id?'active':''}" data-action="book" data-value="${id}" aria-pressed="${U.book===id}">${label}${U.book===id?`<small>${entries.filter(e=>e.known).length} / ${entries.length}</small>`:''}</button>`).join('')}</div><div class="collection-grid">${entries.map((e,i)=>`<button class="collection-card ${e.known?'known':'unknown'} ${U.selected===e.id?'selected':''}" data-action="entry" data-value="${e.id}"><span class="collection-art">${icon(e.icon)}<small>0${i+1}</small>${e.known?'<i>'+icon('check')+'</i>':''}</span><b>${e.title}</b><span>${e.known?e.source:'待发现 · 查看线索'}</span></button>`).join('')}</div>${!entries.length?'<div class="empty-state">'+icon('chat')+'<h3>这一页，留给下一次见面</h3><p>完成地区故事、修复基地或和邻居聊天，<br>一起经历的事情会留在这里。</p></div>':''}</section><aside class="panel notebook-detail">${selected?`<div class="large-entry-icon">${icon(selected.icon)}</div>${badge(selected.known?selected.source:'发现线索',selected.known?'green':'')}<h2>${selected.title}</h2><p>${selected.known?selected.body:selected.hint}</p>${!selected.known?btn('去'+(U.book==='findings'?'安排远行':'地图看看'),'page',U.book==='findings'?'expedition':'map','primary wide'):''}`:`<div class="notebook-cover">${icon('book')}<span>OUR<br>LITTLE<br>JOURNEYS</span><small>${r.name} · 旅行手账</small></div><p>选一张卡片，看看记下的故事。<br>用掉食材，也不会抹去曾经的发现。</p>`}</aside></div><section class="panel trip-history"><div class="section-label"><h2>最近的旅行</h2><span>保留本次试玩最近 20 趟</span></div>${S.logs.filter(l=>l.region===r.id).length?S.logs.filter(l=>l.region===r.id).slice(0,5).map(l=>`<div class="history-row">${icon(l.kind==='explore'?'compass':'clock')}<div><b>${l.title}</b><small>${Object.entries(l.items).map(([id,n])=>`${id} ×${n}`).join(' · ')||'沿途没有采集物'}${l.complete?'':' · 保留已有发现'}</small></div>${stat(l.hearts,'heart')}${stat(l.coins,'coin')}</div>`).join(''):'<p class="empty-copy">第一趟旅行回来后，就从这里开始记录。</p>'}</section>`;
}
function resultPage() {
  const t=S.pending;if(!t)return journalPage();const r=regionById(t.region);
  return `${heading('WELCOME HOME · 平安归来',t.complete?'回来啦，把今天的收获收好':'走到这里，也是一趟旅行','沿途得到的东西，和一起经历过的事情，都带回来了。')}<div class="result-layout"><section class="result-postcard">${landscape(r,'result')}<div class="postcard-title"><small>${r.name} · ${t.kind==='explore'?'亲自探索':duration(t.plannedMinutes||t.minutes)+'远行'}</small><h2>${t.complete?'今天，也有新的发现':'下次，再走远一点'}</h2></div><div class="result-pet">${pet(t.role,'',t.complete)}</div><span class="postmark">POCKET<br>平安归来<br>✦</span></section><section class="panel result-panel">${badge(t.complete?'完整行程':'提前返回',t.complete?'green':'gold')}<h2>这一趟的行囊</h2><div class="result-rewards">${stat(t.hearts,'heart','小心心')}${stat(t.coins,'coin','沿路金币')}</div>${!t.complete?'<p class="fine-print">提前返回保留已有物品，不计完整次数与完程小心心。</p>':''}<div class="result-items">${Object.entries(t.items).map(([id,n])=>`<div>${icon(productIcon(id,r))}<b>${id}</b><strong>× ${n}</strong></div>`).join('')||'<p>这次没有采集物，已经亲自发现的地标依然保留。</p>'}</div>${t.refundCoins||t.refundEnergy?`<div class="refund-row"><span>退回未用的行程成本</span>${stat(t.refundCoins,'coin')}${stat(t.refundEnergy,'energy')}</div>`:''}${t.mealReturned?'<p class="return-meal">'+icon('food')+' 未食用的便当已经带回了。</p>':''}${t.battleWon?'<div class="route-tip">'+icon('shield')+'<span><b>挑战路线已通关</b><small>收好行囊后，可以安排挑战重访远行。</small></span></div>':''}<div class="result-story"><span class="eyebrow">TODAY’S LITTLE STORY</span><p>${esc(t.findings[0]||t.history.at(-1))}</p></div>${btn('收好行囊，记入手账 '+icon('check'),'claim','','primary wide')}</section></div>`;
}
function demoControls() {
  return `<details class="demo-controls"><summary>${icon('compass')}试玩控制<span>切换示例 · 快进时间 · 刷新重置</span></summary><div class="demo-options"><label>当前伙伴<select data-control="role"${S.trip||S.pending?' disabled':''}>${['furo','doro','mint'].map(id=>`<option value="${id}"${S.role===id?' selected':''}>${roleName(id)}</option>`).join('')}</select></label><div class="demo-presets">${btn('初次出门 · Lv.8','preset','new','soft')}${btn('溪谷挑战 · Lv.12','preset','challenge','soft')}${btn('五地漫游 · Lv.30','preset','roam','soft')}</div></div><p>独立演示进度，仅保留在当前页面；不读取或改写游戏存档。五地漫游直接开放五个地区与基础落脚点。收益与建设费用为候选数值，未模拟正式存档的增益卡、成就与技能加成。</p></details>`;
}
function render() {
  const r=activeRegion(),tabs=[['map','compass','地图探索'],['expedition','backpack','挂机远行'],['base','home','地区基地'],['journal','book','旅行手账']];
  const pages={map:mapPage,expedition:expeditionPage,base:basePage,journal:journalPage,result:resultPage};
  const active=document.activeElement,key=active?.getAttribute?.('data-action'),val=active?.getAttribute?.('data-value');
  $('app').innerHTML=`<div class="app-shell" style="--accent:${r.color};--tint:${r.pale}"><header class="topbar"><a class="brand" href="./ui-v2.html" aria-label="打开小窝 UI 原型"><span class="brand-mark">${icon('sprout')}</span><span>Pocket<small>和你去远方</small></span></a><span class="prototype-label">冒险原型 <i></i> 演示进度</span><div class="wallet">${stat(S.coins,'coin')}${stat(S.hearts,'heart')}${stat(S.energy,'energy')}</div><div class="companion-chip">${pet()}<span>${roleName(S.role)}<small>Lv.${S.level}</small></span></div></header><nav class="main-nav" aria-label="冒险页面">${tabs.map(([id,i,label])=>`<button class="${U.page===id?'active':''}" data-action="page" data-value="${id}" aria-current="${U.page===id?'page':'false'}">${icon(i)}<span>${label}</span>${id==='expedition'&&S.trip?.kind==='expedition'?'<i class="live-dot"></i>':''}</button>`).join('')}<span class="nav-caption">一起走走，慢慢长大。</span></nav>${S.pending&&U.page!=='result'?`<div class="activity-banner">${icon('backpack')}<span>伙伴回家了，还有一份行囊等着收好。</span>${btn('查看收获 '+icon('arrow'),'page','result','text-btn')}</div>`:S.trip&&((S.trip.kind==='explore'&&U.page!=='map')||(S.trip.kind==='expedition'&&U.page!=='expedition'))?`<div class="activity-banner">${icon('compass')}<span>${roleName(S.trip.role)} 正在${regionById(S.trip.region).name}${S.trip.kind==='explore'?'探索':'远行'}。</span>${btn('回到旅途 '+icon('arrow'),'resume','','text-btn')}</div>`:''}<main id="main-content">${(pages[U.page]||mapPage)()}</main>${demoControls()}<footer class="page-footer"><span>Pocket · 每一段小路，都有一起走过的意义</span><span>冒险玩法原型 / 01</span></footer></div>`;
  if(U.page==='expedition'&&!S.trip&&S.regions[U.region].shortcut){
    const target=$('app').querySelector('.expedition-form .form-section');
    target?.insertAdjacentHTML('beforebegin',`<div class="form-section shortcut-picker"><div class="section-label"><b>找到的近路，也能带伙伴重访</b></div><div class="tool-options">${btn('常规小路','route','standard',U.route==='standard'?'primary':'soft')}${btn('标记的近路','route','shortcut',U.route==='shortcut'?'primary':'soft')}</div><p class="fine-print">近路集中采集${activeRegion().items[1]}；时长、成本和小心心不变。</p></div>`);
  }
  renderModal();
  if(key&&!U.modal){const match=[...document.querySelectorAll('[data-action]')].find(el=>el.getAttribute('data-action')===key&&el.getAttribute('data-value')===val);match?.focus({preventScroll:true});}
}
function renderModal() {
  const m=U.modal;if(!m){$('modal-root').innerHTML='';document.body.classList.remove('modal-open');return;}
  let title='',body='',confirm='继续';
  if(m.kind==='return'){title='今天就走到这里？';body=S.trip.complete?'已经抵达返程点，可以结算完整探索与沿路收获。':'已经得到的物品、地标和故事都会保留；提前返回不增加完整探索次数或完程小心心。';confirm='带伙伴回家';}
  if(m.kind==='recall'){
    const p=recallPreview(S,now());if(!p){U.modal=null;return renderModal();}
    title='提前接伙伴回家？';body=`已完成 ${p.nodes} 个收获节点，保留这些节点的物品与沿路金币。退回 ${p.refundCoins} 金币、${p.refundEnergy} 体力；固定出发成本不退。${S.trip.meal?'便当已在出发时吃掉，不会退回。':''}提前返回不获得完程小心心与见闻。`;confirm='现在回家';
  }
  if(m.kind==='preset'){title='从这份示例重新开始？';body='当前试玩中的行程、发现与收获会重置。正式游戏进度不受影响。';confirm='切换示例';}
  $('modal-root').innerHTML=`<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><span class="round-icon">${icon(m.kind==='preset'?'refresh':'home')}</span><h2 id="dialog-title">${title}</h2><p>${body}</p><div class="dialog-actions">${btn('先留下','cancel','','soft')}${btn(confirm,'confirm','','primary')}</div></section></div>`;
  document.body.classList.add('modal-open');$('modal-root').querySelector('button')?.focus();
}
let toastTimer;
function notify(message) {$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function dispatch(action,value='') {
  let ok=true,focusEvent=false,scroll=false;
  // Settle elapsed trips before acting, including when a confirmation was left open.
  if(advance(S,now())){U.modal=null;notify('伙伴按计划平安到家了。');}
  if(action==='page'){U.page=value;if(S.trip&&(value==='map'||value==='expedition'))U.region=S.trip.region;scroll=true;}
  else if(action==='region'){if(S.trip)return false;U.region=value;U.selected=null;U.previewNode=null;if(U.goal==='challenge'&&!S.regions[value].battle)U.goal='gather';if(!S.regions[value].shortcut)U.route='standard';}
  else if(action==='tool')U.tool=value;
  else if(action==='meal'){if(S.meals>0)U.meal=!U.meal;}
  else if(action==='duration')U.minutes=Number(value);
  else if(action==='goal')U.goal=value;
  else if(action==='route')U.route=value;
  else if(action==='preview-node')U.previewNode=value;
  else if(action==='clear-preview')U.previewNode=null;
  else if(action==='start-explore'){ok=startExploration(S,{region:U.region,tool:U.tool,meal:U.meal});if(ok){U.previewNode=null;notify('出发啦，选择一个亮起的地标。');focusEvent=true;}}
  else if(action==='move'){ok=moveTo(S,value);focusEvent=ok;}
  else if(action==='choice'){ok=resolveNode(S,value);focusEvent=ok;}
  else if(action==='eat'){ok=eatMeal(S);if(ok)notify('便当吃好啦，还能多走两步。');}
  else if(action==='battle'){ok=battleAction(S,value);focusEvent=ok;}
  else if(action==='return'&&S.trip?.kind==='explore')U.modal={kind:'return'};
  else if(action==='start-expedition'){ok=startExpedition(S,{region:U.region,minutes:U.minutes,goal:U.goal,tool:U.tool,meal:U.meal,route:U.route},now());if(ok)notify('行囊收好，伙伴已经出发。');}
  else if(action==='resume'){U.region=S.trip.region;U.page=S.trip.kind==='explore'?'map':'expedition';scroll=true;}
  else if(action==='companion'&&S.trip?.kind==='expedition'){
    S.trip.companionLine=value==='touch'?'伙伴蹭了蹭你的手。能一起走到这里，真好。':regionById(S.trip.region).findings[Math.min(3,Math.floor(expeditionProgress(S.trip,now()).ratio*4))]+'。回来再慢慢说给你听。';
    notify(value==='touch'?'摸摸它，行程继续。':'伙伴给你捎来了一句路上的话。');
  }
  else if(action==='fast-forward'&&S.trip?.kind==='expedition'){
    const t=S.trip,p=expeditionProgress(t,now()),target=value==='end'?t.end:t.start+(p.nodes+1)*(t.end-t.start)/t.fixedItems.length;
    U.clockOffset+=Math.max(0,target-now())+10;advance(S,now());if(S.pending){U.page='result';notify('伙伴平安到家啦。');}
  }
  else if(action==='recall'&&S.trip?.kind==='expedition')U.modal={kind:'recall'};
  else if(action==='claim'){const region=S.pending?.region;ok=claimResult(S);if(ok){U.region=region;U.page='journal';U.book='products';U.selected=null;U.meal=U.meal&&S.meals>0;notify('收获与旅行记录已经收好了。');scroll=true;}}
  else if(action==='repair'){ok=repairBase(S,U.region);if(ok)notify('修复完成，场景里多了一点新的变化。');}
  else if(action==='neighbor'){
    if(S.regions[U.region].neighborMet){U.page='journal';U.book='memories';U.selected=null;}
    else {ok=meetNeighbor(S,U.region);if(ok)notify('这次见面，记在共同回忆里了。');}
  }
  else if(action==='book'){U.book=value;U.selected=null;}
  else if(action==='entry')U.selected=value;
  else if(action==='preset')U.modal={kind:'preset',value};
  else if(action==='cancel')U.modal=null;
  else if(action==='confirm'){
    const m=U.modal;U.modal=null;
    if(m?.kind==='return'){ok=finishExploration(S);if(ok)U.page='result';}
    if(m?.kind==='recall'){ok=finishExpedition(S,now());if(ok||S.pending)U.page='result';}
    if(m?.kind==='preset'){S=createState(m.value);Object.assign(U,{page:'map',region:'valley',tool:'rope',meal:false,goal:'gather',route:'standard',clockOffset:0,selected:null,previewNode:null});scroll=true;notify('已经换成新的试玩示例。');}
  }
  render();if(scroll)window.scrollTo({top:0,behavior:'smooth'});if(focusEvent)$('event-heading')?.focus({preventScroll:true});
  if(!ok)notify('当前还不能进行这一步，请先完成行程或查看所需条件。');return ok;
}
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-action]');if(button&&!button.disabled)dispatch(button.dataset.action,button.dataset.value||'');});
document.addEventListener('change',event=>{if(event.target.dataset.control==='role'&&!S.trip&&!S.pending){S.role=event.target.value;render();}});
document.addEventListener('keydown',event=>{
  if(!U.modal)return;
  if(event.key==='Escape'){event.preventDefault();dispatch('cancel');}
  if(event.key==='Tab'){
    const nodes=[...$('modal-root').querySelectorAll('button')];if(!nodes.length)return;
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
function tick() {
  if(advance(S,now())){if(U.modal?.kind==='recall')U.modal=null;render();notify('伙伴按计划平安到家了，来收好行囊吧。');return;}
  const t=S.trip;if(t?.kind!=='expedition')return;
  const p=expeditionProgress(t,now());
  if($('countdown'))$('countdown').textContent=clockText(p.remaining);
  if($('travel-progress'))$('travel-progress').style.width=p.ratio*100+'%';
  if($('travel-collected'))$('travel-collected').textContent=`已走过 ${p.nodes} / ${t.fixedItems.length} 个收获节点`;
  t.fixedItems.forEach((_,i)=>{const el=$('milestone-'+i);if(el){el.classList.toggle('done',i<p.nodes);el.innerHTML=icon(i<p.nodes?'check':'sprout')+`<small>${Math.round(t.quote.minutes/t.fixedItems.length*(i+1))} 分</small>`;}});
}
setInterval(tick,1000);
globalThis.AdventurePrototype={dispatch,render,getState:()=>S,getUI:()=>U,tick};
render();
