import { createContext, useContext } from 'react';
import type { PetState } from '../../core/petTypes';
import type { CommunityRoute } from '../../core/communityTypes';
import type { AdventureDestinationId } from '../../core/adventureTypes';
import type { AdventureStageChoice } from '../../core/adventureGathering';
import { adventureJourneyDetail, adventureTutorialRewardText } from '../../core/adventureData';
import { isLandmarkId } from '../../core/landmarkProgress';
import { HelpButton, type HelpContent } from './HelpButton';
import { getLandmarkHelp } from './landmarkHelp';
import { gatheringCompanionHelp } from './explorationHelp';
import { backpackHelp, campHelp, rescueHelp, neighborHelp, explorationHelp, getExplorationPreparationHelp, getBudgetHelp, commissionHelp, treasureFindingHelp } from './explorationHelp';
export const ExplorationHandbookNavigation = createContext<(() => void) | undefined>(undefined);
export const ExplorationHandbook = ({ pet }: { pet: PetState }) => <div className="exploration-handbook">{[getExplorationPreparationHelp(pet), gatheringCompanionHelp, getBudgetHelp(pet), backpackHelp, campHelp, rescueHelp, neighborHelp, commissionHelp, treasureFindingHelp].map(section => <details key={section.title}><summary>{section.title}</summary>{section.overview}{section.details}</details>)}</div>;

export const ExplorationHelp = ({ pet, purpose, destination, choices }: {
  pet: PetState; purpose?: CommunityRoute; destination?: AdventureDestinationId; mode?: 'manual';
  choices?: readonly AdventureStageChoice[];
}) => {
  const openHandbook = useContext(ExplorationHandbookNavigation);
  const sections: HelpContent[] = [];
  sections.push(gatheringCompanionHelp);
  if (purpose) {
    const landmark = isLandmarkId(purpose) ? getLandmarkHelp(purpose) : undefined;
    sections.push({ title: landmark?.title ?? '本次任务', overview: <>{landmark?.overview}<p>{adventureJourneyDetail(purpose)}</p></> });
  } else if (destination === 'tutorial') sections.push({ title: '新手踩点', overview: <p>{adventureTutorialRewardText()}</p> });
  sections.push(choices ? { title: '当前操作', overview: <p>普通行动和持有的适用工具直接列在页面中，每张卡片显示实际消耗、收益和耐久。放大镜先在卡片内选择目标，点击「使用放大镜」才消耗采集次数和耐久。</p>, details: explorationHelp.details } : getExplorationPreparationHelp(pet));
  if (!choices) sections.push(backpackHelp, getBudgetHelp(pet), commissionHelp, treasureFindingHelp);
  else sections.push(campHelp, rescueHelp, neighborHelp);
  return <HelpButton title="探索" label="探索说明"
    overview={<>{sections.map(section => <section className="exploration-help-section" key={section.title}><h3>{section.title}</h3>{section.overview}</section>)}{openHandbook && <button className="secondary-button" onClick={openHandbook}>打开完整玩法手册</button>}</>}
    details={<>{sections.filter(section => section.details).map(section => <section className="exploration-help-section" key={section.title}><h3>{section.title}</h3>{section.details}</section>)}</>} />;
};
