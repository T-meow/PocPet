import { facilities, facilityAvailable, facilityIds } from '../../core/communityData';
import { buildCommunityFacility, workCommunityFacility } from '../../core/communityFacilities';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { CommunityPanelProps } from './types';
import type { FacilityId } from '../../core/communityTypes';

export const CommunityFacilities = ({ pet, update, onExplore, onShop, only }: CommunityPanelProps & { only?: FacilityId }) => <div className="community-facilities">{(only ? [only] : facilityIds).map(id => {
  const state = pet.community.facilities[id], def = facilities[id], available = facilityAvailable(pet, id), free = canSpendCompanionTime(pet);
  const affordable = pet.coins >= def.coins && (pet.inventory.community_wood ?? 0) >= def.wood && (pet.inventory.community_stone ?? 0) >= def.stone;
  return <section className="community-card community-facility" data-built={state.built} key={id}>
    <div className="community-section-heading"><span className="community-building-glyph" aria-hidden="true">{{ coop: '🐓', barn: '🐄', fishing_hut: '🎣', upstream: '🏞️', stall: '🧺' }[id]}</span><h3>{def.name}</h3><span className="community-tag">{state.built ? '已开放' : '等待修复'}</span></div>
    <p>{def.benefit}。</p>{state.built ? <p className="community-note">建设永久保留，无离线损坏和维护费。</p> : <>
      <p className="community-muted">线索：{def.clue}。{def.requires ? `前置：${def.requires === 'garden' ? '社区菜地' : facilities[def.requires].name}。` : id === 'stall' ? '前置：菜地或钓鱼小屋。' : '与菜地独立起步。'}</p>
      <ol className="community-steps"><li data-done={state.found}><span>{state.found ? '✓' : '○'}</span>溪谷定向搜寻，永久记录线索</li><li data-done={state.work >= 2}><span>{state.work >= 2 ? '✓' : '○'}</span>{def.jobs.join('、')}（{state.work}/2）</li><li><span>○</span>{def.coins} 金币 · 木料 {def.wood} · 石料 {def.stone}</li></ol>
      {!state.found ? <button className="primary-button" disabled={!available || !free || Boolean(pet.adventure.pending) || !(pet.adventure.completed.tutorial ?? 0)} onClick={() => onExplore(id)}>{available ? '去溪谷寻找线索' : '先完成前置建设'}</button>
        : state.work < 2 ? <><p>本步饱食 −4、体力 −4，并增加园艺练习经验。</p><button className="primary-button" disabled={!available || !free || pet.hunger < 4 || pet.energy < 4} onClick={() => update(p => workCommunityFacility(p, id, state.work))}>{def.jobs[state.work]}</button></>
          : <><p>持有：木料 {pet.inventory.community_wood ?? 0} · 石料 {pet.inventory.community_stone ?? 0}</p><button className="primary-button" disabled={!available || !free || !affordable} onClick={() => update(p => buildCommunityFacility(p, id))}>投入材料，开放{def.name}</button>{!affordable && <button className="text-button" onClick={onShop}>去补充建材</button>}</>}
    </>}
  </section>;
})}</div>;
