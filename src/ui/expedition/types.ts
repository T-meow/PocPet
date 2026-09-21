import type { PetState } from '../../core/petTypes';
import type { RecipeId } from '../../core/companionActivityTypes';
export interface ExpeditionProps {
  pet: PetState; portrait: string; actorId: string; actorName: string;
  update: (action: (pet: PetState) => PetState) => void;
  onCommunity: () => void; onKitchen: (recipe?: RecipeId) => void; onShop: () => void;
  onStory?: (quest?: import('../../core/valleyQuests').ValleyQuestId) => void;
  initialTarget?: import('../../core/valleyExplorationData').ValleyGatherTarget;
}
