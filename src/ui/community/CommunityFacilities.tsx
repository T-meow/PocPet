import { facilities, facilityIds, facilityStories, getFacilityBuildReason } from '../../core/communityData';
import { buildCommunityFacility } from '../../core/communityFacilities';
import { getValleyQuestReason } from '../../core/valleyQuests';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { CommunityPanelProps } from './types';
import type { FacilityId } from '../../core/communityTypes';

export const CommunityFacilities = ({ pet, update, onExplore, onShop, onAdventure, only }: CommunityPanelProps & { only?: FacilityId }) => <div className="community-facilities">{(only ? [only] : facilityIds).map(id => {
  const state = pet.community.facilities[id], def = facilities[id], story = facilityStories[id], reason = getFacilityBuildReason(pet, id), free = !pet.timePause && canSpendCompanionTime(pet);
  const storyDone = pet.adventure.valleyCompleted.includes(story.id), storyReason = getValleyQuestReason(pet.adventure, story.id);
  const affordable = pet.coins >= def.coins && (pet.inventory.community_wood ?? 0) >= def.wood && (pet.inventory.community_stone ?? 0) >= def.stone;
  return <section className="community-card community-facility" data-built={state.built} key={id}>
    <div className="community-section-heading"><span className="community-building-glyph" aria-hidden="true">{{ coop: '🐓', barn: '🐄', fishing_hut: '🎣', upstream: '🏞️', stall: '🧺' }[id]}</span><h3>{def.name}</h3><span className="community-tag">{state.built ? '已开放' : storyDone ? '待建设' : '等待剧情'}</span></div>
    <p>{def.benefit}。</p>{state.built ? <p className="community-note">建设永久保留，无离线损坏和维护费。</p> : <>
      <p>溪谷故事「{story.name}」{storyDone ? '已完成' : '待完成'}。{def.requires ? `建设前置：${def.requires === 'garden' ? '社区菜地' : facilities[def.requires].name}。` : id === 'stall' ? '建设前置：菜地或钓鱼小屋。' : ''}</p>
      <p>一次交付：金币 {pet.coins}/{def.coins} · 木料 {pet.inventory.community_wood ?? 0}/{def.wood} · 石料 {pet.inventory.community_stone ?? 0}/{def.stone}</p>
      {reason && <p className="community-note">{reason}</p>}
      <div className="community-actions">
        {!storyDone && <button className="secondary-button" disabled={!free || Boolean(pet.adventure.pending) || Boolean(storyReason) && !onAdventure} onClick={() => storyReason ? onAdventure?.() : onExplore(story.id)}>{storyReason ? '查看溪谷剧情进度' : `前往「${story.name}」`}</button>}
        <button className="primary-button" disabled={Boolean(reason) || !free || !affordable} onClick={() => update(p => buildCommunityFacility(p, id))}>交付材料，开放{def.name}</button>
        {!affordable && <button className="text-button" onClick={onShop}>补充建材</button>}
      </div>
    </>}
  </section>;
})}</div>;
