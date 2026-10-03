import { useId, useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import { animalHelp } from '../help/productionHelp';
import { animalNameMaxLength, animals, facilities, normalizeAnimalName, ranchCompostCycleCount } from '../../core/communityData';
import { careCommunityAnimal, collectCommunityAnimal, collectRanchCompost, feedCommunityAnimal, getAnimalHarvestHearts, getRanchCompost, getRanchDay, claimRanchMilk, renameCommunityAnimal } from '../../core/communityFarm';
import { canSpendCompanionTime } from '../../core/kitchen';
import { getProcessingLimit, processFood, processingRecipes } from '../../core/foodProcessing';
import { inventoryItemLimit } from '../../core/saveMetadata';
import type { AnimalId } from '../../core/communityTypes';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import { CommunityProductionScene } from './CommunityProductionScene';
import type { CommunityPanelProps } from './types';
import { timeLeft } from './types';
import { getAnimalCapacity } from '../../core/communityUpgradeData';
import { CommunityUpgradeDialog } from './CommunityUpgradeTask';

const feedRecipes = processingRecipes.filter(recipe => recipe.output === 'animal_feed');

const AnimalScene = ({ pet, update, onKitchen, onShop, id, registry, itemIconMap }: CommunityPanelProps & { id: AnimalId }) => {
  const [panel, setPanel] = useState<'care' | 'construction' | null>(null);
  const [naming, setNaming] = useState(false), [draftName, setDraftName] = useState('');
  const nameInputId = useId();
  const state = pet.community.animals[id], built = pet.community.facilities[id].built;
  const def = animals[id], free = !pet.timePause && canSpendCompanionTime(pet), name = facilities[id].name;
  const defaultName = id === 'coop' ? '小鸡' : '奶牛', animalName = state.name || defaultName;
  const daily = getRanchDay(pet), capacity = getAnimalCapacity(pet.community, id);
  const feedQuantity = Math.max(0, Math.min(capacity.feed - state.feed, pet.inventory.animal_feed ?? 0));
  const compost = getRanchCompost(pet), compostStock = pet.inventory.nutrient_compost ?? 0;
  const compostQuantity = Math.max(0, Math.min(compost.ready, inventoryItemLimit - compostStock));
  const processingRevision = pet.community.processing.revision;
  const normalizedName = normalizeAnimalName(draftName);
  const nameTooLong = Array.from(draftName.trim()).length > animalNameMaxLength;
  const openNaming = () => { setDraftName(state.name ?? ''); setNaming(true); };
  const itemName = (item: string) => registry?.get(item)?.name ?? (item === 'wheat' ? '小麦' : item === 'sweet_corn' ? '甜玉米' : item);
  const status = !built ? '等待建设' : state.stock + 2 > capacity.stock ? '产物已存满' : state.nextAt !== undefined ? '安心生产中' : '等待添饲料';
  const detail = !built ? '交付建材后，小动物就能住进来了。' : state.nextAt !== undefined ? `下一轮 · ${timeLeft(state.nextAt)}` : state.stock + 2 > capacity.stock ? '收获后，有余粮就会继续生产' : '从照料中添一点饲料，开始新的一轮';
  return <>
    {built && <div className="community-animal-name-bar"><span className="community-animal-name-word">{id === 'coop' ? '鸡群' : '奶牛'} · {animalName}</span><button type="button" className="secondary-button" aria-haspopup="dialog" onClick={openNaming}>{state.name ? '改名' : '起名'}</button></div>}
    <CommunityProductionScene kind={id} title={id === 'coop' ? `${animalName}在院子里散步` : state.name ? `${animalName}在牧场里等你` : '干草香里，慢慢长大'} subtitle={id === 'coop' ? '暖阳下的鸡舍' : '牧场里的牛棚'}
      status={status} detail={detail} supplies={`Lv.${pet.community.upgrades[id]} · 饲料 ${state.feed}/${capacity.feed} · 待收 ${state.stock}/${capacity.stock}${compost.ready ? ` · 牧场堆肥待领 ${compost.ready}` : ''}${id === 'barn' && daily.cared && daily.collected && !daily.claimed ? ' · 照料窗口有今日牛奶可领' : ''}`}
      harvest={state.stock ? `${def.name} ×${state.stock} · ${getAnimalHarvestHearts(id, state.stock)} 心心` : `${def.name}还在准备中`} ready={state.stock > 0}
      stock={state.stock} feed={state.feed} harvestDisabled={!free || !built || !state.stock}
      onHarvest={() => update(p => collectCommunityAnimal(p, id, state.revision))} onCare={() => setPanel('care')}
      onConstruction={built ? () => setPanel('construction') : undefined} />
    {panel === 'construction' && <CommunityUpgradeDialog pet={pet} update={update} id={id} registry={registry} itemIconMap={itemIconMap} onClose={() => setPanel(null)} />}
    {panel === 'care' && <CommunityDetailDialog title={`照料${name}`} eyebrow="添一点饲料，陪它待一会儿" onClose={() => setPanel(null)}>
      <HelpButton {...animalHelp} />
      {!built ? <p>完成{name}的修复后，就能在这里喂养和收获。</p> : <>
        <div className="community-care-summary"><span>{id === 'coop' ? '🐓' : '🐄'}</span><div><strong className="community-animal-name-word">{animalName} · {status}</strong><p>每轮产出 2 份 · {getAnimalHarvestHearts(id, 2)} 心心{state.nextAt !== undefined ? ` · 剩余 ${timeLeft(state.nextAt)}` : ''}</p><button type="button" className="text-button" aria-haspopup="dialog" onClick={openNaming}>{state.name ? '改个名字' : `给${id === 'coop' ? '鸡群' : '奶牛'}起名`}</button></div></div>
        <section className="community-care-section"><h3>把食槽添满一点</h3><p>食槽 {state.feed}/{capacity.feed} · 饲料库存 {pet.inventory.animal_feed ?? 0}</p><div className="community-actions">
          <button className="primary-button" disabled={!free || state.feed >= capacity.feed || !(pet.inventory.animal_feed ?? 0)} onClick={() => update(p => feedCommunityAnimal(p, id, state.revision))}>添饲料 ×1</button>
          <button className="secondary-button" disabled={!free || !feedQuantity} onClick={() => update(p => feedCommunityAnimal(p, id, state.revision, feedQuantity))}>{feedQuantity && feedQuantity < capacity.feed - state.feed ? '添入全部' : '添满食槽'}{feedQuantity ? ` ×${feedQuantity}` : ''}</button>
          <button className="secondary-button" onClick={onShop}>补充饲料 · 5 金币／份</button>
        </div></section>
        <section className="community-care-section"><h3>把作物变成饲料</h3><p>收获的小麦或甜玉米可以免费制成饲料，先放入仓库，再添进食槽。</p><div className="community-actions">{feedRecipes.map(recipe => <button key={recipe.id} className="secondary-button" disabled={!free || !getProcessingLimit(pet, recipe.id)} onClick={() => update(p => processFood(p, recipe.id, 1, processingRevision))}>{Object.entries(recipe.inputs).map(([item, count]) => `${itemName(item)} ×${count}`).join('、')} → 饲料 ×{recipe.quantity}</button>)}</div><p>小麦库存 {pet.inventory.wheat ?? 0} · 甜玉米库存 {pet.inventory.sweet_corn ?? 0}{feedRecipes.every(recipe => (pet.inventory.animal_feed ?? 0) + recipe.quantity > inventoryItemLimit) ? ' · 饲料仓库不足以放下 1 批' : ''}</p><button type="button" className="text-button" onClick={() => onKitchen()}>去厨房加工台批量制作</button></section>
        <section className="community-care-section"><h3>牧场堆肥 · 回到菜地</h3><p>鸡舍和牛棚合计每完成 {ranchCompostCycleCount} 轮生产，就得到 1 份营养堆肥。收获蛋奶时自动收好，给菜地施肥可让本轮增产 1 份。</p><p>下一份进度 {compost.progress}/{ranchCompostCycleCount} 轮 · 待领 {compost.ready} 份 · 库存 {compostStock} 份</p>{compost.ready > 0 && <><button type="button" className="secondary-button" disabled={!free || !compostQuantity} onClick={() => update(p => collectRanchCompost(p))}>收好堆肥{compostQuantity ? ` ×${compostQuantity}` : ''}</button>{compostQuantity < compost.ready && <p>仓库放不下的堆肥会留在牧场，腾出空间后可以回来领取。</p>}</>}</section>
        <section className="community-care-section"><h3>陪伴也是照料</h3><p>{state.cared ? '这轮已经照料过了，让它安心等下一次收获。' : '消耗 2 点体力，让这一轮提前 10% 完成。'}{state.nextAt !== undefined ? `下轮还需 ${timeLeft(state.nextAt)}。` : ''}</p>
          <button className="secondary-button" disabled={!free || !state.nextAt || state.cared || pet.energy < 2} onClick={() => update(p => careCommunityAnimal(p, id, state.revision))}>{state.cared ? '本轮已照料' : '照料一下 · 体力 −2'}</button>
        </section>
        <p className="community-care-footnote">待收{def.name} {state.stock}/{capacity.stock} · 仓库 {pet.inventory[def.item] ?? 0} 份</p>
        <button className="text-button" disabled={!free} onClick={() => onKitchen(id === 'coop' ? 'carrot_omelet' : 'milk_custard')}>用收获做{id === 'coop' ? '胡萝卜蛋饼' : '鲜奶蛋羹'}</button>
        {id === 'barn' && <section className="community-care-section"><h3>牧场今日心意 · 任选一瓶</h3><p>照料 {daily.cared ? '✓' : '○'} · 收获 {daily.collected ? '✓' : '○'} · {daily.claimed ? '今天已领取' : '完成后任选'}</p><div className="community-actions">{(['strawberry_milk', 'ad_milk'] as const).map(choice => <button key={choice} className="secondary-button" disabled={!free || !daily.cared || !daily.collected || daily.claimed || (pet.inventory[choice] ?? 0) >= inventoryItemLimit} onClick={() => update(p => claimRanchMilk(p, choice))}>{choice === 'ad_milk' ? 'AD 高钙奶' : '草莓牛奶'} ×1</button>)}</div><button className="text-button" onClick={() => onKitchen()}>去厨房加工奶制品</button></section>}
      </>}
      <p role="status">{pet.recentEvent}</p>
    </CommunityDetailDialog>}
    {naming && <CommunityDetailDialog title={`给${id === 'coop' ? '鸡群' : '奶牛'}起名`} eyebrow="一个熟悉的称呼" onClose={() => setNaming(false)}>
      <form className="community-animal-name-form" onSubmit={event => { event.preventDefault(); if (!built || nameTooLong) return; update(p => renameCommunityAnimal(p, id, draftName)); setNaming(false); }}>
        <label htmlFor={nameInputId}>{id === 'coop' ? '鸡群' : '奶牛'}的名字</label>
        <input id={nameInputId} value={draftName} maxLength={animalNameMaxLength * 2} placeholder={defaultName} data-dialog-autofocus aria-invalid={nameTooLong} aria-describedby={`${nameInputId}-hint`} onChange={event => setDraftName(event.target.value)} />
        <p id={`${nameInputId}-hint`}>{nameTooLong ? '名字太长，请缩短后保存。' : ''}最多 {animalNameMaxLength} 个字符；留空并保存会恢复「{defaultName}」。起名和改名不消耗资源。</p>
        <div className="community-actions"><button type="submit" className="primary-button" disabled={!built || nameTooLong || normalizedName === (state.name ?? '')}>{normalizedName ? '保存名字' : '恢复默认称呼'}</button><button type="button" className="secondary-button" onClick={() => setNaming(false)}>取消</button></div>
      </form>
    </CommunityDetailDialog>}
  </>;
};

export const CommunityFarm = ({ only, ...props }: CommunityPanelProps & { only?: AnimalId }) => <>
  {(only ? [only] : ['coop', 'barn'] as const).map(id => <AnimalScene key={id} {...props} id={id} />)}
</>;
