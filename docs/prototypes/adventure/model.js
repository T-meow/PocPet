'use strict';
// Isolated, in-memory prototype. These amounts are design candidates, not live game rules.
const REGIONS = [
  { id:'valley', name:'溪谷', subtitle:'雨停了，一起去溪边走走', tag:'溪流 · 旧温室', color:'#39745d', pale:'#e8f1df', sky:'#e2f1ec', land:'#bfd4a0', icon:'sprout', base:'温室休息间', items:['野果','蘑菇','纪念种子'], uses:['带回厨房，做一份水果料理','溪谷汤类的食材线索','放在温室的旅行展示架'], landmarks:['溪谷入口','溪边采集地','青苔坡道','旧木桥','风声观景台','旧温室','温室休息间','石芽守卫'], story:'让旧温室重新亮起来', clue:'沿着水渠，找找温室留下的记号。', repair:['修好漏雨的屋顶','添一张野餐桌'], findings:['雨滴在旧叶片上闪光','一只蜗牛慢慢爬过路牌','水面倒映着温室的屋顶','溪边发现一片心形叶子'], neighbor:'我在桥下看见一个旧箱子。下次带上绳索，一起去看看吧。' },
  { id:'hills', name:'风车山丘', subtitle:'追着风，去花田的另一头', tag:'风车 · 花田', color:'#99702f', pale:'#fbf1d7', sky:'#f8eedb', land:'#dfd29b', icon:'wind', base:'避风小营地', items:['蜂蜜','香草','花卉纪念品'], uses:['烘焙和甜饮的配料','调制一杯清新的饮品','挂在营地的风铃旁'], landmarks:['山丘路口','香草花田','风向坡道','风车木栈桥','金色瞭望台','老风车','避风小营地','风团守卫'], story:'让老风车再转一圈', clue:'花田里的风向，藏着风车停下的原因。', repair:['搭起遮阳棚','挂上风铃'], findings:['风车影子慢慢扫过花田','找到一株带着露水的香草','远处的风铃唱了起来','一只蜜蜂停在行囊上'], neighbor:'风铃响起的时候，花田里会出现一条小路。' },
  { id:'forest', name:'雾松林地', subtitle:'放轻脚步，听森林说话', tag:'古树 · 足迹', color:'#497267', pale:'#e1eee6', sky:'#dce8e8', land:'#9ebcab', icon:'tree', base:'林间守望小屋', items:['松子','林莓','树脂'], uses:['烤一份坚果小点心','做成果酱带回家','用于小屋修复和装饰'], landmarks:['松林入口','林莓丛','足迹小径','古树栈道','树梢观察台','空心古树','林间守望小屋','苔石守卫'], story:'跟着足迹找到古树', clue:'树根旁的脚印，通往一处安静的空地。', repair:['修好木台阶','布置标本架'], findings:['雾气在树根间绕了一圈','松鼠把松果藏进了树洞','柔软的苔藓上留下了足迹','林间透下一束细细的光'], neighbor:'古树后面有几枚新脚印，记在手账上再去找找吧。' },
  { id:'coast', name:'潮汐海岸', subtitle:'把海风和浪花装进行囊', tag:'潮汐洞穴 · 漂流物', color:'#387b91', pale:'#e0f1f5', sky:'#dbedf5', land:'#d8d4ad', icon:'wave', base:'海边旧船屋', items:['海藻','贝类','海玻璃'], uses:['尝试一份海滨料理','带回厨房作为海味食材','制作船屋灯饰与收藏'], landmarks:['沙滩入口','潮池','贝壳坡道','旧栈桥','听浪观景台','潮汐洞穴','海边旧船屋','贝壳守卫'], story:'寻找潮水留下的信', clue:'低处的浪花，正让出通向洞穴的小路。', repair:['修缮木栈桥','点亮贝壳灯'], findings:['浪花推来一颗蓝色海玻璃','潮池里藏着小小的寄居蟹','海鸥陪我们走了一段路','一封没有署名的信漂到了岸边'], neighbor:'退潮后，栈桥旁多了一只漂来的小瓶子。' },
  { id:'station', name:'旧观测站', subtitle:'今晚，让星星做我们的路标', tag:'星象 · 观测遗迹', color:'#686c9a', pale:'#eceafa', sky:'#dfe3f4', land:'#a8b6c5', icon:'star', base:'观测站值班室', items:['星图页','旧徽章','观测零件'], uses:['补全旅行图鉴的星象页','留在基地作为纪念展示','修复观测桌与照明'], landmarks:['山顶入口','碎片采集地','符号坡道','悬空连桥','星空观景台','旧观测穹顶','观测站值班室','星石守卫'], story:'为夜空重新打开穹顶', clue:'把零散符号连在一起，找到穹顶的开关。', repair:['恢复值班室照明','整理观测桌'], findings:['找到一张画着流星的旧星图','穹顶缝隙里透出一颗亮星','旧仪器仍指向同一片夜空','在值班室发现了一句晚安'], neighbor:'把星图放到窗前，试试对齐天上的那三颗星。' },
];
const NODE_IDS=['start','gather','ridge','bridge','lookout','story','camp','battle'];
const EDGES={start:['gather','ridge'],gather:['bridge'],ridge:['bridge'],bridge:['lookout','story'],lookout:['story'],story:['camp','battle'],battle:['camp'],camp:[]};
const DURATIONS={30:{parts:1,coins:20,energy:4,hearts:16},120:{parts:3,coins:60,energy:8,hearts:48},360:{parts:7,coins:150,energy:14,hearts:120}};
const clone=value=>JSON.parse(JSON.stringify(value));
const regionById=id=>REGIONS.find(r=>r.id===id);
const nodeName=(region,node)=>regionById(region).landmarks[NODE_IDS.indexOf(node)];
const scaledHearts=(base,level)=>Math.round(base*(1+0.05*(level-1)));
function createState(preset='challenge') {
  const experienced=preset==='roam';
  return {preset,level:preset==='new'?8:experienced?30:12,role:'furo',coins:2400,hearts:360,energy:100,meals:6,inventory:{},trip:null,pending:null,logs:[],memories:[],
    regions:Object.fromEntries(REGIONS.map((r,i)=>[r.id,{unlocked:i===0||experienced,landmarks:[],products:[],findings:[],trips:0,explorations:0,base:experienced,repair:0,story:false,battle:false,shortcut:false,tools:[],neighborMet:false}]))};
}
function unlockRegions(s) {
  REGIONS.slice(1).forEach((r,i)=>{const prev=s.regions[REGIONS[i].id];if(prev.landmarks.length>=3||prev.trips>=3)s.regions[r.id].unlocked=true;});
}
function expeditionQuote(s,minutes,meal=false) {
  const d=DURATIONS[minutes];
  return {...d,minutes,energy:d.energy-(meal?2:0),hearts:scaledHearts(d.hearts,s.level),fixedCoins:10,fixedEnergy:2};
}
function startExploration(s,{region,tool='rope',meal=false}) {
  if(s.trip||s.pending||!s.regions[region]?.unlocked||!['rope','lens'].includes(tool)||s.coins<60||s.energy<8||(meal&&s.meals<1))return false;
  s.coins-=60;s.energy-=8;if(meal)s.meals--;
  s.trip={kind:'explore',region,role:s.role,level:s.level,tool,meal,mealUsed:false,node:'start',resolved:true,steps:7,visited:['start'],items:{},coins:0,hearts:0,complete:false,battleWon:false,challengePaid:false,battle:null,history:['从路口出发，今天也慢慢走。'],shortcut:s.regions[region].shortcut};
  return true;
}
function availableNodes(s) {
  const t=s.trip;if(!t||t.kind!=='explore'||!t.resolved||t.battle||t.steps<=0)return [];
  const routes=[...(EDGES[t.node]||[])];
  if(t.shortcut&&['gather','ridge'].includes(t.node))routes.push('story');
  return routes.filter(n=>!t.visited.includes(n)&&(n!=='battle'||t.level>=12));
}
function moveTo(s,node) {
  if(!availableNodes(s).includes(node))return false;
  const t=s.trip;t.node=node;t.steps--;t.visited.push(node);t.resolved=false;
  return true;
}
function addItem(t,id,n=1){t.items[id]=(t.items[id]||0)+n;}
function discover(s,t) {
  const p=s.regions[t.region];
  if(!['start','battle'].includes(t.node)&&!p.landmarks.includes(t.node))p.landmarks.push(t.node);
  unlockRegions(s);
}
function nodeChoices(s) {
  const t=s.trip;if(!t||t.kind!=='explore'||t.resolved||t.battle)return [];
  const region=regionById(t.region);
  const option=(id,label,hint,disabled=false)=>({id,label,hint,disabled});
  switch(t.node){
    case 'gather':return [option('gather',`采集${region.items[0]}`,`${region.items[0]} ×2，沿路继续`),option('inspect','用放大镜仔细看看',`${region.items[1]} ×2，发现侧门标记`,t.tool!=='lens')];
    case 'ridge':return [option('observe','记下高处的路标','发现地标，找到 30 金币'),option('inspect','用放大镜辨认小字','发现地标与侧门标记，找到 30 金币',t.tool!=='lens')];
    case 'bridge':return [option('rope','系好绳索通过','不额外消耗步数，记录绳索的用法',t.tool!=='rope'),option('wade','从浅处慢慢绕行','额外消耗 1 步，两条路都可以继续',t.steps<1)];
    case 'lookout':return [option('landscape','把这一刻画在手账里','记录观景地标，找到 35 金币')];
    case 'story':return [option('solve',t.region==='valley'?'沿着水渠打开进水阀':'顺着标记接通机关','完成地区线索，开放基地，获得纪念物'),option('hint','和伙伴一起找提示','先看提示，再决定怎么做')];
    case 'camp':return [option('rest','在这里歇一会儿','记录基地地标，完成这一趟探索')];
    case 'battle':return [option('challenge','准备好，开始挑战','支付 30 金币；独立耐力，敌人提前显示意图',s.coins<30),option('skip','沿着小路去休息间','跳过挑战，普通探索收获仍然保留')];
    default:return [];
  }
}
function resolveNode(s,choice) {
  const opt=nodeChoices(s).find(c=>c.id===choice);if(!opt||opt.disabled)return false;
  const t=s.trip,p=s.regions[t.region],r=regionById(t.region);
  if(choice==='hint'){t.history.push(t.region==='valley'?'伙伴指了指地上的水痕：「水是从这里流过来的。」':'伙伴指了指相同的标记：「把它们连起来试试。」');return true;}
  if(choice==='challenge'){
    s.coins-=30;t.challengePaid=true;
    t.battle={hp:30+Math.floor((t.level-12)*0.6),maxHp:30+Math.floor((t.level-12)*0.6),foeHp:36,maxFoeHp:36,round:1,skillUsed:false,guarded:false};return true;
  }
  if(choice==='gather')addItem(t,r.items[0],2);
  if(choice==='inspect'){
    t.shortcut=true;p.shortcut=true;if(!p.tools.includes('lens'))p.tools.push('lens');
    if(t.node==='gather')addItem(t,r.items[1],2);else t.coins+=30;
  }
  if(choice==='observe')t.coins+=30;
  if(choice==='rope'&&!p.tools.includes('rope'))p.tools.push('rope');
  if(choice==='wade')t.steps--;
  if(choice==='landscape')t.coins+=35;
  if(choice==='solve'){
    t.complete=true;t.coins+=80;
    if(!p.story){p.story=true;addItem(t,r.items[2]);s.memories.unshift({region:t.region,title:r.story,body:`和 ${t.role==='furo'?'Furo':t.role==='doro'?'Doro':'mint'} 一起，顺着记号找到了答案。`,kind:'story'});}
    else addItem(t,r.items[0]);
    p.base=true;
  }
  if(choice==='rest')t.complete=true;
  t.resolved=true;t.history.push(`${nodeName(t.region,t.node)} · ${opt.label}`);discover(s,t);return true;
}
function eatMeal(s) {
  const t=s.trip;if(!t||t.kind!=='explore'||!t.meal||t.mealUsed||t.battle)return false;
  t.mealUsed=true;t.steps+=2;t.history.push('分着吃完便当，又有力气多走两步了。');return true;
}
function battleIntent(b){return b.round%2===1?{label:'蓄力撞击',damage:14,tip:'这回合适合防守，下一回合再出手。'}:{label:'轻轻试探',damage:4,tip:'攻击较轻，可以抓住机会使用能力。'};}
function battleAction(s,action) {
  const t=s.trip,b=t?.battle;if(!b||!['attack','guard','skill','retreat'].includes(action)||(action==='skill'&&b.skillUsed))return false;
  if(action==='retreat'){t.battle=null;t.resolved=true;t.history.push('暂时退出挑战，已经发现的东西都在行囊里。');return true;}
  const intent=battleIntent(b),power=12+Math.floor((t.level-12)/4);
  if(action==='attack')b.foeHp=Math.max(0,b.foeHp-power);
  if(action==='skill'){b.foeHp=Math.max(0,b.foeHp-power-12);b.skillUsed=true;}
  if(action==='guard')b.guarded=true;
  if(b.foeHp===0){t.battleWon=true;t.battle=null;t.resolved=true;t.coins+=45;t.history.push('挑战成功！带上守卫留下的 45 金币，去休息间坐坐吧。');return true;}
  b.hp=Math.max(0,b.hp-(action==='guard'?Math.ceil(intent.damage*0.2):intent.damage));b.round++;
  if(b.hp===0){t.battle=null;t.resolved=true;t.history.push('这次先休息一下。普通探索的发现和收获都保留了。');}
  return true;
}
function finishExploration(s) {
  const t=s.trip;if(!t||t.kind!=='explore')return false;
  if(t.meal&&!t.mealUsed)s.meals++;
  s.pending={kind:'explore',region:t.region,role:t.role,complete:t.complete,items:clone(t.items),coins:t.coins,hearts:t.complete?scaledHearts(t.battleWon?60:40,t.level):0,battleWon:t.battleWon,history:clone(t.history),refundCoins:0,refundEnergy:0,mealReturned:t.meal&&!t.mealUsed,minutes:0,findings:[]};
  s.trip=null;return true;
}
function startExpedition(s,{region,minutes=30,goal='gather',tool='rope',meal=false,route='standard'},now) {
  if(s.trip||s.pending||!s.regions[region]?.unlocked||!DURATIONS[minutes]||!['gather','sightsee','challenge'].includes(goal)||!['rope','lens'].includes(tool)||!['standard','shortcut'].includes(route)||(route==='shortcut'&&!s.regions[region].shortcut)||(goal==='challenge'&&(!s.regions[region].battle||s.level<12)))return false;
  const q=expeditionQuote(s,minutes,meal);if(s.coins<q.coins||s.energy<q.energy||(meal&&s.meals<1))return false;
  s.coins-=q.coins;s.energy-=q.energy;if(meal)s.meals--;
  const r=regionById(region),p=s.regions[region];
  const fixedItems=Array.from({length:q.parts},(_,i)=>r.items[route==='shortcut'?1:goal==='sightsee'?0:(p.trips+i+(tool==='lens'?1:0))%2]);
  const finding=goal==='sightsee'?r.findings.find(f=>!p.findings.includes(f)):r.findings[p.trips%r.findings.length];
  s.trip={kind:'expedition',region,role:s.role,level:s.level,goal,tool,meal,route,start:now,end:now+minutes*60000,quote:q,fixedItems,finding,coins:Math.round(q.coins*1.6),companionLine:'出发啦。等回来，一起翻翻今天的手账。'};return true;
}
function expeditionProgress(t,now) {
  const ratio=Math.max(0,Math.min(1,(now-t.start)/(t.end-t.start)));
  return {ratio,nodes:Math.min(t.fixedItems.length,Math.floor(ratio*t.fixedItems.length)),remaining:Math.max(0,t.end-now)};
}
function recallPreview(s,now) {
  const t=s.trip;if(!t||t.kind!=='expedition')return null;
  const p=expeditionProgress(t,now),complete=p.ratio>=1;
  return {...p,complete,refundCoins:complete?0:Math.floor((t.quote.coins-t.quote.fixedCoins)*(1-p.ratio)),refundEnergy:complete?0:Math.floor((t.quote.energy-t.quote.fixedEnergy)*(1-p.ratio))};
}
function finishExpedition(s,now) {
  const t=s.trip;if(!t||t.kind!=='expedition')return false;
  const p=recallPreview(s,now),items={};t.fixedItems.slice(0,p.nodes).forEach(id=>items[id]=(items[id]||0)+1);
  s.pending={kind:'expedition',region:t.region,role:t.role,complete:p.complete,items,coins:p.complete?t.coins:Math.floor(t.coins*p.nodes/t.fixedItems.length),hearts:p.complete?t.quote.hearts:0,battleWon:false,refundCoins:p.refundCoins,refundEnergy:p.refundEnergy,mealReturned:false,minutes:p.complete?t.quote.minutes:0,plannedMinutes:t.quote.minutes,findings:p.complete&&t.finding?[t.finding]:[],history:[p.complete?'伙伴按计划平安到家了。':'提前回家，沿路已经采到的物品都带回来了。']};
  s.trip=null;return true;
}
function advance(s,now){if(s.trip?.kind==='expedition'&&now>=s.trip.end)return finishExpedition(s,now);return false;}
function claimResult(s) {
  const t=s.pending;if(!t)return false;const p=s.regions[t.region];
  s.coins+=t.coins+t.refundCoins;s.hearts+=t.hearts;s.energy=Math.min(100,s.energy+t.refundEnergy);
  Object.entries(t.items).forEach(([id,n])=>{s.inventory[id]=(s.inventory[id]||0)+n;if(!p.products.includes(id))p.products.push(id);});
  t.findings.forEach(f=>{if(!p.findings.includes(f))p.findings.push(f);});
  if(t.complete){if(t.kind==='explore')p.explorations++;else p.trips++;}
  if(t.battleWon)p.battle=true;
  s.logs.unshift({...clone(t),title:`${regionById(t.region).name} · ${t.kind==='explore'?'亲自探索':'远行'}${t.complete?'归来':'提前返回'}`});s.logs=s.logs.slice(0,20);
  s.pending=null;unlockRegions(s);return true;
}
function repairBase(s,region) {
  const p=s.regions[region];if(s.trip||!p?.base||p.repair>=2)return false;
  const cost=[180,260][p.repair];if(s.coins<cost)return false;
  s.coins-=cost;p.repair++;
  s.memories.unshift({region,title:regionById(region).repair[p.repair-1],body:'在旅途中熟悉的地方，又多了一点家的样子。',kind:'base'});return true;
}
function meetNeighbor(s,region) {
  const p=s.regions[region];if(s.trip||!p?.base||p.neighborMet)return false;
  p.neighborMet=true;p.neighborRole=s.role==='doro'?'mint':'doro';s.memories.unshift({region,title:'屋檐下的见面',body:regionById(region).neighbor,kind:'neighbor',role:p.neighborRole});return true;
}
globalThis.AdventureModel={REGIONS,NODE_IDS,EDGES,DURATIONS,createState,regionById,nodeName,scaledHearts,startExploration,availableNodes,moveTo,nodeChoices,resolveNode,eatMeal,battleIntent,battleAction,finishExploration,expeditionQuote,startExpedition,expeditionProgress,recallPreview,finishExpedition,advance,claimResult,repairBase,meetNeighbor};
