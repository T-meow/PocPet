import type { CommunityState } from '../../core/communityTypes';
import { communityFacilityIcons, type CommunityFacilityArtId } from '../../communityFacilityAssets';

const Tree = ({ x, y, size = 1, blossom = false }: { x: number; y: number; size?: number; blossom?: boolean }) => <g transform={`translate(${x} ${y}) scale(${size})`}><ellipse cy="73" rx="42" ry="12" fill="#65738322" /><path d="M0 17V75" stroke="#ac8768" strokeWidth="13" strokeLinecap="round" /><path d="M-39 24Q-58-10-30-27Q-24-63 8-51Q40-56 43-24Q63-3 40 24Q19 46 0 34Q-26 46-39 24" fill={blossom ? '#eab6cd' : '#91c698'} stroke={blossom ? '#b982a4' : '#67976f'} strokeWidth="4" /><path d="M-31-10Q-29-37 2-31Q22-37 31-15" stroke={blossom ? '#ffd4e6' : '#bedf9b'} strokeWidth="9" strokeLinecap="round" fill="none" /></g>;
const Facility = ({ id, x, y, size, built = true }: { id: CommunityFacilityArtId; x: number; y: number; size: number; built?: boolean }) => <image className="community-facility-art" data-built={built} href={communityFacilityIcons[id]} x={x} y={y} width={size} height={size} preserveAspectRatio="xMidYMid meet" />;

export const CommunitySceneArt = ({ community: c, fishing = false }: { community: CommunityState; fishing?: boolean }) => fishing ? <svg className="community-scene-art" viewBox="0 0 960 630" aria-hidden="true">
  <rect width="960" height="630" fill="#e8f2f8" /><path d="M0 162Q174 43 350 125T960 90V0H0Z" fill="#aecad3" /><path d="M0 200Q163 105 306 170T656 153 960 169V630H0Z" fill="#a5d5ec" /><path d="M0 258Q169 182 309 244T672 205 960 222" stroke="#def2f8" strokeWidth="24" fill="none" /><path d="M0 510Q175 454 344 530T663 630H0Z" fill="#cddfb3" /><path d="M0 342Q139 285 240 351L321 486L0 546Z" fill="#f6e2bb" />
  <g stroke="#e9f8ff" strokeWidth="4" strokeLinecap="round"><path d="M439 288H514M612 333H677M754 458H830M486 537H550M343 366H374" /></g>
  <Facility id="fishing_hut" x={4} y={145} size={340} built={c.facilities.fishing_hut.built} /><Tree x={43} y={250} size={1.3} /><Tree x={915} y={179} size={1.4} />
  <g transform="translate(285 393)" stroke="#b88d68" strokeWidth="5"><path d="M0 0L240 22V118L0 87Z" fill="#e5bf90" /><path d="M12 18L228 37M12 42L228 61M12 65L228 85" /><path d="M4-15V111M229 5V134" strokeWidth="10" /></g>
  <Facility id="upstream" x={638} y={18} size={260} built={c.facilities.upstream.built} /><Tree x={638} y={108} size={.9} /><Facility id="board" x={723} y={344} size={200} />
  {c.fishing.active && <g fill="none"><path d="M401 421Q503 213 596 386" stroke="#897b5b" strokeWidth="4" /><path d="M596 386V443" stroke="#f7f1d9" strokeWidth="2" /><ellipse cx="596" cy="450" rx="36" ry="11" stroke="#e8eedb" strokeWidth="3" /><path d="M596 424V448" stroke="#cc8c67" strokeWidth="6" /></g>}
</svg> : <svg className="community-scene-art" viewBox="0 0 960 630" aria-hidden="true">
  <rect width="960" height="630" fill="#dcebcf" /><path d="M0 103Q132 26 305 92T633 67 960 108V0H0Z" fill="#b8d6b2" /><path d="M709-20Q602 127 693 263T682 467L796 650H943Q773 457 825 366T847 123L884-20Z" fill="#a5d5ec" /><path d="M751-20Q660 137 746 269T734 468" fill="none" stroke="#def2f8" strokeWidth="9" />
  <path d="M452 656Q355 491 445 344T476 196" fill="none" stroke="#fae0b9" strokeWidth="55" /><path d="M448 351L172 376M459 457L758 430M451 530L208 550M481 235L803 226" fill="none" stroke="#fae0b9" strokeWidth="34" />
  <Facility id="field" x={77} y={138} size={270} built={c.gardenBuilt} />
  <Facility id="orchard" x={60} y={-30} size={225} />
  <Facility id="coop" x={367} y={-15} size={225} built={c.facilities.coop.built} /><Facility id="barn" x={669} y={-25} size={250} built={c.facilities.barn.built} /><Facility id="fishing_hut" x={665} y={196} size={225} built={c.facilities.fishing_hut.built} />
  <Tree x={45} y={446} size={1.04} /><Tree x={927} y={470} size={1.28} /><Tree x={605} y={143} size={.7} />
  <Facility id="board" x={414} y={351} size={190} /><Facility id="stall" x={72} y={355} size={220} built={c.facilities.stall.built} />
  {c.facilities.coop.built && <g fill="#fff3d2"><ellipse cx="531" cy="252" rx="19" ry="14" /><circle cx="546" cy="238" r="10" /><path d="M552 233L563 239L551 245" fill="#c69b54" /></g>}
  {c.facilities.barn.built && <g fill="#f7eed7" stroke="#8e906e" strokeWidth="3"><rect x="828" y="277" width="63" height="34" rx="13" /><path d="M838 305V324M879 305V324" strokeWidth="7" /><ellipse cx="896" cy="285" rx="14" ry="19" /><path d="M842 278Q869 270 861 301L842 299Z" fill="#939b83" /></g>}
</svg>;
