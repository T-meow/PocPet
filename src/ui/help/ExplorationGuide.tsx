import type { PetState } from '../../core/petTypes';
import type { CommunityRoute } from '../../core/communityTypes';
import type { AdventureDestinationId } from '../../core/adventureTypes';
import type { AdventureStageChoice } from '../../core/adventureGathering';
import type { RationQuote } from '../../core/explorationRations';
import { adventureJourneyDetail, adventureTutorialRewardText } from '../../core/adventureData';
import { getAdventureChoicePreview } from '../../core/adventure';
import { isLandmarkId } from '../../core/landmarkProgress';
import { HelpButton, type HelpContent } from './HelpButton';
import { getLandmarkHelp } from './landmarkHelp';
import { backpackHelp, campHelp, rescueHelp, getExplorationPreparationHelp, getExplorationChoiceHelp, getAdventureActionHelp, getBudgetHelp, getRationsHelp, rationRules, rationCalculationRules, treasureFindingHelp } from './explorationHelp';

export const ExplorationHelp = ({ pet, purpose, destination, mode = 'manual', choices, rations }: {
  pet: PetState; purpose?: CommunityRoute; destination?: AdventureDestinationId; mode?: 'manual' | 'idle';
  choices?: readonly AdventureStageChoice[]; rations?: RationQuote;
}) => {
  const sections: HelpContent[] = [];
  if (purpose) {
    const landmark = isLandmarkId(purpose) ? getLandmarkHelp(purpose) : undefined;
    sections.push({ title: landmark?.title ?? '本次任务', overview: <>{landmark?.overview}<p>{adventureJourneyDetail(purpose)}</p></> });
  } else if (destination === 'tutorial') sections.push({ title: '新手踩点', overview: <p>{adventureTutorialRewardText()}</p> });
  if (mode === 'manual') sections.push(getExplorationPreparationHelp(pet));
  sections.push(backpackHelp, getBudgetHelp(pet));
  if (mode === 'manual') sections.push(campHelp, rescueHelp);
  else sections.push(rations ? getRationsHelp(rations) : { title: '挂机配餐', overview: rationRules, details: rationCalculationRules }, treasureFindingHelp);
  const actionHelp = (choices ?? []).map(choice => {
    const preview = getAdventureChoicePreview(pet, choice);
    return preview && choice.check ? getExplorationChoiceHelp(choice.label, preview, choice.check) : getAdventureActionHelp(choice);
  });
  return <HelpButton title="探索" label="探索说明"
    overview={<>{sections.map(section => <section className="exploration-help-section" key={section.title}><h3>{section.title}</h3>{section.overview}</section>)}</>}
    details={<>{sections.filter(section => section.details).map(section => <section className="exploration-help-section" key={section.title}><h3>{section.title}</h3>{section.details}</section>)}{actionHelp.length > 0 && <section className="exploration-help-section"><h3>当前行动的计算详情</h3>{actionHelp.map(content => <details key={content.title}><summary>{content.title}</summary>{content.details ?? content.overview}</details>)}</section>}</>} />;
};
