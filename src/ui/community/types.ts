import type { ItemRegistry, PetState } from '../../core/petTypes';
import type { CommunityRoute } from '../../core/communityTypes';
import type { RecipeId } from '../../core/companionActivityTypes';
export interface CommunityPanelProps {
  pet: PetState; update: (action: (pet: PetState) => PetState) => void;
  registry?: ItemRegistry;
  itemIconMap?: Partial<Record<string, string>>;
  onAdventure?: () => void;
  onOpenOutpost?: (request: import('../outpostNavigation').OutpostRequest) => void;
  onExplore: (purpose: CommunityRoute) => void; onShop: () => void; onKitchen: (recipe?: RecipeId) => void;
}
export const timeLeft = (at: number, now = Date.now()) => {
  const minutes = Math.max(0, Math.ceil((at - now) / 60000));
  return minutes ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : '已就绪';
};
