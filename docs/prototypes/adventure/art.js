const ICON_PATHS={
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  backpack:'<rect x="5" y="5" width="14" height="17" rx="4"/><path d="M9 5V2h6v3M5 12h14M8 16h8m-4-4v3M2 10v8m20-8v8"/>',
  home:'<path d="m2 10 10-8 10 8M5 8v13h14V8M9 21v-8h6v8"/>',
  book:'<path d="M12 5C8 2 4 2 2 4v16c4-2 7-2 10 0 3-2 6-2 10 0V4c-4-2-7-2-10 1Zm0 0v15"/>',
  heart:'<path d="M20 4c-3-2-6-1-8 2C7-1-3 5 4 13l8 8 8-8c3-3 3-7 0-9Z"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
  energy:'<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  check:'<path d="m5 12 4 4L20 5"/>',
  lock:'<rect x="5" y="10" width="14" height="12" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  sprout:'<path d="M12 22V11C3 13 2 5 2 3c9-1 11 4 10 8Zm0 5c-1-9 5-12 10-11 1 7-3 11-10 11Z"/>',
  tree:'<path d="m12 2-7 8h3l-5 7h7v5h4v-5h7l-5-7h3l-7-8Z"/>',
  wind:'<path d="M2 8h13a3 3 0 1 0-3-3M2 12h18a3 3 0 1 1-3 3M2 17h7a3 3 0 1 1-3 3"/>',
  wave:'<path d="M2 7c4-6 6 6 10 0s6 6 10 0M2 13c4-6 6 6 10 0s6 6 10 0M2 19c4-6 6 6 10 0s6 6 10 0"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  flag:'<path d="M5 22V3c5-3 8 3 14 0v10c-6 3-9-3-14 0"/>',
  lens:'<circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/>',
  rope:'<path d="M16 20c-11 4-14-6-9-11 5-5 10-2 8 2-2 5-8 2-6-2 2-5 9-8 11-3 3 6-8 7-5 12l3 4"/>',
  food:'<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M8 5V2h8v3M3 13h18M10 5v16"/>',
  shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z"/>',
  sword:'<path d="m5 19 14-14 2-3-4 1L4 16m-2-3 9 9m-9 0 4-4"/>',
  chat:'<path d="M21 11a9 9 0 0 1-13 8l-6 3 2-6A9 9 0 1 1 21 11Z"/><path d="M7 10h10m-10 4h6"/>',
  hand:'<path d="M8 12V5a2 2 0 0 1 4 0v7-9a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 9-11 9-14 3l-4-6c-1-2 2-4 4-1l2 1Z"/>',
  close:'<path d="m5 5 14 14M5 19 19 5"/>',
  refresh:'<path d="M20 8a8 8 0 1 0 0 8M20 2v6h-6"/>',
  hammer:'<path d="m3 21 12-12m-6-6 5-2 8 8-4 4-4-4-3 1-2-7Z"/>',
  flower:'<path d="M12 17v6m0-3c3-5 6-4 7-3m-7 3c-3-5-6-4-7-3"/><circle cx="12" cy="9" r="3"/><path d="M9 5c-3-7 9-7 6 0 7-3 7 9 0 6 3 7-9 7-6 0-7 3-7-9 0-6Z"/>',
  ticket:'<path d="M3 5h18v5c-4 0-4 4 0 4v5H3v-5c4 0 4-4 0-4V5Zm12 0v3m0 3v2m0 3v3"/>',
};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]||ICON_PATHS.compass}</svg>`;
function landscape(r,view='map',repair=0) {
  const forest=r.id==='forest',coast=r.id==='coast',station=r.id==='station',hills=r.id==='hills';
  const trees=Array.from({length:forest?23:12},(_,i)=>{const x=45+(i*127)%920,y=170+(i*79)%390,scale=.5+(i%3)*.18;return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cx="0" cy="35" rx="36" ry="12" fill="#45664c" opacity=".1"/><path d="M0-22V38" stroke="#8d8261" stroke-width="10" stroke-linecap="round"/>${forest?'<path d="M0-100-45-18h20l-35 40H60L25-18h20Z" fill="#688e77"/><path d="M0-100-10 22H60L25-18h20Z" fill="#557e6b" opacity=".5"/>':'<ellipse cy="-24" rx="43" ry="46" fill="#86aa70"/><ellipse cx="-18" cy="-37" rx="24" ry="30" fill="#a2bd84"/><ellipse cx="22" cy="-20" rx="24" ry="34" fill="#739861"/>'}</g>`;}).join('');
  const building=hills?'<path d="m-52 90 22-140h60L52 90Z" fill="#fff0cc" stroke="#c7a16a" stroke-width="4"/><path d="m-50-40 50-38 50 38Z" fill="#b57959"/><path d="M0-16V-104m0 88 80 44M0-16l-80 44" stroke="#a17b51" stroke-width="10"/><path d="M10-30 35-90M10-5l57 50M-18-12-79-5" stroke="#fff4d9" stroke-width="23"/><circle cy="-16" r="13" fill="#d6ae71"/><path d="M-12 90V53a12 12 0 0 1 24 0v37" fill="#9c8c6d"/>':station?'<path d="M-85 14a85 85 0 0 1 170 0" fill="#c6c8e4" stroke="#797c9a" stroke-width="5"/><path d="M-72 10v78H72V10Z" fill="#e8e3ec" stroke="#9696ac" stroke-width="4"/><path d="M-10-70v80M-45-54-20 9" stroke="#9297b6" stroke-width="5"/><rect x="-16" y="41" width="32" height="47" rx="3" fill="#8d91af"/><path d="M-99 12H99" stroke="#686f91" stroke-width="8"/><path d="M52-41 96-71" stroke="#7b83a8" stroke-width="16"/>':forest?'<rect x="-75" y="2" width="150" height="86" rx="4" fill="#c3a481"/><path d="m-98 5 98-83 98 83Z" fill="#63877a" stroke="#4b6f62" stroke-width="5"/><path d="M-62 25h30v30h-30Zm95 0h30v30H33Z" fill="#f8dc9b"/><rect x="-14" y="32" width="31" height="56" rx="4" fill="#8c775f"/><path d="M-35 89h70m-79 12h88m-98 12h108" stroke="#a68e73" stroke-width="8"/>':coast?'<path d="M-85 4H85V90H-85Z" fill="#e7dfbd"/><path d="m-106 7 26-56H64L106 7Z" fill="#7197a5"/><path d="M-67 30h37v32h-37ZM30 30h37v32H30Z" fill="#d1e8e7" stroke="#9cbcc0" stroke-width="5"/><rect x="-16" y="27" width="32" height="64" fill="#a8aa91"/><path d="M-104 98h215m-193-5v44m166-44v44" stroke="#b6a486" stroke-width="11"/>':'<path d="M-91 4 0-68 91 4v90H-91Z" fill="#d7e8d7" fill-opacity=".88" stroke="#829c80" stroke-width="6"/><path d="m-91 4 91-72L91 4Zm0 0H91M0-68V93M-47-32V93M47-32V93M-90 50H91" fill="none" stroke="#94ab86" stroke-width="4"/><path d="M-15 48h30v46h-30" fill="#a0b994" stroke="#718d72" stroke-width="3"/><path d="m-72 17 20-23m-11 33 20-22M35 6l15-18" stroke="#f6fff3" stroke-width="7" opacity=".8"/><path d="M-84 85q8-42 21 0m89 0q15-53 28 0m-123 0h136" stroke="#789962" stroke-width="7" fill="none"/>';
  const flowers=Array.from({length:25},(_,i)=>`<g transform="translate(${50+(i*173)%900} ${245+(i*97)%320})"><path d="M0 0v12m0-5 5-4" stroke="#7b9c68" stroke-width="2"/><circle r="4" fill="${['#fff6cf','#eec8ac','#f7e9df'][i%3]}"/></g>`).join('');
  const stars=station?Array.from({length:20},(_,i)=>`<path d="m${35+i*47} ${30+(i*31)%140}v8m-4-4h8" stroke="#fffdf2" stroke-width="2" opacity=".85"/>`).join(''):'';
  const large=view!=='map';
  return `<svg class="landscape" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sky-${view}" x2="0" y2="1"><stop stop-color="${r.sky}"/><stop offset="1" stop-color="${r.pale}"/></linearGradient></defs><rect width="1000" height="650" fill="url(#sky-${view})"/><circle cx="815" cy="85" r="34" fill="#fff7d5" opacity=".9"/>${stars}<g fill="#fff" opacity=".6"><path d="M102 97c-25-37 24-54 39-33 18-39 68-7 52 16 32-9 43 22 22 27H106Z"/><path d="M620 82c-21-29 18-50 39-25 13-29 56-12 46 16 31-5 32 28 2 23h-89Z"/></g><path d="M-40 295Q145 55 381 223T720 194T1055 231V650H-40Z" fill="${r.land}" opacity=".45"/><path d="M-50 374Q183 145 403 312T735 283T1070 317V680H-50Z" fill="${r.land}"/><path d="M-80 547Q179 395 478 490T1070 412V680H-80Z" fill="${coast?'#e9dfbb':r.pale}" opacity=".55"/>${coast?'<path d="M-20 433Q390 300 630 470T1050 400V700H-20Z" fill="#a2d5de"/><path d="M-20 470Q390 337 630 507T1050 437" fill="none" stroke="#eaf8f0" stroke-width="9"/>':!station?'<path d="M430 170C297 220 543 274 420 326S428 400 572 440 510 535 780 660" fill="none" stroke="#cfe5d2" stroke-width="68"/><path d="M430 170C297 220 543 274 420 326S428 400 572 440 510 535 780 660" fill="none" stroke="#acd4ca" stroke-width="48"/><path d="m457 352 16 3m45 79 19 5m51 59 26 1m-87-270 14 1" stroke="#eff9e7" stroke-width="4" stroke-linecap="round"/>':''}${trees}${flowers}<g transform="translate(${large?580:724} ${large?290:222}) scale(${large?1.65:.77})"><ellipse cy="95" rx="110" ry="22" fill="#45664c" opacity=".13"/>${building}${repair>=1?'<path d="m-107 4 17-24H95l16 24" fill="#a57654"/><path d="M-104 5H108" stroke="#795e49" stroke-width="5"/>':''}${repair>=2?'<g transform="translate(-145 100)"><path d="M-40 0H40m-32 0-9 34m47-34 9 34M-42 24H42" stroke="#967150" stroke-width="8"/><path d="M-33-5h65v12h-65Z" fill="#f7ddba"/><path d="M0-5v-16" stroke="#7d9d6c" stroke-width="3"/><circle cy="-22" r="8" fill="#edc780"/></g>':''}</g><g fill="#7f9880" opacity=".5"><ellipse cx="198" cy="541" rx="23" ry="8"/><ellipse cx="860" cy="560" rx="33" ry="12"/></g></svg>`;
}
const NODE_POS={start:[14,78],gather:[22,53],ridge:[41,73],bridge:[45,43],lookout:[61,62],story:[73,27],camp:[85,50],battle:[53,19]};
function routeLines() {
  const routes=Object.entries(EDGES);
  if(S.trip?.kind==='explore'&&S.trip.shortcut)routes.push(['gather',['story']],['ridge',['story']]);
  return `<svg class="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${routes.flatMap(([from,tos])=>tos.map(to=>`<line x1="${NODE_POS[from][0]}" y1="${NODE_POS[from][1]}" x2="${NODE_POS[to][0]}" y2="${NODE_POS[to][1]}"/>`)).join('')}</svg>`;
}
