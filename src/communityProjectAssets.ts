import type { ProjectId } from './core/expeditionTypes';
import riverside from './assets/story/community-riverside.webp';
import exhibition from './assets/story/community-exhibition.webp';
import observatory from './assets/story/community-observatory.webp';
import valley from './assets/story/gathering-valley.webp';
import windmill from './assets/story/gathering-windmill.webp';
import forest from './assets/story/gathering-forest.webp';
import coast from './assets/story/gathering-coast.webp';
import station from './assets/story/gathering-station.webp';
import spring from './assets/story/gathering-spring.webp';
import summer from './assets/story/gathering-summer.webp';
import autumn from './assets/story/gathering-autumn.webp';
import winter from './assets/story/gathering-winter.webp';
import reunionOpening from './assets/story/spring-reunion-opening.webp';
import reunionEnding from './assets/story/spring-reunion-ending.webp';
import type { GatheringSeason } from './core/gatheringSeasons';

// Only approved artwork belongs in the runtime asset registry.
export const communityProjectArtwork: Record<ProjectId, string> = { riverside, exhibition, observatory };
export const gatheringArtwork: Record<string, string> = { 'community-riverside': riverside, 'community-exhibition': exhibition, 'community-observatory': observatory, 'gathering-valley': valley, 'gathering-windmill': windmill, 'gathering-forest': forest, 'gathering-coast': coast, 'gathering-station': station, 'gathering-spring': spring, 'gathering-summer': summer, 'gathering-autumn': autumn, 'gathering-winter': winter };
export const seasonalGatheringArtwork: Record<GatheringSeason, string> = { spring, summer, autumn, winter };
export const springReunionArtwork = { opening: reunionOpening, ending: reunionEnding };
