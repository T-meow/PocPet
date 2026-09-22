import { useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import { animalHelp } from '../help/productionHelp';
import { animals, facilities } from '../../core/communityData';
import { careCommunityAnimal, collectCommunityAnimal, feedCommunityAnimal, getRanchDay, claimRanchMilk } from '../../core/communityFarm';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { AnimalId } from '../../core/communityTypes';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import { CommunityProductionScene } from './CommunityProductionScene';
import type { CommunityPanelProps } from './types';
import { timeLeft } from './types';
import { getAnimalCapacity } from '../../core/communityUpgradeData';
import { CommunityUpgradeDialog } from './CommunityUpgradeTask';

const AnimalScene = ({ pet, update, onKitchen, onShop, id, registry, itemIconMap }: CommunityPanelProps & { id: AnimalId }) => {
  const [panel, setPanel] = useState<'care' | 'construction' | null>(null);
  const state = pet.community.animals[id], built = pet.community.facilities[id].built;
  const def = animals[id], free = canSpendCompanionTime(pet), name = facilities[id].name;
  const daily = getRanchDay(pet), capacity = getAnimalCapacity(pet.community, id);
  const status = !built ? '等待建设' : state.stock + 2 > capacity.stock ? '产物已存满' : state.nextAt !== undefined ? '安心生产中' : '等待添饲料';
  const detail = !built ? '交付建材后，小动物就能住进来了。' : state.nextAt !== undefined ? `下一轮 · ${timeLeft(state.nextAt)}` : state.stock + 2 > capacity.stock ? '收获后，有余粮就会继续生产' : '从照料中添一点饲料，开始新的一轮';
  return <>
    <CommunityProductionScene kind={id} title={id === 'coop' ? '小鸡在院子里散步' : '干草香里，慢慢长大'} subtitle={id === 'coop' ? '暖阳下的鸡舍' : '牧场里的牛棚'}
      status={status} detail={detail} supplies={`Lv.${pet.community.upgrades[id]} · 饲料 ${state.feed}/${capacity.feed} · 待收 ${state.stock}/${capacity.stock}${id === 'barn' && daily.cared && daily.collected && !daily.claimed ? ' · 照料窗口有今日牛奶可领' : ''}`}
      harvest={state.stock ? `${def.name} ×${state.stock} · 等你收获` : `${def.name}还在准备中`} ready={state.stock > 0}
      stock={state.stock} feed={state.feed} harvestDisabled={!free || !built || !state.stock}
      onHarvest={() => update(p => collectCommunityAnimal(p, id, state.revision))} onCare={() => setPanel('care')}
      onConstruction={built ? () => setPanel('construction') : undefined} />
    {panel === 'construction' && <CommunityUpgradeDialog pet={pet} update={update} id={id} registry={registry} itemIconMap={itemIconMap} onClose={() => setPanel(null)} />}
    {panel === 'care' && <CommunityDetailDialog title={`照料${name}`} eyebrow="添一点饲料，陪它待一会儿" onClose={() => setPanel(null)}>
      <HelpButton {...animalHelp} />
      {!built ? <p>完成{name}的修复后，就能在这里喂养和收获。</p> : <>
        <div className="community-care-summary"><span>{id === 'coop' ? '🐓' : '🐄'}</span><div><strong>{status}</strong><p>每轮产出 2 份{state.nextAt !== undefined ? ` · 剩余 ${timeLeft(state.nextAt)}` : ''}</p></div></div>
        <section className="community-care-section"><h3>把食槽添满一点</h3><p>食槽 {state.feed}/{capacity.feed} · 饲料库存 {pet.inventory.animal_feed ?? 0}</p><div className="community-actions">
          <button className="primary-button" disabled={!free || state.feed >= capacity.feed || !(pet.inventory.animal_feed ?? 0)} onClick={() => update(p => feedCommunityAnimal(p, id, state.revision))}>添饲料 ×1</button>
          <button className="secondary-button" onClick={onShop}>补充饲料 · 5 金币／份</button>
        </div></section>
        <section className="community-care-section"><h3>陪伴也是照料</h3><p>{state.cared ? '这轮已经照料过了，让它安心等下一次收获。' : '消耗 2 点体力，让这一轮提前 10% 完成。'}{state.nextAt !== undefined ? `下轮还需 ${timeLeft(state.nextAt)}。` : ''}</p>
          <button className="secondary-button" disabled={!free || !state.nextAt || state.cared || pet.energy < 2} onClick={() => update(p => careCommunityAnimal(p, id, state.revision))}>{state.cared ? '本轮已照料' : '照料一下 · 体力 −2'}</button>
        </section>
        <p className="community-care-footnote">待收{def.name} {state.stock}/{capacity.stock} · 仓库 {pet.inventory[def.item] ?? 0} 份</p>
        <button className="text-button" disabled={!free} onClick={() => onKitchen(id === 'coop' ? 'carrot_omelet' : 'milk_custard')}>用收获做{id === 'coop' ? '胡萝卜蛋饼' : '鲜奶蛋羹'}</button>
        {id === 'barn' && <section className="community-care-section"><h3>牧场今日心意 · 任选一瓶</h3><p>照料 {daily.cared ? '✓' : '○'} · 收获 {daily.collected ? '✓' : '○'} · {daily.claimed ? '今天已领取' : '完成后任选'}</p><div className="community-actions">{(['strawberry_milk', 'ad_milk'] as const).map(choice => <button key={choice} className="secondary-button" disabled={!free || !daily.cared || !daily.collected || daily.claimed || (pet.inventory[choice] ?? 0) >= 9999} onClick={() => update(p => claimRanchMilk(p, choice))}>{choice === 'ad_milk' ? 'AD 高钙奶' : '草莓牛奶'} ×1</button>)}</div><button className="text-button" onClick={() => onKitchen()}>去厨房加工奶制品</button></section>}
      </>}
    </CommunityDetailDialog>}
  </>;
};

export const CommunityFarm = ({ only, ...props }: CommunityPanelProps & { only?: AnimalId }) => <>
  {(only ? [only] : ['coop', 'barn'] as const).map(id => <AnimalScene key={id} {...props} id={id} />)}
</>;
