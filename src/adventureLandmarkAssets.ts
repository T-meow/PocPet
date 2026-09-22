import type { AdventureNodeId } from './core/adventureMap';
import type { AdventureRegionId } from './core/adventureTypes';
import type { RegionId } from './core/expeditionTypes';
import valley_entrance from './assets/facilities/valley_entrance.webp';
import valley_gather from './assets/facilities/valley_gather.webp';
import valley_ridge from './assets/facilities/valley_ridge.webp';
import valley_crossing from './assets/facilities/valley_crossing.webp';
import valley_lookout from './assets/facilities/valley_lookout.webp';
import valley_story from './assets/facilities/valley_story.webp';
import valley_camp from './assets/facilities/valley_camp.webp';
import valley_encounter from './assets/facilities/valley_encounter.webp';
import windmill_entrance from './assets/facilities/windmill_entrance.webp';
import windmill_gather from './assets/facilities/windmill_gather.webp';
import windmill_ridge from './assets/facilities/windmill_ridge.webp';
import windmill_crossing from './assets/facilities/windmill_crossing.webp';
import windmill_lookout from './assets/facilities/windmill_lookout.webp';
import windmill_story from './assets/facilities/windmill_story.webp';
import windmill_camp from './assets/facilities/windmill_camp.webp';
import windmill_encounter from './assets/facilities/windmill_encounter.webp';
import forest_entrance from './assets/facilities/forest_entrance.webp';
import forest_gather from './assets/facilities/forest_gather.webp';
import forest_ridge from './assets/facilities/forest_ridge.webp';
import forest_crossing from './assets/facilities/forest_crossing.webp';
import forest_lookout from './assets/facilities/forest_lookout.webp';
import forest_story from './assets/facilities/forest_story.webp';
import forest_camp from './assets/facilities/forest_camp.webp';
import forest_encounter from './assets/facilities/forest_encounter.webp';
import coast_entrance from './assets/facilities/coast_entrance.webp';
import coast_gather from './assets/facilities/coast_gather.webp';
import coast_ridge from './assets/facilities/coast_ridge.webp';
import coast_crossing from './assets/facilities/coast_crossing.webp';
import coast_lookout from './assets/facilities/coast_lookout.webp';
import coast_story from './assets/facilities/coast_story.webp';
import coast_camp from './assets/facilities/coast_camp.webp';
import coast_encounter from './assets/facilities/coast_encounter.webp';
import observatory_entrance from './assets/facilities/observatory_entrance.webp';
import observatory_gather from './assets/facilities/observatory_gather.webp';
import observatory_ridge from './assets/facilities/observatory_ridge.webp';
import observatory_crossing from './assets/facilities/observatory_crossing.webp';
import observatory_lookout from './assets/facilities/observatory_lookout.webp';
import observatory_story from './assets/facilities/observatory_story.webp';
import observatory_camp from './assets/facilities/observatory_camp.webp';
import observatory_encounter from './assets/facilities/observatory_encounter.webp';

export const adventureLandmarkIcons = {
  valley: {
    entrance: valley_entrance,
    gather: valley_gather,
    ridge: valley_ridge,
    crossing: valley_crossing,
    lookout: valley_lookout,
    story: valley_story,
    camp: valley_camp,
    encounter: valley_encounter,
  },
  windmill: {
    entrance: windmill_entrance,
    gather: windmill_gather,
    ridge: windmill_ridge,
    crossing: windmill_crossing,
    lookout: windmill_lookout,
    story: windmill_story,
    camp: windmill_camp,
    encounter: windmill_encounter,
  },
  forest: {
    entrance: forest_entrance,
    gather: forest_gather,
    ridge: forest_ridge,
    crossing: forest_crossing,
    lookout: forest_lookout,
    story: forest_story,
    camp: forest_camp,
    encounter: forest_encounter,
  },
  coast: {
    entrance: coast_entrance,
    gather: coast_gather,
    ridge: coast_ridge,
    crossing: coast_crossing,
    lookout: coast_lookout,
    story: coast_story,
    camp: coast_camp,
    encounter: coast_encounter,
  },
  observatory: {
    entrance: observatory_entrance,
    gather: observatory_gather,
    ridge: observatory_ridge,
    crossing: observatory_crossing,
    lookout: observatory_lookout,
    story: observatory_story,
    camp: observatory_camp,
    encounter: observatory_encounter,
  },
} satisfies Record<AdventureRegionId, Record<AdventureNodeId, string>>;

export const expeditionLandmarkIcons = {
  valley: adventureLandmarkIcons.valley,
  hills: adventureLandmarkIcons.windmill,
  forest: adventureLandmarkIcons.forest,
  coast: adventureLandmarkIcons.coast,
  station: adventureLandmarkIcons.observatory,
} satisfies Record<RegionId, Record<AdventureNodeId, string>>;
