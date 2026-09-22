import { getInventoryItem } from '../../core/items';
import { quoteExpeditionRations, type RationSelection } from '../../core/explorationRations';
import { explorationTravel } from '../../core/explorationTravelData';
import { earnExplorationPay } from '../../core/explorationBudget';
import type { RegionId } from '../../core/expeditionTypes';
import type { Inventory, ItemId, PetState } from '../../core/petTypes';
import { HelpButton } from '../help/HelpButton';
import { getRationsHelp } from '../help/explorationHelp';

export const ExpeditionRations = ({ pet, region, hours, selection, finds }: { pet: PetState; region: RegionId; hours: number; selection: RationSelection; finds?: Inventory }) => {
  const q = quoteExpeditionRations(pet, region, hours, selection), profile = explorationTravel[region];
  let projected = pet, coins = 0, hearts = 0;
  const now = Date.now();
  for (let i = 0; i < hours; i++) { const pay = earnExplorationPay(projected, 'hour', now + (i + 1) * 3600000, region); projected = pay.pet; coins += pay.coins; hearts += pay.hearts; }
  return <div className="exp-rations">
    <div className="help-heading"><strong>{q.reason || '补给已备齐'} · {q.count}/{q.maximum} 份</strong><HelpButton {...getRationsHelp(q)} /></div>
      <p>预计酬谢 {coins} 金币 · {hearts} 心心</p>
      {finds && <p>{Object.entries(finds).map(([id, n]) => `${getInventoryItem(id as ItemId)?.name ?? id} ×${n * hours}`).join(' · ')}</p>}
      <p>行路饱食 −{profile.idleHunger * hours / 2} · 体力 −{profile.idleEnergy * hours / 2} · 采集机会 {hours} 次。</p>
  </div>;
};
