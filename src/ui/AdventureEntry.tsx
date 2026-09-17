import { ArrowUpRight, Compass, LockKeyhole } from 'lucide-react';
import { activityText as L } from '../core/kitchenRecipes';
import { adventureHallScene, getAdventureNodeScene } from './adventureScenes';
import { ClaimNotice } from './ClaimNotice';

// Opening the feature requires an actual destination. No save or level unlock is implied.
export type AdventureEntryState =
  | { status: 'locked'; onOpen?: never }
  | { status: 'available'; onOpen: () => void; traveling?: boolean; pending?: boolean };

export const AdventureEntry = ({ entry, hasReward = false }: { entry: AdventureEntryState; hasReward?: boolean }) => (
  <button
    type="button"
    className="home-adventure"
    disabled={entry.status === 'locked'}
    onClick={entry.status === 'available' ? entry.onOpen : undefined}
  >
    <img className="home-adventure-background" src={entry.status === 'available' && entry.traveling ? getAdventureNodeScene('valley', 'entrance') : adventureHallScene} alt="" aria-hidden="true" draggable={false} />
    <span className="home-adventure-icon"><Compass size={25} aria-hidden="true" /></span>
    <span className="home-adventure-copy">
      <strong>{entry.status === 'available' && entry.traveling ? L('继续入口探查', 'Continue scouting') : L('一起去冒险', 'Adventure together')}</strong>
      <small>{entry.status === 'locked'
        ? L('远方的地图还在准备，期待下一次出发', 'New places are taking shape. A journey awaits.')
        : entry.traveling ? L('伙伴还在溪谷，行囊和进度都在', 'Your companion is in the valley. Your bag and progress are saved.')
          : entry.pending ? L('已经回到前哨基地，收好旅途物资吧', 'Back at the outpost. Your travel supplies await collection.')
            : L('前往前哨基地，准备溪谷的第一次探查', 'Visit the outpost and prepare to scout the valley.')}</small>
    </span>
    <span className="home-adventure-status">{entry.status === 'locked'
      ? <><LockKeyhole size={13} aria-hidden="true" />{L('筹备中', 'Coming later')}</>
      : <ArrowUpRight size={18} aria-hidden="true" />}</span>
    <ClaimNotice show={entry.status === 'available' && (hasReward || Boolean(entry.pending))} />
  </button>
);
