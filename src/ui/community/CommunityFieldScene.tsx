import { useEffect, useState } from 'react';
import { communityCrops } from '../../core/foodCatalog';
import { communityGardenPlotLimit } from '../../core/communityUpgradeData';
import type { PetState } from '../../core/petTypes';
import { itemIcons } from '../../assets';
import { adventureLandmarkIcons } from '../../adventureLandmarkAssets';
import { timeLeft } from './types';

const getColumns = () => typeof window === 'undefined' || window.innerWidth <= 700 ? 2 : 3;

export const CommunityFieldScene = ({ pet, selectedId, onSelect, onExpand, icons }: {
  pet: PetState; selectedId: number; onSelect: (id: number) => void; onExpand: () => void; icons?: Partial<Record<string, string>>;
}) => {
  const [columns, setColumns] = useState(getColumns);
  useEffect(() => {
    const resize = () => setColumns(getColumns());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const { plots, gardenBuilt } = pet.community;
  const now = pet.timePause ? pet.lastUpdatedAt : Date.now();
  const rows = Math.ceil(communityGardenPlotLimit / columns), width = columns * 220 + 32, height = rows * 170 + 142;
  const readyCount = plots.filter(plot => plot.crop && plot.crop.readyAt <= now).length;
  const slots = Array.from({ length: communityGardenPlotLimit }, (_, index) => {
    const plot = plots[index], crop = plot?.crop, definition = crop ? communityCrops[crop.id] : undefined;
    const ready = Boolean(crop && crop.readyAt <= now), selected = plot?.id === selectedId;
    const expandable = gardenBuilt && !plot && index === plots.length;
    const growth = crop ? Math.max(0, Math.min(1, (now - crop.plantedAt) / Math.max(1, crop.readyAt - crop.plantedAt))) : 0;
    const status = plot ? !gardenBuilt ? '等待开放' : crop ? ready ? '可以收获' : timeLeft(crop.readyAt, now) : '待播种' : expandable ? `扩建第 ${index + 1} 块` : '待扩建';
    const label = `第 ${plot?.id ?? index + 1} 块菜地${definition ? ` · ${definition.name}` : ''} · ${status}`;
    return { index, plot, crop, definition, ready, selected, expandable, growth, status, label, x: 24 + index % columns * 220, y: 122 + Math.floor(index / columns) * 170 };
  });
  return <section className="community-field-scene" aria-label="全部菜地">
    <header><div><small>顺着水渠，一起照顾</small><h3>溪畔菜地</h3></div><span>{gardenBuilt ? `${plots.length}/${communityGardenPlotLimit} 块已开放 · ${readyCount} 块成熟` : '等待开放'}</span></header>
    <div className="community-field-map"><svg className="community-field-art" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <rect width={width} height={height} fill="#e9efdc" />
      <path d={`M0 0H${width}V116Q${width * .7} 58 ${width * .45} 106T0 102Z`} fill="#daebeb" />
      <circle cx={width - 66} cy="43" r="27" fill="#fff1c2" />
      <path d="M32 53q-10-22 14-26 9-24 30-7 28-2 27 26H32Z" fill="#fffdf1" opacity=".85" />
      <path d={`M0 104Q${width * .25} 55 ${width * .5} 98T${width} 100V136H0Z`} fill="#c8d9bd" />
      <image href={adventureLandmarkIcons.valley.story} x={width - 166} y="3" width="108" height="108" preserveAspectRatio="xMidYMid meet" />
      <path d={`M10 132V${height - 26}H${width - 18}`} fill="none" stroke="#fbf5df" strokeWidth="20" strokeLinecap="round" />
      <path d={`M10 132V${height - 26}H${width - 18}`} fill="none" stroke="#93bdc7" strokeWidth="11" strokeLinecap="round" />
      {slots.map(({ index, plot, crop, definition, ready, selected, expandable, growth, status, label, x, y }) => {
        const icon = definition ? icons?.[definition.product] ?? itemIcons[definition.product] : undefined;
        const plantSize = 42 + growth * 22;
        return <g key={plot?.id ?? `locked-${index}`} transform={`translate(${x} ${y})`}>
          <title>{label}</title>
          <rect className="community-field-plot-border" width="204" height="154" rx="16" fill={plot ? selected ? '#f7f3dc' : '#f6f2e3' : '#e0e6d2'} stroke={selected ? '#578372' : ready ? '#b89c4b' : '#bccbae'} strokeWidth={selected ? 4 : 2} strokeDasharray={!plot ? '7 5' : undefined} />
          <text x="14" y="28" fontSize="18" fontWeight="600" fill="#415f4a">第 {plot?.id ?? index + 1} 块{definition ? ` · ${definition.name}` : '菜地'}</text>
          {plot ? <>
            <path d="M16 57H188L196 113H8Z" fill={crop ? '#ac8964' : '#baa07d'} stroke="#e6d4ac" strokeWidth="4" strokeLinejoin="round" />
            <path d="M22 77H182M17 95H187" stroke="#927253" strokeWidth="2" strokeDasharray="5 7" />
            {icon && [64, 140].map(x => <image key={x} href={icon} x={x - plantSize / 2} y={106 - plantSize} width={plantSize} height={plantSize} preserveAspectRatio="xMidYMid meet" />)}
            {crop && <><rect x="14" y="120" width="176" height="5" rx="2" fill="#d5d9bf" /><rect x="14" y="120" width={176 * growth} height="5" rx="2" fill={ready ? '#d0a94a' : '#7fa77b'} /></>}
            <text x="102" y="145" textAnchor="middle" fontSize="17" fill={ready ? '#81641f' : '#50674f'}>{status}</text>
          </> : <>
            <text x="102" y="91" textAnchor="middle" fontSize={expandable ? 44 : 24} fill={expandable ? '#668b72' : '#86947c'}>{expandable ? '＋' : '···'}</text>
            <text x="102" y="132" textAnchor="middle" fontSize="18" fill="#63765a">{status}</text>
          </>}
        </g>;
      })}
    </svg>
      {slots.filter(slot => slot.plot || slot.expandable).map(({ index, plot, selected, label, x, y }) => <button key={plot?.id ?? `expand-${index}`} type="button" className="community-field-plot-target"
        style={{ left: `${x / width * 100}%`, top: `${y / height * 100}%`, width: `${204 / width * 100}%`, height: `${154 / height * 100}%` }} aria-label={label} aria-pressed={plot ? selected : undefined} aria-haspopup="dialog"
        onClick={() => plot ? onSelect(plot.id) : onExpand()} />)}
    </div>
    <p>点击地块播种或照料 · 当前选中第 {selectedId} 块</p>
  </section>;
};
