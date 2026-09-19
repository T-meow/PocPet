import { getAdventureRegions } from './adventureData';
import type { AdventureRegionId, AdventureState } from './adventureTypes';
import { activityText as L } from './kitchenRecipes';
import { isAdventureEntranceCompleteForDay, isAdventureMapUnlocked } from './adventureState';
import { getAdventureRouteNode, getValleyQuestReason, valleyQuestForNode } from './valleyQuests';

export type AdventureNodeId = 'entrance' | 'gather' | 'ridge' | 'crossing' | 'lookout' | 'story' | 'camp' | 'encounter';
export type AdventureNodeStatus = 'available' | 'current' | 'pending' | 'complete' | 'planned' | 'locked';
export const adventureMapNodes: readonly { id: AdventureNodeId; x: number; y: number }[] = [
  { id: 'entrance', x: 14, y: 75 }, { id: 'gather', x: 22, y: 50 },
  { id: 'ridge', x: 41, y: 70 }, { id: 'crossing', x: 45, y: 40 },
  { id: 'lookout', x: 61, y: 59 }, { id: 'story', x: 73, y: 24 },
  { id: 'camp', x: 85, y: 47 }, { id: 'encounter', x: 53, y: 15 },
];
export const adventureMapEdges: readonly (readonly [AdventureNodeId, AdventureNodeId])[] = [
  ['entrance', 'gather'], ['entrance', 'ridge'], ['gather', 'crossing'], ['ridge', 'crossing'],
  ['crossing', 'lookout'], ['crossing', 'story'], ['lookout', 'encounter'],
  ['story', 'encounter'], ['encounter', 'camp'],
];
export const adventureMapThemes = {
  valley: { color: '#39745d', pale: '#e8f1df', sky: '#e2f1ec', land: '#bfd4a0' },
  windmill: { color: '#99702f', pale: '#fbf1d7', sky: '#f8eedb', land: '#dfd29b' },
  forest: { color: '#497267', pale: '#e1eee6', sky: '#dce8e8', land: '#9ebcab' },
  coast: { color: '#387b91', pale: '#e0f1f5', sky: '#dbedf5', land: '#d8d4ad' },
  observatory: { color: '#686c9a', pale: '#eceafa', sky: '#dfe3f4', land: '#a8b6c5' },
} satisfies Record<AdventureRegionId, { color: string; pale: string; sky: string; land: string }>;

export const getAdventureMapNames = (region: AdventureRegionId): Record<AdventureNodeId, string> => {
  const names: Record<AdventureRegionId, string[]> = {
    valley: [L('溪谷入口', 'Valley entrance'), L('溪边采集地', 'Creekside gathering'), L('青苔坡道', 'Mossy slope'), L('旧木桥', 'Old footbridge'), L('风声观景台', 'Wind lookout'), L('旧温室', 'Old greenhouse'), L('温室休息间', 'Greenhouse rest room'), L('石芽遭遇地', 'Stonebud encounter')],
    windmill: [L('山丘路口', 'Hill entrance'), L('香草花田', 'Herb meadow'), L('风向坡道', 'Windward slope'), L('风车木栈桥', 'Windmill bridge'), L('金色瞭望台', 'Golden lookout'), L('老风车', 'Old windmill'), L('避风小营地', 'Sheltered camp'), L('风团遭遇地', 'Wind encounter')],
    forest: [L('松林入口', 'Pine entrance'), L('林莓丛', 'Woodland berries'), L('足迹小径', 'Footprint trail'), L('古树栈道', 'Ancient tree walkway'), L('树梢观察台', 'Treetop lookout'), L('空心古树', 'Hollow ancient tree'), L('林间守望小屋', 'Woodland cabin'), L('苔石遭遇地', 'Mossrock encounter')],
    coast: [L('沙滩入口', 'Beach entrance'), L('潮池', 'Tide pools'), L('贝壳坡道', 'Shell slope'), L('旧栈桥', 'Old pier'), L('听浪观景台', 'Wave lookout'), L('潮汐洞穴', 'Tidal cave'), L('海边旧船屋', 'Old boathouse'), L('贝壳遭遇地', 'Seashell encounter')],
    observatory: [L('山顶入口', 'Summit entrance'), L('碎片采集地', 'Fragment gathering'), L('符号坡道', 'Symbol slope'), L('悬空连桥', 'Suspended bridge'), L('星空观景台', 'Stargazing lookout'), L('旧观测穹顶', 'Old observatory dome'), L('观测站值班室', 'Observatory rest room'), L('星石遭遇地', 'Starstone encounter')],
  };
  return Object.fromEntries(adventureMapNodes.map((node, index) => [node.id, names[region][index]])) as Record<AdventureNodeId, string>;
};

// Entrance events and the seven permanent story tasks have independent progress.
export const getAdventureNodeStatus = (state: AdventureState, region: AdventureRegionId, node: AdventureNodeId, today?: string): AdventureNodeStatus => {
  if (!isAdventureMapUnlocked(state)) return 'locked';
  if (!getAdventureRegions().some(entry => entry.id === region && entry.open)) return 'planned';
  if (state.active?.region === region && getAdventureRouteNode(state.active.purpose) === node) return 'current';
  if (state.pending?.region === region && getAdventureRouteNode(state.pending.purpose) === node) return 'pending';
  const quest = valleyQuestForNode(node);
  if (quest) return state.valleyCompleted.includes(quest) ? 'complete' : getValleyQuestReason(state, quest) ? 'locked' : 'available';
  if (isAdventureEntranceCompleteForDay(state, region, today)) return 'complete';
  return 'available';
};

export const adventureNodeStatusLabel = (status: AdventureNodeStatus) => ({
  available: L('可以探查', 'Ready to scout'), current: L('正在探查', 'Scouting'),
  pending: L('行囊待领取', 'Bag to collect'), complete: L('已完成', 'Completed'), planned: L('筹备中', 'Coming later'), locked: L('等待前置任务', 'Complete preceding tasks'),
})[status];
