import type { MiniGameId } from '../../core/companionActivityTypes';
import { itemIcons } from '../../assets';
import { matchingCardBack, matchingCardFaces } from '../../miniGameAssets';

export function MiniGameEntryArt({ game, ballImage = itemIcons.toy_ball }: { game: MiniGameId; ballImage?: string }) {
  if (game === 'blocks') return <svg viewBox="0 0 100 90" aria-hidden="true"><g transform="rotate(-9 50 48)" strokeWidth="1.5"><g fill="#b4c596" stroke="#90a777"><rect x="17" y="16" width="27" height="27" rx="6"/><rect x="17" y="47" width="27" height="27" rx="6"/><rect x="48" y="47" width="27" height="27" rx="6"/></g><rect x="48" y="16" width="27" height="27" rx="6" fill="#e6ce91" stroke="#c5af77"/><path d="M22 22h16m15 0h16M22 53h16m15 0h16" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round"/></g></svg>;
  if (game === 'water') return <svg viewBox="0 0 100 90" aria-hidden="true"><g transform="rotate(-11 33 45)"><path d="M25 13h17v17l6 7v38q0 7-8 7H26q-8 0-8-7V37l7-7Z" fill="#fffdf8" stroke="#c7b9a3" strokeWidth="2"/><path d="M21 53h24v21q0 5-6 5H27q-6 0-6-5Z" fill="#d2a8b0"/><path d="M21 41h24v13H21Z" fill="#e6bd8f"/></g><g transform="rotate(12 68 47)"><path d="M60 13h17v17l6 7v38q0 7-8 7H61q-8 0-8-7V37l7-7Z" fill="#fffdf8" stroke="#c7b9a3" strokeWidth="2"/><path d="M56 64h24v10q0 5-6 5H62q-6 0-6-5Z" fill="#e5bd8e"/><path d="M56 40h24v24H56Z" fill="#a9bc91"/></g></svg>;
  if (game === 'bubbles') return <svg viewBox="0 0 100 90" aria-hidden="true"><g strokeWidth="1.5"><circle cx="36" cy="54" r="25" fill="#dce8e6" fillOpacity=".5" stroke="#b3c9cd"/><circle cx="70" cy="31" r="20" fill="#e7e1ed" fillOpacity=".6" stroke="#c2bfce"/><circle cx="75" cy="69" r="9" fill="#e8eadf" stroke="#bac9bc"/><path d="M19 43q5-9 13-10m26-9q4-6 9-6" stroke="#fffdf4" strokeWidth="4" strokeLinecap="round"/><path d="m63 32 7 6 7-6c6-8-4-12-7-5-3-7-13-3-7 5Z" fill="none" stroke="#d0aebf"/></g></svg>;
  const image = game === 'matching' ? matchingCardBack : game === 'match3' ? matchingCardFaces.garden[0].image : game === 'fruit' ? itemIcons.watermelon : ballImage;
  return <img src={image} alt="" draggable={false} />;
}
