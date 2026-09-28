import { getExplorationBudget, getExplorationCapacity, getExplorationHarvestPay } from '../../core/explorationBudget';
import type { PetState } from '../../core/petTypes';
import { HelpButton } from '../help/HelpButton';
import { getBudgetHelp } from '../help/explorationHelp';
export const ExplorationBudgetCard = ({ pet }: { pet: PetState }) => <section className="community-card valley-budget"><h3>探索次数与收益</h3><p>可用采集次数 {getExplorationBudget(pet)?.available ?? 0}/{getExplorationCapacity(getExplorationBudget(pet))} · 溪谷每次手动采集 {getExplorationHarvestPay(pet, 'manual', 'valley').coins} 金币</p><HelpButton {...getBudgetHelp(pet)} /></section>;
