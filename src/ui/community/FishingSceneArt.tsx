import { useId } from 'react';
import type { WaterId } from '../../core/communityTypes';

export type FishingScenePhase = 'ready' | 'waiting' | 'biting' | 'reeling' | 'idle' | 'caught';
export const FishingSceneArt = ({ water, portrait, name, phase, rodIcon, reelTick = 0 }: {
  water: WaterId; portrait?: string; name: string; phase: FishingScenePhase; rodIcon: string; reelTick?: number;
}) => {
  const sky = useId().replace(/:/g, '');
  return <div className="fishing-scene" data-water={water} data-phase={phase} role="img" aria-label={`${name}在水边钓鱼${phase === 'biting' ? '，鱼儿上钩了' : ''}`}>
    <svg viewBox="0 0 600 360" aria-hidden="true" className="fishing-scene-layer">
      <defs><linearGradient id={sky} x2="0" y2="1"><stop stopColor="var(--fishing-sky)" /><stop offset="1" stopColor="#f6f3da" /></linearGradient></defs>
      <rect width="600" height="360" fill={`url(#${sky})`} />
      <circle cx="474" cy="62" r="27" fill="#fff9cf" opacity=".9" />
      <path d="M0 146Q85 49 172 110T330 92T600 129V211H0Z" fill="var(--fishing-far)" />
      <path d="M0 178Q130 113 251 164T600 152V360H0Z" fill="var(--fishing-water)" />
      <path d="M225 197Q285 180 338 190M400 158h67M513 223h57M328 326h76" fill="none" stroke="#effcff" strokeWidth="3" strokeLinecap="round" opacity=".65" />
      <path d="M0 184Q70 127 176 190L208 360H0Z" fill="#a8c2a0" />
      <path d="M0 257Q104 194 205 249L259 360H0Z" fill="#ded1a6" />
      <g fill="var(--fishing-tree)"><path d="M12 146L43 44L75 146Z" /><path d="M48 157L82 68L116 157Z" /></g>
      <g fill="none" stroke="#627f6c" strokeWidth="5"><path d="M44 122v75M84 138v61" /></g>
      {water === 'coast_pier' && <path d="M348 68q10-11 20 0q10-11 20 0M404 93q8-9 16 0q8-9 16 0" fill="none" stroke="#718e9b" strokeWidth="3" strokeLinecap="round" />}
      {water === 'forest_pool' && <path d="M240 124h290M305 139h270" stroke="#eef7ed" strokeWidth="13" opacity=".4" strokeLinecap="round" />}
      <path d="M32 254L252 240L314 270L83 291Z" fill="#c8a276" stroke="#9b805f" strokeWidth="3" />
      <path d="M83 291L314 270V285L83 309Z" fill="#a78460" />
      <path d="M102 308v39M278 288v42M73 269l217-12M115 279l196-13" stroke="#9b805f" strokeWidth="5" />
      <g className="fishing-rod-motion" key={reelTick}>
        <path d="M392 116Q411 177 437 246" fill="none" stroke="#f8f5df" strokeWidth="1.7" />
        <image href={rodIcon} x="176" y="68" width="240" height="216" preserveAspectRatio="xMidYMid meet" />
      </g>
      <g className="fishing-float"><ellipse cx="437" cy="253" rx="34" ry="9" fill="none" stroke="#f2fcf8" strokeWidth="2" opacity=".7" /><path d="M437 224v26" stroke="#bd654f" strokeWidth="6" strokeLinecap="round" /><path d="M437 239v11" stroke="#ffefcc" strokeWidth="6" strokeLinecap="round" /></g>
      {(phase === 'biting' || phase === 'reeling') && <g className="fishing-bite-lines" stroke="#fff9dc" strokeWidth="4" strokeLinecap="round"><path d="M407 218l-8-8M466 218l8-8M437 204v-10" /></g>}
      <ellipse cx="168" cy="271" rx="62" ry="9" fill="#795a3e" opacity=".18" />
      {portrait ? <image className="fishing-scene-actor" href={portrait} x="78" y="70" width="180" height="204" preserveAspectRatio="xMidYMax meet" /> : <svg className="fishing-scene-actor" x="88" y="70" width="160" height="204" viewBox="0 0 160 200" preserveAspectRatio="xMidYMax meet"><ellipse cx="80" cy="147" rx="48" ry="48" fill="#efe0c3" /><circle cx="80" cy="75" r="48" fill="#f5e7ce" /><path d="M39 45L27 2L66 31M95 30L131 2L123 52" fill="#e2b898" /><circle cx="63" cy="77" r="4" fill="#756453" /><circle cx="99" cy="77" r="4" fill="#756453" /><path d="M73 94q9 8 18 0" fill="none" stroke="#756453" strokeWidth="3" /></svg>}
    </svg>
    {phase === 'idle' && <span className="fishing-scene-note">慢慢钓，不着急</span>}
  </div>;
};
