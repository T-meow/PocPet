import { marketSlotCount, marketStackLimit } from '../../core/communityMarketRules';
import type { CommunityMarket, MarketReceipt } from '../../core/communityTypes';

interface Props {
  market: CommunityMarket;
  iconFor: (id: string) => string;
  nameFor: (id: string) => string;
  visitor?: MarketReceipt;
}

export const CommunityMarketArt = ({ market, iconFor, nameFor, visitor }: Props) => {
  const capacity = marketSlotCount(market.level), rows = Math.max(2, capacity / 3), rowHeight = 252 / rows;
  const generous = visitor?.customer === 'generous';
  return <svg className="community-production-art community-market-art" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" role="group" aria-label="小摊货架">
    <circle cx="796" cy="94" r="40" fill="#fff0c5" /><g fill="#fff" opacity=".65"><path d="M151 115c-12-23 10-41 30-25 6-36 61-39 67-3 34-8 46 18 29 28Z" /><path d="M586 79c-9-19 8-33 26-20 15-32 51-18 52 8 23-7 32 11 20 20H588Z" /></g>
    <path d="M0 292q190-131 345-66t323-21 332 59v446H0Z" fill="#d2d6c4" /><path d="M0 368q217-84 502-26t498-38v406H0Z" fill="#eee0c7" /><path d="M0 599q314-115 574-13t426-11v125H0Z" fill="#e3d3b8" />
    <path d="M88 370V224m814 138V211" stroke="#a48b70" strokeWidth="15" strokeLinecap="round" /><path d="M16 280q-11-64 41-74-3-61 54-57 43-28 69 18 57 9 44 66 10 47-59 53Z" fill="#aebb9c" /><path d="M830 267q-32-37 5-66 0-50 57-49 35-28 60 20 55-3 48 53 16 43-47 58Z" fill="#bda99d" />
    <path d="M169 152q333 85 655-6" fill="none" stroke="#a38b77" strokeWidth="3" /><g fill="#f8d69a" stroke="#b7a086" strokeWidth="2">{[0, 1, 2, 3, 4, 5, 6].map(i => <g key={i} transform={`translate(${205 + i * 95} ${171 + Math.sin(i / 6 * Math.PI) * 32})`}><path d="M0-9v8" /><rect x="-6" width="12" height="17" rx="5" /></g>)}</g>
    <ellipse cx="504" cy="579" rx="274" ry="32" fill="#a68b6726" />
    <path d="M272 201v366m450-366v366" stroke="#a17e5b" strokeWidth="13" strokeLinecap="round" />
    <rect x="289" y="263" width="416" height="266" rx="9" fill="#af885e" stroke="#916d49" strokeWidth="4" />
    {Array.from({ length: capacity }, (_, slotIndex) => {
      const listing = market.listings.find(listing => listing.slotIndex === slotIndex);
      const label = `第 ${slotIndex + 1} 格，${listing ? `${nameFor(listing.itemId)} ${listing.quantity} 份，单价 ${listing.unitPrice} 金币` : '空栏位'}`;
      const size = Math.min(78, rowHeight - 12);
      return <g key={slotIndex} transform={`translate(${296 + (slotIndex % 3) * 134} ${270 + Math.floor(slotIndex / 3) * rowHeight})`} role="img" aria-label={label} data-market-slot={slotIndex} data-item-id={listing?.itemId} data-quantity={listing?.quantity ?? 0}>
        <title>{label}</title>
        <rect x="2" y="2" width="130" height={rowHeight - 5} rx="5" fill={listing ? '#f9eed7' : '#c5a27a'} />
        <path d={`M5 ${rowHeight - 4}h124`} stroke="#8e6d4c" strokeWidth="5" />
        {listing ? <>
          <image href={iconFor(listing.itemId)} x={(134 - size) / 2} y={(rowHeight - size) / 2 - 3} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
          <rect x="91" y={rowHeight - 28} width="36" height="22" rx="8" fill={listing.quantity === marketStackLimit ? '#835f83' : '#715644'} />
          <text x="109" y={rowHeight - 12} textAnchor="middle" fill="#fffaf2" fontSize="17" fontWeight="600" fontFamily="sans-serif">{listing.quantity}</text>
        </> : <path d={`M60 ${rowHeight / 2}h14m-7-7v14`} stroke="#97734f" strokeWidth="3" strokeLinecap="round" opacity=".65" />}
      </g>;
    })}
    <path d="M260 530h475v24H260Z" fill="#caab7f" stroke="#a17e5b" strokeWidth="4" /><path d="M283 554h429v32H283Z" fill="#84a5aa" /><path d="M288 558h418m-405 14h82m121 6h185" stroke="#739498" strokeWidth="3" />
    <path d="M291 150h412l50 81H239Z" fill="#fbefd3" />
    {[0, 1, 2, 3].map(i => <path key={i} d={`M${291 + i * 103} 150h51.5L${303 + i * 128.5} 231H${239 + i * 128.5}Z`} fill={market.open ? '#c98079' : '#b8a298'} />)}
    {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${239 + i * 64.25} 230h64.25v16q-32.125 25-64.25 0Z`} fill={i % 2 ? '#f5e5c7' : market.open ? '#b96e68' : '#a58e85'} />)}
    <path d="M291 150h412" stroke="#a67e63" strokeWidth="6" strokeLinecap="round" />
    <g transform="translate(497 190)"><rect x="-68" y="-20" width="136" height="38" rx="7" fill="#fff7e7" stroke="#ddbc96" strokeWidth="2" /><text textAnchor="middle" y="5" fill="#976653" fontSize="17" fontFamily="sans-serif" letterSpacing="3">溪畔小摊</text></g>
    <g transform="translate(239 396) rotate(-7)"><path d="M-28-9 0-57 32-9m-28-45 3-38" fill="none" stroke="#9c7b5b" strokeWidth="5" /><rect x="-34" y="-58" width="68" height="57" rx="4" fill="#567b79" stroke="#bc9c71" strokeWidth="5" /><text textAnchor="middle" y="-34" fill="#fff4dd" fontSize="12" fontFamily="sans-serif">{market.open ? '正在营业' : '歇一会儿'}</text><path d="M-16-19h32" stroke="#d0ddd0" strokeWidth="2" /></g>
    <g transform="translate(755 521)"><path d="M-25-14h49l-5 44h-38Z" fill="#d9b095" /><path d="M0-12v-58m0 27q-37-26-29-37 24-6 29 26m0-11q20-34 31-26 3 22-30 32" fill="#9fb599" stroke="#839d7d" strokeWidth="3" /><circle cx="-4" cy="-78" r="12" fill="#e7bf9a" /></g>
    {visitor && <g transform="translate(218 510)" data-market-visitor={visitor.customer}><g className="community-market-visitor">
      <ellipse cy="65" rx="49" ry="10" fill="#73543325" />
      <path d="m-12 32-4 29m29-29 4 29" stroke="#716780" strokeWidth="13" strokeLinecap="round" />
      <path d="M-25-8q25-16 50 0l9 47h-68Z" fill={generous ? '#b08ac0' : visitor.customer === 'collector' ? '#7696ae' : '#87a78f'} />
      <circle cy="-31" r="23" fill="#f2c7a8" /><path d="M-22-34q-6-36 24-29 31-3 23 30L4-47Z" fill="#785c50" />
      <circle cx="-7" cy="-31" r="2" fill="#675047" /><circle cx="9" cy="-31" r="2" fill="#675047" /><path d="M-4-20q5 5 11 0" fill="none" stroke="#b47b70" strokeWidth="2" strokeLinecap="round" />
      {visitor.customer === 'collector' && <g fill="none" stroke="#66576d" strokeWidth="2"><circle cx="-8" cy="-31" r="7" /><circle cx="10" cy="-31" r="7" /><path d="M-1-31h4" /></g>}
      {generous && <><path d="M-20-65h38l7 19h-52Z" fill="#eac275" /><path d="M-31-44h65" stroke="#d3a25f" strokeWidth="7" strokeLinecap="round" /><path d="m-38-25 2-10m-7 5h10m59-27 2-12m-7 6h11" stroke="#f7d181" strokeWidth="3" /></>}
      <path d="m-23-2-14 25m61-24 16 24" stroke="#f2c7a8" strokeWidth="11" strokeLinecap="round" />
      <g transform="translate(40 30)"><path d="M-12-4h25l3 27h-31Z" fill="#e8b07f" /><path d="M-7-4q0-17 15 0" fill="none" stroke="#997653" strokeWidth="3" /></g>
      {generous && <g transform="translate(-40 32)"><path d="M-14-6h28l4 28h-36Z" fill="#e5c985" /><path d="M-8-5q0-17 16 0" fill="none" stroke="#997653" strokeWidth="3" /></g>}
    </g></g>}
    <g fill="#f9efd6"><circle cx="170" cy="604" r="4" /><circle cx="825" cy="579" r="4" /><circle cx="804" cy="511" r="3" /></g>
  </svg>;
};
