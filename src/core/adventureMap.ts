import type { AdventureRegionId, AdventureState } from './adventureTypes';
import { activityText as L } from './kitchenRecipes';
import { getAdventureRouteNode } from './valleyQuests';
import { completedLandmark, getLandmarkReason, landmarkNames, landmarkNodes, landmarkRequires } from './landmarkProgress';

export type AdventureNodeId = 'entrance' | 'gather' | 'ridge' | 'crossing' | 'lookout' | 'story' | 'camp' | 'encounter';
export type AdventureNodeStatus = 'available' | 'current' | 'pending' | 'complete' | 'planned' | 'locked';
export const adventureMapNodes: readonly { id: AdventureNodeId; x: number; y: number }[] = [
  { id: 'entrance', x: 14, y: 75 }, { id: 'gather', x: 22, y: 50 },
  { id: 'ridge', x: 41, y: 70 }, { id: 'crossing', x: 45, y: 40 },
  { id: 'lookout', x: 61, y: 59 }, { id: 'story', x: 73, y: 24 },
  { id: 'camp', x: 85, y: 47 }, { id: 'encounter', x: 53, y: 15 },
];
export const adventureMapEdges = landmarkNodes.flatMap(node => landmarkRequires[node].map(previous => [previous, node] as const));
export const adventureMapThemes = {
  valley: { color: '#39745d', pale: '#e8f1df', sky: '#e2f1ec', land: '#bfd4a0' },
  windmill: { color: '#99702f', pale: '#fbf1d7', sky: '#f8eedb', land: '#dfd29b' },
  forest: { color: '#497267', pale: '#e1eee6', sky: '#dce8e8', land: '#9ebcab' },
  coast: { color: '#387b91', pale: '#e0f1f5', sky: '#dbedf5', land: '#d8d4ad' },
  observatory: { color: '#686c9a', pale: '#eceafa', sky: '#dfe3f4', land: '#a8b6c5' },
} satisfies Record<AdventureRegionId, { color: string; pale: string; sky: string; land: string }>;

export const getAdventureMapNames = (region: AdventureRegionId): Record<AdventureNodeId, string> => landmarkNames[region];

// The map uses the same landmark prerequisites as travel and saved progress.
export const getAdventureNodeStatus = (state: AdventureState, region: AdventureRegionId, node: AdventureNodeId, _today?: string): AdventureNodeStatus => {
  if (state.active?.region === region && getAdventureRouteNode(state.active.purpose) === node) return 'current';
  if (state.pending?.region === region && getAdventureRouteNode(state.pending.purpose) === node) return 'pending';
  if (completedLandmark(state, region, node)) return 'complete';
  return getLandmarkReason(state, region, node) ? 'locked' : 'available';
};

export const adventureNodeStatusLabel = (status: AdventureNodeStatus) => ({
  available: L('可以探查', 'Ready to scout'), current: L('正在探查', 'Scouting'),
  pending: L('行囊待领取', 'Bag to collect'), complete: L('已完成', 'Completed'), planned: L('筹备中', 'Coming later'), locked: L('等待前置任务', 'Complete preceding tasks'),
})[status];
