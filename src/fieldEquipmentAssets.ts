import { newItemIcons } from './newItemIconAssets';
import type { FieldEquipmentId } from './core/fieldEquipmentData';
import { regionalTreasureIds, type RegionalTreasureId } from './core/regionalTreasures';

export const fieldEquipmentIcons: Record<FieldEquipmentId, string> = {
  field_watering_can: newItemIcons.field_watering_can,
  harvest_sickle: newItemIcons.harvest_sickle,
  nutrient_compost: newItemIcons.nutrient_compost,
  fishing_float: newItemIcons.fishing_float,
  landing_net: newItemIcons.landing_net,
  prospector_pick: newItemIcons.prospector_pick,
  survey_lens: newItemIcons.survey_lens,
  camp_kit: newItemIcons.camp_kit,
};
export const regionalTreasureIcons = Object.fromEntries(regionalTreasureIds.map(id => [id,
  newItemIcons[id],
])) as Record<RegionalTreasureId, string>;
