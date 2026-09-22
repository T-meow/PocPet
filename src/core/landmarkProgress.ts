import type { AdventureRegionId, AdventureState } from './adventureTypes';
import type { RegionId } from './expeditionTypes';
import type { PetState } from './petTypes';

export const landmarkNodes = ['entrance', 'gather', 'ridge', 'crossing', 'lookout', 'story', 'encounter', 'camp'] as const;
export type LandmarkNode = typeof landmarkNodes[number];
export type LandmarkId = `landmark:${AdventureRegionId}:${LandmarkNode}`;
export const mapRegions: AdventureRegionId[] = ['valley', 'windmill', 'forest', 'coast', 'observatory'];
export const expeditionRegionForMap: Record<AdventureRegionId, RegionId> = { valley: 'valley', windmill: 'hills', forest: 'forest', coast: 'coast', observatory: 'station' };
export const mapRegionForExpedition: Record<RegionId, AdventureRegionId> = { valley: 'valley', hills: 'windmill', forest: 'forest', coast: 'coast', station: 'observatory' };
export const regionNames: Record<AdventureRegionId, string> = { valley: '溪谷', windmill: '风车山丘', forest: '雾松林地', coast: '潮汐海岸', observatory: '旧观测站' };
export const landmarkNames: Record<AdventureRegionId, Record<LandmarkNode, string>> = {
  valley: { entrance: '溪谷入口', gather: '溪边采集地', ridge: '青苔坡道', crossing: '旧木桥', lookout: '风声观景台', story: '旧温室', encounter: '石芽遭遇地', camp: '温室休息间' },
  windmill: { entrance: '山丘路口', gather: '香草花田', ridge: '风向坡道', crossing: '风车木栈桥', lookout: '金色瞭望台', story: '老风车', encounter: '风团遭遇地', camp: '避风小营地' },
  forest: { entrance: '松林入口', gather: '林莓丛', ridge: '足迹小径', crossing: '古树栈道', lookout: '树梢观察台', story: '空心古树', encounter: '苔石遭遇地', camp: '林间守望小屋' },
  coast: { entrance: '沙滩入口', gather: '潮池', ridge: '贝壳坡道', crossing: '旧栈桥', lookout: '听浪观景台', story: '潮汐洞穴', encounter: '贝壳遭遇地', camp: '海边旧船屋' },
  observatory: { entrance: '山顶入口', gather: '碎片采集地', ridge: '符号坡道', crossing: '悬空连桥', lookout: '星空观景台', story: '旧观测穹顶', encounter: '星石遭遇地', camp: '观测站值班室' },
};
export const landmarkRequires: Record<LandmarkNode, LandmarkNode[]> = { entrance: [], gather: ['entrance'], ridge: ['entrance'], crossing: ['gather', 'ridge'], lookout: ['crossing'], story: ['crossing'], encounter: ['lookout', 'story'], camp: ['encounter'] };
export const landmarkId = (region: AdventureRegionId, node: LandmarkNode): LandmarkId => `landmark:${region}:${node}`;
export const isLandmarkId = (id: unknown): id is LandmarkId => typeof id === 'string' && mapRegions.some(region => landmarkNodes.some(node => id === landmarkId(region, node)));
export const parseLandmarkId = (id: LandmarkId) => { const [, region, node] = id.split(':'); return { region: region as AdventureRegionId, node: node as LandmarkNode }; };
export const completedLandmark = (state: AdventureState, region: AdventureRegionId, node: LandmarkNode) => state.landmarks.includes(landmarkId(region, node));
export const completedChapter = (state: AdventureState, region: AdventureRegionId) => landmarkNodes.every(node => completedLandmark(state, region, node));
export const getRegionUnlockReason = (state: AdventureState, region: AdventureRegionId) => {
  if (!(state.completed.tutorial ?? 0)) return '先完成并结算 4 阶段新手踩点。';
  const required: AdventureRegionId[] = region === 'valley' ? [] : region === 'windmill' ? ['valley'] : region === 'observatory' ? ['forest', 'coast'] : ['windmill'];
  const missing = required.filter(id => !completedChapter(state, id));
  return missing.length ? `先完成${missing.map(id => regionNames[id]).join('与')}的全部 8 个地标。` : '';
};
export const getLandmarkReason = (state: AdventureState, region: AdventureRegionId, node: LandmarkNode) => {
  const reason = getRegionUnlockReason(state, region);
  if (reason) return reason;
  if (completedLandmark(state, region, node)) return '';
  const missing = landmarkRequires[node].filter(id => !completedLandmark(state, region, id));
  return missing.length ? `先完成「${missing.map(id => landmarkNames[region][id]).join('」「')}」。` : '';
};
export const legacyPurposeLandmark = (purpose?: string): LandmarkId => isLandmarkId(purpose) ? purpose : landmarkId('valley',
  purpose?.startsWith('valley_') && landmarkNodes.includes(purpose.slice(7) as LandmarkNode) ? purpose.slice(7) as LandmarkNode
    : purpose === 'irrigation' || purpose === 'seeds' ? 'gather' : purpose === 'coop' || purpose === 'barn' ? 'ridge' : purpose === 'upstream' ? 'lookout' : purpose === 'stall' ? 'story' : purpose ? 'crossing' : 'entrance');
export const nextLandmarks = (state: AdventureState) => mapRegions.flatMap(region => landmarkNodes.filter(node => !completedLandmark(state, region, node) && !getLandmarkReason(state, region, node)).map(node => ({ region, node, id: landmarkId(region, node), name: landmarkNames[region][node] })));
export const mainStoryProgress = (state: AdventureState) => ({ completed: state.landmarks.length, total: 40, chapters: mapRegions.filter(region => completedChapter(state, region)).length, next: nextLandmarks(state) });

// Only the old schema takes this path. Repeated normalization never grants new progress or rewards.
export const migrateLandmarks = (adventure: AdventureState, pet: Pick<PetState, 'community'>, legacy: boolean): AdventureState => {
  if (!legacy) return adventure;
  const completed = new Set(adventure.landmarks);
  for (const region of mapRegions) {
    const progress = pet.community.expedition.regions[expeditionRegionForMap[region]];
    if (progress.surveyed) for (const node of landmarkNodes) completed.add(landmarkId(region, node));
  }
  if (adventure.completed.valley) completed.add(landmarkId('valley', 'entrance'));
  for (const quest of adventure.valleyCompleted) completed.add(legacyPurposeLandmark(quest));
  return { ...adventure, landmarks: [...completed] };
};
