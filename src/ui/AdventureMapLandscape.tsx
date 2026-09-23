import type { AdventureRegionId } from '../core/adventureTypes';
import { adventureMapThemes } from '../core/adventureMap';

// Terrain stays vector-based; maps and journey scenes layer the official landmark art above it.
export const AdventureMapLandscape = ({ region }: { region: AdventureRegionId }) => {
  const theme = adventureMapThemes[region];
  const forest = region === 'forest';
  return <svg className="adventure-map-landscape" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
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
  </svg>;
};
