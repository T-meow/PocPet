import { ArrowUpRight, Compass, LockKeyhole } from 'lucide-react';
import { activityText as L } from '../core/kitchenRecipes';

// Opening the feature requires an actual destination. No save or level unlock is implied.
export type AdventureEntryState =
  | { status: 'locked'; onOpen?: never }
  | { status: 'available'; onOpen: () => void };

export const AdventureEntry = ({ entry }: { entry: AdventureEntryState }) => (
  <button
    type="button"
    className="home-adventure"
    disabled={entry.status === 'locked'}
    onClick={entry.status === 'available' ? entry.onOpen : undefined}
  >
    <span className="home-adventure-icon"><Compass size={25} aria-hidden="true" /></span>
    <span className="home-adventure-copy">
      <strong>{L('一起去冒险', 'Adventure together')}</strong>
      <small>{entry.status === 'locked'
        ? L('远方的地图还在准备，期待下一次出发', 'New places are taking shape. A journey awaits.')
        : L('带上好奇心，去看看外面的世界', 'Bring your curiosity. The world is waiting.')}</small>
    </span>
    <span className="home-adventure-status">{entry.status === 'locked'
      ? <><LockKeyhole size={13} aria-hidden="true" />{L('筹备中', 'Coming later')}</>
      : <ArrowUpRight size={18} aria-hidden="true" />}</span>
  </button>
);
