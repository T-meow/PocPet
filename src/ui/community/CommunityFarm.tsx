import { animals, facilities } from '../../core/communityData';
import { careCommunityAnimal, collectCommunityAnimal, feedCommunityAnimal } from '../../core/communityFarm';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { CommunityPanelProps } from './types';
import { timeLeft } from './types';
import type { AnimalId } from '../../core/communityTypes';
export const CommunityFarm = ({ pet, update, onKitchen, onShop, only }: CommunityPanelProps & { only?: AnimalId }) => <>
  {(!only || pet.community.facilities[only].built) && <section className="community-card"><h3>饲料与收获</h3><p>缺料或存满时暂停，离线不会失去动物。先添饲料，再留一点收获给厨房与邻里。</p><button className="text-button" onClick={onShop}>购买谷物饲料 · 5 金币／份</button></section>}
  {(only ? [only] : ['coop', 'barn'] as const).map(id => {
    const state = pet.community.animals[id], built = pet.community.facilities[id].built, def = animals[id], free = canSpendCompanionTime(pet);
    return <section className="community-card" key={id}><div className="community-section-heading"><h3>{id === 'coop' ? '🐓' : '🐄'} {facilities[id].name}</h3><span className="community-tag">{!built ? '建设后开放' : state.stock >= 6 ? '存满暂停' : state.feed ? '生产中' : '等待饲料'}</span></div>
      {!built ? <p>到“社区建设”寻找线索并完成修复后开放。</p> : <><div className="community-production"><div><b>{state.feed}/3</b><small>已投入饲料</small></div><div><b>{state.stock}/6</b><small>待收{def.name}</small></div><div><b>{pet.inventory[def.item] ?? 0}</b><small>仓库{def.name}</small></div></div>
        <p>每轮产 2 份，基础 {def.hours} 小时。{pet.partnerSchedule.skills.garden.level >= 10 ? '园艺满级，周期缩短 8%。' : ''}{state.nextAt !== undefined ? `下轮还需 ${timeLeft(state.nextAt)}。` : '收走产物并有余粮后继续生产。'}</p>
        <div className="community-actions"><button className="secondary-button" disabled={!free || state.feed >= 3 || !(pet.inventory.animal_feed ?? 0)} onClick={() => update(p => feedCommunityAnimal(p, id, state.revision))}>添饲料 ×1（库存 {pet.inventory.animal_feed ?? 0}）</button><button className="secondary-button" disabled={!free || !state.nextAt || state.cared || pet.energy < 2} onClick={() => update(p => careCommunityAnimal(p, id, state.revision))}>{state.cared ? '本轮已照料' : '照料 · 体力 −2，提前 10%'}</button><button className="primary-button" disabled={!free || !state.stock} onClick={() => update(p => collectCommunityAnimal(p, id, state.revision))}>收取{def.name} ×{state.stock}</button></div>
        <button className="text-button" disabled={!free} onClick={() => onKitchen(id === 'coop' ? 'carrot_omelet' : 'milk_custard')}>用收获做{id === 'coop' ? '胡萝卜蛋饼' : '鲜奶蛋羹'}</button>
      </>}
    </section>;
  })}
</>;
