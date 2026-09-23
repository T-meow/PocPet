import type { ProjectId } from './core/expeditionTypes';
import riverside from './assets/story/community-riverside.webp';
import exhibition from './assets/story/community-exhibition.webp';
import observatory from './assets/story/community-observatory.webp';

// Only approved artwork belongs in the runtime asset registry.
export const communityProjectArtwork: Record<ProjectId, string> = { riverside, exhibition, observatory };
