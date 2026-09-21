import { Hammer, HandHeart, ShoppingBasket } from 'lucide-react';

type SceneKind = 'field' | 'coop' | 'barn';
type CropKind = import('../../core/foodCatalog').CropId;
interface Props {
  kind: SceneKind; title: string; subtitle: string; status: string; detail: string;
  supplies: string; harvest: string; ready: boolean; harvestDisabled: boolean;
  onHarvest: () => void; onCare: () => void;
  onConstruction?: () => void;
  stock?: number; feed?: number; crop?: CropKind; growth?: number;
}

const Tree = ({ x, y, tone = '#91ad8a', scale = 1 }: { x: number; y: number; tone?: string; scale?: number }) => <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <path d="M0 0V-125M0-56l-27-25M0-75l26-30" fill="none" stroke="#9c7a62" strokeWidth="15" strokeLinecap="round" />
  <path d="M-58-114c-29-37 0-85 35-80 17-38 68-29 76 5 42 7 50 58 20 80-26 26-102 22-131-5Z" fill={tone} />
  <path d="M-44-151c7-26 24-32 41-23 20-27 43-8 47 9" fill="none" stroke="#fff" opacity=".22" strokeWidth="13" strokeLinecap="round" />
</g>;

const Chicken = ({ x, y, scale = 1, cream = false }: { x: number; y: number; scale?: number; cream?: boolean }) => <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <ellipse cy="24" rx="42" ry="10" fill="#8d7047" opacity=".12" />
  <path d="M-11 16v14m22-14v14m-11 0h-15m26 0h11" stroke="#c28640" strokeWidth="5" strokeLinecap="round" />
  <path d="m-27-1-20-22 2 28 26 11" fill={cream ? '#d7a75d' : '#d8d4e2'} />
  <ellipse cy="-3" rx="33" ry="28" fill={cream ? '#f4d49a' : '#fff9ee'} />
  <path d="M-14-7q-2 22 22 17" fill="none" stroke={cream ? '#d5ab69' : '#e1d3bc'} strokeWidth="4" strokeLinecap="round" />
  <circle cx="22" cy="-26" r="19" fill={cream ? '#f4d49a' : '#fff9ee'} />
  <path d="M11-42c-6-15 5-19 10-6 1-17 14-15 13 0" fill="#db756c" />
  <path d="m38-29 14 7-15 5" fill="#e1a34d" /><circle cx="27" cy="-29" r="3" fill="#5a5052" />
  <ellipse cx="33" cy="-7" rx="5" ry="9" fill="#db756c" />
</g>;

const Cow = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <ellipse cy="57" rx="112" ry="17" fill="#795f4c" opacity=".13" />
  <path d="M-67 5v47m41-42v46m53-49v45m36-49v51" stroke="#faf4e5" strokeWidth="20" strokeLinecap="round" />
  <path d="M-67 49v7m41-4v7m53-9v7m36-6v7" stroke="#786867" strokeWidth="20" strokeLinecap="round" />
  <path d="M-89-34q-28 5-22 52" fill="none" stroke="#ece5d7" strokeWidth="8" strokeLinecap="round" />
  <ellipse cx="-7" cy="-16" rx="87" ry="53" fill="#faf4e5" />
  <path d="M-49-63q-30 14-25 45 15 22 31 1 5-15 28-18 16-21-34-28M17-63q29-1 34 24-17 33-37 15-16-20 3-39" fill="#8a7772" />
  <path d="m57-66-5-26 17 15m25 8 13-20-1 31" fill="#cfaa6c" />
  <path d="M52-56q-35-21-37-1 12 20 37 14m47-13q34-20 39 0-13 21-37 14" fill="#d9c9b2" />
  <path d="M46-54q23-30 52 0l6 55H45Z" fill="#fffaf0" />
  <path d="M50-50q22-27 22 6-7 16-25 10" fill="#8a7772" />
  <ellipse cx="75" cy="2" rx="35" ry="23" fill="#eab6a6" />
  <circle cx="56" cy="-29" r="4" fill="#52494b" /><circle cx="91" cy="-29" r="4" fill="#52494b" />
  <ellipse cx="61" cy="2" rx="3" ry="5" fill="#b68079" /><ellipse cx="88" cy="2" rx="3" ry="5" fill="#b68079" />
  <path d="M44 23q28 13 60 0" fill="none" stroke="#869dab" strokeWidth="6" /><path d="M67 29h16l3 15H64Z" fill="#d6b26a" />
</g>;

const Plant = ({ crop, growth, x, y }: { crop: CropKind; growth: number; x: number; y: number }) => <g transform={`translate(${x} ${y}) scale(${.38 + growth * .62})`}>
  <ellipse cy="3" rx="28" ry="7" fill="#725140" opacity=".18" />
  {crop === 'carrot' && <path d="M-12-2q11-16 25 0L2 23Z" fill="#e69859" />}
  <path d="M0 1v-37m0 25Q-36-49-34-18q2 16 34 10m0-15q23-37 29-10 3 15-29 17M0-34q-18-37-24-17 0 14 24 21" fill={crop === 'herb' ? '#8db78d' : '#769d74'} stroke="#5b8467" strokeWidth="3" strokeLinejoin="round" />
  {crop === 'berry' && growth > .6 && <g fill="#c56c83"><circle cx="-24" cy="-18" r="7" /><circle cx="22" cy="-24" r="7" /><circle cx="-10" cy="-35" r="6" /></g>}
  {crop === 'herb' && growth > .8 && <g fill="#ded6ed"><circle cx="-23" cy="-48" r="6" /><circle cx="27" cy="-33" r="5" /></g>}
</g>;

const SceneArt = ({ kind, stock = 0, feed = 0, crop, growth = 0 }: Pick<Props, 'kind' | 'stock' | 'feed' | 'crop' | 'growth'>) => <svg className="community-production-art" viewBox="0 0 1000 610" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <circle cx="782" cy="92" r="42" fill="#fff1c6" />
  <g fill="#fff" opacity=".7"><path d="M122 100c-15-28 15-42 35-27 9-39 68-31 67 6 32-10 48 21 28 30H126Z" /><path d="M561 72c-9-24 18-38 34-23 14-25 51-13 48 12 21-6 34 15 20 23H562Z" /></g>
  <path d="M0 255Q134 126 308 220T654 212T1000 225V610H0Z" fill={kind === 'barn' ? '#d2d9c5' : '#c9daca'} />
  <path d="M0 324q175-103 353-37t647-15v338H0Z" fill={kind === 'field' ? '#e7debd' : '#e9dfc4'} />
  <path d="M0 518q292-88 555-20t445-22v134H0Z" fill="#d6dab6" />
  <Tree x={112} y={335} scale={1.2} tone={kind === 'coop' ? '#b6b78e' : '#9faf9c'} />
  <Tree x={885} y={335} scale={1.35} tone={kind === 'barn' ? '#bd9e8c' : '#a6b89b'} />
  <g stroke="#b69b75" strokeWidth="9" strokeLinecap="round"><path d="M132 323H878M132 348H878" /><path d="M145 307v61m61-61v61m62-61v61m460-61v61m62-61v61m62-61v61" /></g>
  {kind === 'field' ? <>
    <g transform="translate(636 169)"><path d="M0 150V61L73 0l74 61v89Z" fill="#f8f3df" stroke="#92afb0" strokeWidth="8" /><path d="M5 62h135M73 6v144M0 107h147M32 35v115m82-115v115" stroke="#abc6c3" strokeWidth="5" /><path d="M48 150v-55h49v55" fill="#d4e5da" stroke="#92afb0" strokeWidth="5" /></g>
    <path d="M204 336q-21 76-49 167 69 35 197 48" fill="none" stroke="#f5eee2" strokeWidth="40" /><path d="M204 336q-21 76-49 167 69 35 197 48" fill="none" stroke="#9ec6cf" strokeWidth="23" /><path d="m184 400-7 24m-9 39-6 26m63 34 31 9" stroke="#e7f5f7" strokeWidth="4" strokeLinecap="round" />
    {[0, 1, 2].map(row => <g key={row} transform={`translate(${-row * 16} ${row * 69})`}>
      <path d="m283 311 436 0 45 49H260Z" fill="#b08a67" stroke="#f0dcbb" strokeWidth="9" strokeLinejoin="round" />
      <path d="M287 343h439" stroke="#987355" strokeWidth="3" strokeDasharray="4 11" strokeLinecap="round" />
      {crop && [0, 1, 2, 3, 4, 5, 6].map(col => <Plant key={col} crop={crop} growth={growth} x={302 + col * 65} y={340} />)}
    </g>)}
    <g transform="translate(746 463)"><ellipse cy="25" rx="40" ry="11" fill="#927057" opacity=".13" /><path d="M-25-25h45l-3 48h-38Z" fill="#84adb8" /><path d="M20-12q41-27 34 10Q50 10 18 5" fill="none" stroke="#84adb8" strokeWidth="8" /><path d="m-22-12-37-12-12 9 47 24" fill="#84adb8" /><path d="M-19-28q-8-37 33-26" fill="none" stroke="#6f939e" strokeWidth="6" /></g>
  </> : <>
    <g transform={`translate(${kind === 'coop' ? 258 : 252} ${kind === 'coop' ? 176 : 155})`}>
      <path d="M-19 92 153-14 324 92" fill="none" stroke="#eee2c4" strokeWidth="26" strokeLinejoin="round" />
      <path d="M0 88 153-4 306 88v152H0Z" fill={kind === 'coop' ? '#edc694' : '#c68878'} />
      <path d="M-22 95 153-19 328 95" fill={kind === 'coop' ? '#bf7e6b' : '#8f9cae'} stroke={kind === 'coop' ? '#9b685c' : '#697d96'} strokeWidth="12" strokeLinejoin="round" />
      <path d="M20 123h267M20 160h267M20 196h267" stroke={kind === 'coop' ? '#d5b184' : '#b77b6a'} strokeWidth="3" />
      <path d="M100 240V130q52-38 104 0v110" fill="#796955" stroke="#f4dfb9" strokeWidth="9" />
      <path d="M102 153h100m-99 5 97 75m0-75-97 75" fill="none" stroke="#a18a6c" strokeWidth="8" />
      <rect x="27" y="116" width="43" height="47" rx="4" fill="#c4d8db" stroke="#fff0cd" strokeWidth="7" /><path d="M48 117v44m-19-22h38" stroke="#fff0cd" strokeWidth="4" />
      <circle cx="154" cy="62" r="18" fill="#fff0cd" /><path d="M148 74V51l15 11-15 12" fill={kind === 'coop' ? '#bf7e6b' : '#8f9cae'} />
      {kind === 'coop' && <path d="m110 240-53 53h94l45-53" fill="#bfa47b" stroke="#a88a61" strokeWidth="5" />}
    </g>
    {kind === 'coop' ? <><Chicken x={440} y={464} scale={1.25} /><Chicken x={593} y={398} scale={1.05} cream /><Chicken x={655} y={474} scale={.85} /></> : <><Cow x={579} y={430} scale={1.1} /><g transform="translate(294 441)"><rect x="-55" y="-35" width="93" height="57" rx="15" fill="#dcc181" /><path d="M-32-33v54m38-54v54M-49-20h23m8 25h24m-17-14h20" stroke="#bd9e59" strokeWidth="4" /></g></>}
    <g transform="translate(690 348)"><path d="M-59 0 69 0 54 40H-49Z" fill="#b2997c" /><path d="M-56 0 64 0 51 12H-46Z" fill="#806f59" />{feed > 0 && <path d="M-44 5q25-22 47-3 22-18 49 3Z" fill="#e3c381" />}<path d="M-43 37v15m88-15v15" stroke="#937c62" strokeWidth="7" /></g>
    <g transform="translate(323 510)">
      <ellipse cy="14" rx="57" ry="12" fill="#8d7047" opacity=".15" />
      {kind === 'coop' ? <><path d="M-38-13q-1-67 37-65 41 0 40 65" fill="none" stroke="#a88457" strokeWidth="7" />{Array.from({ length: Math.min(6, stock) }, (_, i) => <ellipse key={i} cx={-25 + (i % 3) * 25} cy={-18 - Math.floor(i / 3) * 12} rx="13" ry="18" fill={i % 2 ? '#fff7de' : '#e8d2ac'} />)}<path d="M-49-16h96L37 20h-73Z" fill="#c09a65" /><path d="M-40-5h79m-71 12h62" stroke="#a78151" strokeWidth="3" /></> : <>{[0, 1].map(i => <g key={i} transform={`translate(${i * 48 - 22} ${i * -9})`}><path d="M-13-59h26v12l10 12v54h-46v-54l10-12Z" fill={stock > i * 3 ? '#eaf0ee' : '#c0cacc'} stroke="#94a7ac" strokeWidth="3" /><path d="M-15-60h30m-34 35h38M-19 7h38" stroke="#8199a4" strokeWidth="4" /><path d="M-25-32q-22-13-14 12m62-12q22-13 14 12" fill="none" stroke="#94a7ac" strokeWidth="4" /></g>)}</>}
    </g>
  </>}
  <g fill="#f9f3dc"><circle cx="220" cy="539" r="4" /><circle cx="793" cy="510" r="5" /><circle cx="826" cy="455" r="4" /><circle cx="168" cy="425" r="3" /></g>
</svg>;

export const CommunityProductionScene = ({ kind, title, subtitle, status, detail, supplies, harvest, ready, harvestDisabled, onHarvest, onCare, onConstruction, ...art }: Props) => <section className="community-production-scene" data-production-scene={kind} data-ready={ready} aria-label={`${title}场景`}>
  <header className="community-production-heading"><div><small>{subtitle}</small><h3>{title}</h3></div><span className="community-scene-status"><i />{status}</span></header>
  <div className="community-production-view"><SceneArt kind={kind} {...art} /><div className="community-harvest-sign" data-ready={ready}><ShoppingBasket size={18} /><span>{harvest}</span></div></div>
  <footer className="community-production-footer"><div className="community-production-caption"><span>{supplies}</span><span>{detail}</span></div><div className="community-production-dock">
    <button type="button" className="primary-button" disabled={harvestDisabled} onClick={onHarvest}><ShoppingBasket size={20} />收获</button>
    <button type="button" className="secondary-button" onClick={onCare} aria-haspopup="dialog"><HandHeart size={20} />照料</button>
    {onConstruction && <button type="button" className="secondary-button" onClick={onConstruction} aria-haspopup="dialog"><Hammer size={20} />建设</button>}
  </div></footer>
</section>;
