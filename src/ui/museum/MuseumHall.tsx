import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { completeMuseumHallStage, getMuseumCompleteReason, getMuseumExhibits, getMuseumHallReason, investMuseumHall, withdrawMuseumHall } from '../../core/pet';
import { getMuseumStageCost, museumExhibits, museumHalls, museumStageNames, museumTagNames, type MuseumRegion } from '../../core/museumData';
import { getInventoryItem } from '../../core/items';
import type { ItemId } from '../../core/petTypes';
import { unknownItemIcon } from '../../assets';
import { DialogShell } from '../DialogShell';
import { formatInteger } from '../numberFormat';
import { MuseumScene, museumExhibitImage, type MuseumProps } from './MuseumShared';

export const MuseumHall = ({ pet, icons, portrait, update, region, onClose, onQuests }: Pick<MuseumProps, 'pet' | 'icons' | 'portrait' | 'update'> & { region: MuseumRegion; onClose: () => void; onQuests: () => void }) => {
  const [amount, setAmount] = useState('1000');
  const [confirm, setConfirm] = useState<'invest' | 'complete'>();
  const hall = pet.museum.halls[region], def = museumHalls[region], cost = getMuseumStageCost(region, hall.stage);
  const missing = Math.max(0, cost.coins - hall.invested), chosen = Math.floor(Number(amount));
  const lock = getMuseumHallReason(pet, region), reason = getMuseumCompleteReason(pet, region);
  const owned = getMuseumExhibits(pet.museum);
  const canInvest = !pet.timePause && !lock && hall.stage < 3 && Number.isSafeInteger(chosen) && chosen > 0 && chosen <= Math.min(missing, pet.coins);
  const invest = () => { update(p => investMuseumHall(p, region, hall.stage, chosen, hall.invested)); setConfirm(undefined); };
  return <DialogShell className="museum-dialog" labelId="museum-hall-title" onClose={onClose}>
    <header><h2 id="museum-hall-title">{def.name}</h2><button className="icon-button" aria-label="关闭展厅" onClick={onClose}><X /></button></header>
    <div className="museum-dialog-body"><MuseumScene scene={def.scene} portrait={hall.stage === 3 ? portrait : undefined} icons={icons} caption={hall.stage === 3 ? '正式开放 · 一起留下的风景' : `建设进度 ${hall.stage} / 3`} />
      {lock && <p className="museum-hint">{lock}</p>}
      {hall.stage < 3 && <section className="museum-card"><h3>{museumStageNames[hall.stage]}</h3><p>已筹 {formatInteger(hall.invested)} / {formatInteger(cost.coins)} 金币</p><progress max={cost.coins} value={hall.invested} /><div className="museum-funding"><label>筹入金币<input type="number" min="1" max={Math.min(missing, pet.coins)} step="1" value={amount} onChange={e => { setAmount(e.target.value); setConfirm(undefined); }} /></label><button className="secondary-button" disabled={!missing || !pet.coins} onClick={() => { setAmount(String(Math.min(missing, Math.floor(pet.coins)))); setConfirm(undefined); }}>填入可筹余额</button><button className="primary-button" disabled={!canInvest} onClick={() => chosen >= 10000 ? setConfirm('invest') : invest()}>筹入</button><button className="secondary-button" disabled={pet.timePause !== undefined || !hall.invested} onClick={() => update(p => withdrawMuseumHall(p, region, hall.stage))}>撤回当前筹款</button></div><p className="museum-muted">未完工筹款可以撤回。完成阶段时，金币正式投入，同时扣除以下物资。</p>
        <ul className="museum-materials">{Object.entries({ ...cost.items, ...(cost.apples ? { golden_apple: cost.apples } : {}) }).map(([id, quantity]) => <li key={id}><img src={icons[id] ?? unknownItemIcon} alt="" /><span>{getInventoryItem(id as ItemId)?.name ?? id}</span><strong className={(pet.inventory[id] ?? 0) >= quantity ? 'is-ready' : ''}>{formatInteger(pet.inventory[id] ?? 0)} / {quantity}</strong></li>)}</ul>{hall.stage === 2 && <p>开馆还需完成当地任意一项委托。</p>}
      </section>}
      <section><h3>地区藏品</h3><div className="museum-exhibit-grid">{museumExhibits.filter(e => e.region === region).map(e => <article key={e.id} className={`museum-exhibit${owned.some(o => o.id === e.id) ? '' : ' is-locked'}`}><img src={museumExhibitImage(e.id, icons)} alt="" /><strong>{e.name}</strong><small>{e.tags.map(t => museumTagNames[t]).join(' · ')}</small><span>{owned.some(o => o.id === e.id) ? <><Check size={14} />已收藏</> : e.quest ? '完成地区委托' : `建设第 ${e.stage} 阶段`}</span></article>)}</div></section>
      {hall.stage >= 1 && <button className="secondary-button" onClick={onQuests}>查看地区委托</button>}
    </div><footer>{hall.stage < 3 ? <><small>{reason || '材料齐备，可以完成本阶段。'}</small><button className="primary-button" disabled={Boolean(reason)} onClick={() => setConfirm('complete')}>完成阶段</button></> : <button className="primary-button" onClick={onClose}>回到纪念馆</button>}</footer>
    {confirm && <DialogShell className="museum-dialog museum-confirm-dialog" labelId="museum-funding-title" role="alertdialog" onClose={() => setConfirm(undefined)}><header><h2 id="museum-funding-title">{confirm === 'invest' ? '确认筹款' : '确认完成阶段'}</h2><button className="icon-button" aria-label="取消确认" onClick={() => setConfirm(undefined)}><X /></button></header><div className="museum-dialog-body"><p>{confirm === 'invest' ? `筹入 ${formatInteger(chosen)} 金币，可在本阶段完工前撤回。` : `投入已筹的 ${formatInteger(cost.coins)} 金币，并扣除以下物资，永久解锁新展品。`}</p>{confirm === 'complete' && <ul>{Object.entries({ ...cost.items, ...(cost.apples ? { golden_apple: cost.apples } : {}) }).map(([id, quantity]) => <li key={id}>{getInventoryItem(id as ItemId)?.name ?? id} ×{quantity}</li>)}</ul>}</div><footer><button className="secondary-button" data-dialog-autofocus onClick={() => setConfirm(undefined)}>取消</button><button className="primary-button" disabled={confirm === 'invest' ? !canInvest : Boolean(reason)} onClick={confirm === 'invest' ? invest : () => { update(p => completeMuseumHallStage(p, region, hall.stage)); setConfirm(undefined); }}>确认{confirm === 'invest' ? '筹入' : '完成'}</button></footer></DialogShell>}
  </DialogShell>;
};
