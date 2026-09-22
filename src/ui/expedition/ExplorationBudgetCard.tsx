import { getExplorationBudget, getExplorationFace } from '../../core/explorationBudget';
import type { PetState } from '../../core/petTypes';
import { HelpButton } from '../help/HelpButton';
import { getBudgetHelp } from '../help/explorationHelp';
export const ExplorationBudgetCard = ({ pet }: { pet: PetState }) => <section className="community-card valley-budget"><h3>探索机会与酬谢</h3><p>可用采集机会 {getExplorationBudget(pet)?.available ?? 0}/24 · 溪谷每日固定金币 {getExplorationFace(pet) * 3}</p><HelpButton {...getBudgetHelp(pet)} /></section>;
