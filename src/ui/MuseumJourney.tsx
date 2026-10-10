import { useState } from 'react';
import { Backpack, Truck } from 'lucide-react';
import { advanceMuseumVisit, getMuseumStepPreview, isMuseumMealDelivery } from '../core/museumJourney';
import { museumVisits } from '../core/museumData';
import { dishName, getDish, recipeCategoryNames } from '../core/kitchenRecipes';
import { parseLandmarkId } from '../core/landmarkProgress';
import { canUseAdventureService } from '../core/adventure';
import type { Inventory, PetState } from '../core/petTypes';
import type { AdventureStoragePanel } from './AdventureStorage';
import { AdventureCompanionStatus, AdventureLandscape } from './AdventurePresentation';
import { ExplorationSupport } from './expedition/ExplorationSupport';

export const MuseumJourney = ({ pet, portrait, update, move, busy, onStorage, onReturn }: { pet: PetState; portrait: string; update: (fn: (p: PetState) => PetState) => void; move: (fn: (p: PetState) => PetState) => void; busy: boolean; onStorage: (panel: AdventureStoragePanel) => void; onReturn: () => void }) => {
  const [menu, setMenu] = useState<Record<string, string>>({});
  const trip = pet.adventure.active;
  if (!trip?.museum) return null;
  const context = trip.museum, def = museumVisits[context.visitId], step = context.step, location = parseLandmarkId(def.destination);
  const done = step >= def.steps.length, serving = context.visitId === 'station_dinner' && step === def.steps.length - 1;
  const delivery: Inventory = serving ? Object.fromEntries(Object.values(menu).filter(Boolean).map(id => [id, 1])) : {};
  const quote = getMuseumStepPreview(pet, context.visitId), reason = !done ? quote.reason || (serving && !isMuseumMealDelivery(delivery, trip.bag) ? '从行囊选好主食、汤羹和饮品各一份。' : '') : '';
  return <div className="exploration-journey-layout"><div><section className="exploration-panel"><AdventureLandscape region={location.region} node={location.node} portrait={portrait} label="纪念馆回访" /><h2>{def.title}</h2><p>{done ? '这段记录已经放进纪念馆。收好行囊，下次再来。' : def.steps[step]}</p><p>记录进度 {step} / {def.steps.length}</p>
    {serving && <fieldset className="campaign-delivery"><legend>交付夜餐 · 共三份</legend>{(['main', 'soup', 'drink'] as const).map(category => <label className="museum-delivery-select" key={category}>{recipeCategoryNames[category]}<select value={menu[category] ?? ''} onChange={e => setMenu({ ...menu, [category]: e.target.value })}><option value="">从行囊选择一份</option>{Object.entries(trip.bag).filter(([id, n]) => n > 0 && getDish(id)?.recipe.category === category).map(([id, n]) => <option key={id} value={id}>{dishName(id)} · 携带 {n} 份</option>)}</select></label>)}<p>确认后从行囊各取出一份，交给值班的伙伴。</p></fieldset>}
    {!done && <><p>本步消耗：饱食 {quote.hunger[1]} · 体力 {quote.energy[1]}</p><button className="primary-button" disabled={busy || Boolean(reason)} onClick={() => move(p => advanceMuseumVisit(p, trip.id, trip.revision, step, delivery))}>{serving ? '交付夜餐，留下纪念' : '和伙伴继续记录'}</button>{reason && <p role="status">{reason}</p>}</>}{done && <button className="primary-button" disabled={busy} onClick={onReturn}>收好行囊，返回前哨</button>}</section><ExplorationSupport pet={pet} system="adventure" update={update} move={move} busy={busy} /></div>
    <aside className="exploration-panel exploration-journey-aside"><AdventureCompanionStatus pet={pet} actor={{ id: trip.actorId, name: trip.actorName, portrait }} /><p>纪念馆委托、已交料理与每一步记录都会保存，中途返程可以下次继续。</p><button className="primary-button" disabled={busy} onClick={() => onStorage('bag')}><Backpack size={18} />使用行囊补给</button><button className="secondary-button" disabled={busy || !canUseAdventureService(pet)} onClick={() => onStorage('delivery')}><Truck size={18} />从仓库送来补给</button><button className="secondary-button" disabled={busy} onClick={onReturn}>{done ? '记录完成，返回前哨' : '先回前哨，下次继续'}</button></aside>
  </div>;
};
