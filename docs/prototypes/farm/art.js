var FarmArt = (() => {
  const paths = {
    leaf: '<path d="M20 4c0 10-3 16-10 16a6 6 0 0 1-6-6C4 7 10 4 20 4Z"/><path d="m4 20 10-10"/>',
    farm: '<path d="m3 11 9-7 9 7v10H3V11Z"/><path d="M9 21v-8h6v8M1 11l11-9 11 9"/>',
    stall: '<path d="M4 11v10h16V11M9 21v-6h6v6M3 3h18l1 7a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-2l1-7Z"/>',
    box: '<path d="m3 7 9-4 9 4v13l-9 3-9-3V7Zm0 0 9 4 9-4M12 11v12M7 5l10 5"/>',
    guild: '<path d="m3 8 9-6 9 6H3ZM4 21h16M6 10v8m6-8v8m6-8v8M2 18h20"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 7h-4a3 3 0 0 0 0 6h2a2 2 0 0 1 0 4H9m3-12v14"/>',
    heart: '<path d="M12 21 3 12C-2 5 7-1 12 6c5-7 14-1 9 6l-9 9Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    water: '<path d="M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
    moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
    reset: '<path d="M3 4v6h6M3 10a9 9 0 1 1 1 8"/>',
    book: '<path d="M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-1-6-2-10 1v15"/>',
    pot: '<path d="M4 10h16v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-7Zm-3 2h3m16 0h3M8 7V3m4 4V1m4 6V3"/>',
  };
  const icon = (id, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.leaf}</svg>`;
  const defs = `<defs>
    <linearGradient id="ground" x2="0" y2="1"><stop stop-color="#dfebcf"/><stop offset="1" stop-color="#c3d7ad"/></linearGradient>
    <pattern id="grass" width="62" height="53" patternUnits="userSpaceOnUse"><path d="m14 19-2-5m2 5 3-4m31 23-2-5m2 5 3-3" stroke="#a9bf94" stroke-width="1.7" fill="none" opacity=".6"/></pattern>
    <pattern id="soil" width="45" height="25" patternUnits="userSpaceOnUse"><path d="M0 22h45" stroke="#aa7d58" stroke-width="2" opacity=".5"/></pattern>
    <symbol id="tree" viewBox="0 0 100 130"><ellipse cx="50" cy="116" rx="42" ry="11" fill="#738c65" opacity=".15"/><path d="M50 72v45m0-26-19-17m19 25 17-19" stroke="#957054" stroke-width="10" stroke-linecap="round"/><path d="M18 79C-1 62 8 37 27 33c-1-28 40-36 51-9 26 3 27 38 11 47 2 27-31 30-42 22-15 9-28 0-29-14Z" fill="#729560"/><path d="M20 66c-13-21 5-32 18-35 7-21 36-21 43-2 22 12 12 39-8 40-12 18-34 16-53-3Z" fill="#8cae70"/><circle cx="30" cy="53" r="7" fill="#d58658"/><circle cx="67" cy="71" r="7" fill="#d58658"/><circle cx="64" cy="33" r="6" fill="#dca36b"/></symbol>
    <symbol id="chick" viewBox="0 0 55 55"><ellipse cx="27" cy="45" rx="19" ry="5" fill="#809565" opacity=".2"/><path d="m21 41-2 6m13-6 3 6" stroke="#b77e43" stroke-width="3"/><ellipse cx="26" cy="30" rx="17" ry="14" fill="#fff9dd"/><circle cx="35" cy="17" r="11" fill="#fff9dd"/><path d="m35 6-2-4 6 1 2 5" fill="#c97657"/><path d="m45 16 7 4-8 2" fill="#d3a24b"/><circle cx="38" cy="16" r="2" fill="#494c39"/><path d="M17 28q10-7 14 4" fill="none" stroke="#e2d7ad" stroke-width="2"/></symbol>
    <symbol id="cow" viewBox="0 0 130 90"><ellipse cx="65" cy="77" rx="53" ry="10" fill="#79966b" opacity=".2"/><path d="m30 56-2 20m40-20 4 20m22-25 4 25" stroke="#f6eee0" stroke-width="10" stroke-linecap="round"/><rect x="19" y="18" width="81" height="46" rx="22" fill="#fff9e9"/><path d="M30 19q27-3 30 14t-24 16q-17-5-6-30m47 7q18-12 22 9-7 12-18 8Z" fill="#6d6b57"/><path d="m24 35-12-8-4 8" stroke="#827d61" stroke-width="4" fill="none"/><ellipse cx="101" cy="27" rx="18" ry="23" fill="#fff9e9"/><path d="m86 12-7-8m32 8 8-8" stroke="#c0aa7d" stroke-width="5" stroke-linecap="round"/><ellipse cx="102" cy="43" rx="17" ry="10" fill="#e6b6a0"/><circle cx="94" cy="26" r="2.5" fill="#4e5343"/><circle cx="109" cy="26" r="2.5" fill="#4e5343"/><path d="m95 43 1 1m10-1 1 1" stroke="#b07e6d" stroke-width="3" stroke-linecap="round"/></symbol>
    <symbol id="sprout" viewBox="0 0 40 40"><path d="M20 35V15" stroke="#72854e" stroke-width="3"/><path d="M20 25C5 27 3 14 5 10c12-1 16 7 15 15m0-6C20 7 28 4 36 8c-1 11-8 15-16 11Z" fill="#709351"/></symbol>
    <symbol id="stall" viewBox="0 0 250 185"><ellipse cx="123" cy="171" rx="117" ry="12" fill="#5b7355" opacity=".17"/><path d="M31 60v110m188-110v110" stroke="#947350" stroke-width="10"/><path d="M40 4h173l24 57H16L40 4Z" fill="#f8edce"/><path d="m67 4-9 57H16L40 4h27Zm57 0v57H81l6-57h37Zm48 0 10 57h-38l-2-57h30Zm41 0 24 57h-35L190 4h23Z" fill="#849a65"/><path d="M16 60v13q19 18 37 0 19 18 38 0 18 18 36 0 18 18 36 0 18 18 36 0 19 18 38 0V60" fill="#698551"/><rect x="23" y="115" width="202" height="51" rx="5" fill="#b49161"/><path d="M25 129h198m-155-11v43m55-43v43m55-43v43" stroke="#95774f" stroke-width="2"/><rect x="35" y="90" width="52" height="28" rx="4" fill="#c7a16c"/><circle cx="50" cy="95" r="10" fill="#c67e54"/><circle cx="71" cy="94" r="10" fill="#d4965f"/><rect x="95" y="94" width="54" height="23" rx="3" fill="#c7a16c"/><ellipse cx="108" cy="97" rx="7" ry="10" fill="#fff3d7"/><ellipse cx="125" cy="97" rx="7" ry="10" fill="#fff3d7"/><path d="M163 114V83h12v-9h12v9h11v31" fill="#f6f1de"/><rect x="161" y="96" width="39" height="15" rx="3" fill="#aec0a4"/></symbol>
  </defs>`;
  function farm() {
    return `<svg class="farm-drawing" viewBox="0 0 960 560" aria-hidden="true">${defs}
      <rect width="960" height="560" fill="url(#ground)"/><rect width="960" height="560" fill="url(#grass)"/>
      <path d="M-30 80Q90 30 208 76T450 75 686 60 990 85V-10H-10Z" fill="#adc59e"/>
      <path d="M-30 48Q70 9 149 46T306 33 493 27 729 25 990 42V-10H-10Z" fill="#94b58f"/>
      <path d="M425 570q19-74-38-122t-56-83q0-42 92-39t99-58q-8-48 6-89" fill="none" stroke="#b8b594" stroke-width="59" opacity=".23"/>
      <path d="M425 570q19-74-38-122t-56-83q0-42 92-39t99-58q-8-48 6-89" fill="none" stroke="#ebdbb9" stroke-width="49"/>
      <path d="M338 371Q218 377 181 301M426 325q228 19 309-16M491 296q90-30 130-131" fill="none" stroke="#ebdbb9" stroke-width="37"/>
      <path d="M32 405q37-54 109-31t79 87q-28 61-111 42t-77-98Z" fill="#b2caaa"/>
      <path d="M42 411q42-43 99-20t59 65q-16 41-83 33t-75-78Z" fill="#95bfb7"/>
      <path d="M73 428h36m27 29h38m-88 16h27" stroke="#cee1cd" stroke-width="3" stroke-linecap="round"/>
      <g transform="translate(71 74)"><rect x="0" y="25" width="276" height="216" rx="40" fill="#bccd9e"/>
        <use href="#tree" x="9" y="0" width="105" height="133"/><use href="#tree" x="106" y="-10" width="105" height="133"/><use href="#tree" x="183" y="48" width="105" height="133"/><use href="#tree" x="45" y="92" width="95" height="122"/>
        <ellipse cx="169" cy="197" rx="30" ry="13" fill="#bdac80"/><path d="m161 194 8-10 8 10" fill="none" stroke="#8d9768" stroke-width="3"/></g>
      <g transform="translate(427 86)"><ellipse cx="85" cy="109" rx="94" ry="19" fill="#7f9970" opacity=".18"/><rect x="12" y="38" width="145" height="85" rx="5" fill="#ddc099"/><path d="m-3 42 83-54 92 54" fill="#b97655"/><path d="m-4 42 85-56 94 56" fill="none" stroke="#94694f" stroke-width="7" stroke-linecap="round"/><rect x="68" y="72" width="40" height="51" rx="20" fill="#876d4e"/><rect x="28" y="64" width="23" height="26" rx="3" fill="#b2bda0"/><path d="M39 64v26m-11-13h23" stroke="#f7e6c5" stroke-width="3"/><path d="m60 125-14 26h75l-17-26" fill="#ae8c62"/><path d="M56 138h59" stroke="#d5b383" stroke-width="3"/>
        <use href="#chick" x="128" y="132" width="44" height="44"/><use href="#chick" x="17" y="128" width="45" height="45"/></g>
      <g transform="translate(699 74)"><ellipse cx="103" cy="132" rx="116" ry="24" fill="#7f9970" opacity=".18"/><rect x="8" y="43" width="189" height="115" rx="4" fill="#c39a78"/><path d="M-8 47 52-8h101l62 55" fill="#81918b"/><path d="M-8 47 52-8h101l62 55" stroke="#687b72" stroke-width="6" fill="none" stroke-linejoin="round"/><rect x="65" y="65" width="73" height="93" rx="2" fill="#7a6951"/><path d="M66 65h72m-35 0v92M67 66l69 90m0-90-69 90" stroke="#dfc3a0" stroke-width="5"/><rect x="21" y="67" width="28" height="31" fill="#d6d8b7"/><rect x="153" y="67" width="28" height="31" fill="#d6d8b7"/>
        <use href="#cow" x="42" y="154" width="141" height="98"/></g>
      <g transform="translate(539 362) rotate(-6)"><rect width="210" height="120" rx="15" fill="#bb936b"/><rect x="7" y="7" width="196" height="106" rx="12" fill="url(#soil)"/>
        ${[0, 1, 2].map(row => [0, 1, 2, 3, 4].map(col => `<use href="#sprout" x="${12 + col * 37}" y="${row * 30}" width="32" height="36"/>`).join('')).join('')}</g>
      <g transform="translate(768 364) rotate(5)"><rect width="145" height="107" rx="13" fill="#bb936b"/><rect x="5" y="5" width="135" height="97" rx="10" fill="url(#soil)"/>${[0, 1, 2].map(row => [0, 1, 2].map(col => `<use href="#sprout" x="${10 + col * 41}" y="${row * 29}" width="31" height="34"/>`).join('')).join('')}</g>
      <use href="#stall" x="244" y="410" width="175" height="130"/>
      <g stroke="#ede4c7" stroke-width="6" stroke-linecap="round"><path d="M482 506h444M487 522h440M497 492v45m55-45v45m55-45v45m55-45v45m55-45v45m55-45v45m55-45v45m55-45v45"/></g>
      <g fill="#f5e9bd"><circle cx="259" cy="353" r="4"/><circle cx="279" cy="337" r="3"/><circle cx="853" cy="316" r="4"/><circle cx="862" cy="332" r="3"/></g>
    </svg>`;
  }
  function market() {
    return `<svg viewBox="0 0 900 350" class="market-drawing" aria-hidden="true">${defs}<rect width="900" height="350" fill="#e5e9d4"/><path d="M0 132Q100 95 217 129T435 126 668 108 900 138V0H0Z" fill="#d2dec1"/><path d="M0 297q247-67 454-4t446-18v75H0Z" fill="#ecdec0"/><use href="#tree" x="-20" y="20" width="198" height="260"/><use href="#tree" x="728" y="-30" width="221" height="279"/><use href="#stall" x="265" y="30" width="373" height="285"/><path d="M0 252h235m435 0h230" stroke="#b7ac89" stroke-width="7"/><path d="M35 234v56m57-56v56m57-56v56m57-56v56m497-56v56m57-56v56m57-56v56m57-56v56" stroke="#b7ac89" stroke-width="8"/><g fill="#becb9a"><ellipse cx="222" cy="302" rx="31" ry="15"/><ellipse cx="685" cy="299" rx="38" ry="13"/></g></svg>`;
  }
  return { icon, farm, market };
})();
