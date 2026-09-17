import type { AdventureRegionId } from '../core/adventureTypes';
import { adventureMapThemes } from '../core/adventureMap';

// The prototype's vector map remains a fallback until each region receives overview art.
export const AdventureMapLandscape = ({ region }: { region: AdventureRegionId }) => {
  const theme = adventureMapThemes[region];
  const forest = region === 'forest';
  return <svg className="adventure-map-landscape" viewBox="0 0 1000 650" aria-hidden="true">
    <rect width="1000" height="650" fill={theme.sky} />
    <circle cx="825" cy="85" r="34" fill="#fff7d5" />
    {region === 'observatory' && Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${35 + i * 47} ${30 + (i * 31) % 140}v8m-4-4h8`} stroke="#fffdf2" strokeWidth="2" />)}
    <g fill="#fff" opacity=".6"><path d="M102 97c-25-37 24-54 39-33 18-39 68-7 52 16 32-9 43 22 22 27H106Z" /><path d="M620 82c-21-29 18-50 39-25 13-29 56-12 46 16 31-5 32 28 2 23h-89Z" /></g>
    <path d="M-40 295Q145 55 381 223T720 194T1055 231V650H-40Z" fill={theme.land} opacity=".45" />
    <path d="M-50 374Q183 145 403 312T735 283T1070 317V680H-50Z" fill={theme.land} />
    <path d="M-80 547Q179 395 478 490T1070 412V680H-80Z" fill={theme.pale} opacity=".55" />
    {region === 'coast' ? <><path d="M-20 433Q390 300 630 470T1050 400V700H-20Z" fill="#a2d5de" /><path d="M-20 470Q390 337 630 507T1050 437" fill="none" stroke="#eaf8f0" strokeWidth="9" /></> : region !== 'observatory' && <><path d="M430 170C297 220 543 274 420 326S428 400 572 440 510 535 780 660" fill="none" stroke="#cfe5d2" strokeWidth="68" /><path d="M430 170C297 220 543 274 420 326S428 400 572 440 510 535 780 660" fill="none" stroke="#acd4ca" strokeWidth="48" /></>}
    {Array.from({ length: forest ? 23 : 12 }, (_, i) => <g key={i} transform={`translate(${45 + (i * 127) % 920} ${170 + (i * 79) % 390}) scale(${.5 + (i % 3) * .18})`}>
      <ellipse cy="35" rx="36" ry="12" fill="#45664c" opacity=".1" /><path d="M0-22V38" stroke="#8d8261" strokeWidth="10" strokeLinecap="round" />
      {forest ? <path d="M0-100-45-18h20l-35 40H60L25-18h20Z" fill="#688e77" /> : <><ellipse cy="-24" rx="43" ry="46" fill="#86aa70" /><ellipse cx="-18" cy="-37" rx="24" ry="30" fill="#a2bd84" /><ellipse cx="22" cy="-20" rx="24" ry="34" fill="#739861" /></>}
    </g>)}
    {Array.from({ length: 25 }, (_, i) => <g key={i} transform={`translate(${50 + (i * 173) % 900} ${245 + (i * 97) % 320})`}><path d="M0 0v12m0-5 5-4" stroke="#7b9c68" strokeWidth="2" /><circle r="4" fill={['#fff6cf', '#eec8ac', '#f7e9df'][i % 3]} /></g>)}
    <g transform="translate(724 222) scale(.77)">
      <ellipse cy="95" rx="110" ry="22" fill="#45664c" opacity=".13" />
      {region === 'valley' && <><path d="M-91 4 0-68 91 4v90H-91Z" fill="#d7e8d7" stroke="#829c80" strokeWidth="6" /><path d="M-91 4H91M0-68V93M-47-32V93M47-32V93M-90 50H91" fill="none" stroke="#94ab86" strokeWidth="4" /><path d="M-15 48h30v46h-30Z" fill="#a0b994" /></>}
      {region === 'windmill' && <><path d="m-52 90 22-140h60L52 90Z" fill="#fff0cc" stroke="#c7a16a" strokeWidth="4" /><path d="m-50-40 50-38 50 38Z" fill="#b57959" /><path d="M0-16V-104m0 88 80 44M0-16l-80 44" stroke="#a17b51" strokeWidth="10" /><path d="M10-30 35-90M10-5l57 50M-18-12-79-5" stroke="#fff4d9" strokeWidth="23" /><circle cy="-16" r="13" fill="#d6ae71" /></>}
      {region === 'forest' && <><rect x="-75" y="2" width="150" height="86" rx="4" fill="#c3a481" /><path d="m-98 5 98-83 98 83Z" fill="#63877a" stroke="#4b6f62" strokeWidth="5" /><path d="M-62 25h30v30h-30Zm95 0h30v30H33Z" fill="#f8dc9b" /><rect x="-14" y="32" width="31" height="56" fill="#8c775f" /></>}
      {region === 'coast' && <><path d="M-85 4H85V90H-85Z" fill="#e7dfbd" /><path d="m-106 7 26-56H64L106 7Z" fill="#7197a5" /><path d="M-67 30h37v32h-37ZM30 30h37v32H30Z" fill="#d1e8e7" /><rect x="-16" y="27" width="32" height="64" fill="#a8aa91" /><path d="M-104 98h215m-193-5v44m166-44v44" stroke="#b6a486" strokeWidth="11" /></>}
      {region === 'observatory' && <><path d="M-85 14a85 85 0 0 1 170 0" fill="#c6c8e4" stroke="#797c9a" strokeWidth="5" /><path d="M-72 10v78H72V10Z" fill="#e8e3ec" stroke="#9696ac" strokeWidth="4" /><path d="M-10-70v80M-45-54-20 9" stroke="#9297b6" strokeWidth="5" /><rect x="-16" y="41" width="32" height="47" rx="3" fill="#8d91af" /><path d="M-99 12H99M52-41 96-71" stroke="#7b83a8" strokeWidth="8" /></>}
    </g>
  </svg>;
};
