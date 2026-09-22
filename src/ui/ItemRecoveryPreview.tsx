import { getItemRecoveryPreview, getPictureBookReward } from '../core/itemEffects';
import { activityText as L } from '../core/kitchenRecipes';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { formatPracticeSkillXp } from '../core/partnerSchedule';
import type { ItemDefinition, ItemId, PetState } from '../core/pet';
import { getItemEffectBadges } from './itemEffectBadges';
import { HelpButton } from './help/HelpButton';
import { getItemHelp } from './help/itemHelp';

export const ItemRecoveryPreview = ({ pet, item, quantity = 1, favoriteFoodIds, showHelp = true }: {
  pet: PetState; item: ItemDefinition; quantity?: number; favoriteFoodIds?: readonly ItemId[]; showHelp?: boolean;
}) => {
  if (!item.usable || item.kind === 'garden') return null;
  if (isAdventureTreasure(item.id)) return <div className="item-recovery-preview"><p>可兑换 {getAdventureTreasureValue(item.id) * quantity} 金币</p></div>;
  const preview = getItemRecoveryPreview(pet, item, quantity, favoriteFoodIds);
  if (preview.blocked) return <div className="item-recovery-preview" role="status"><p>吃撑了，先消化一下。</p><small>本次不消耗食物。</small>{showHelp && <HelpButton {...getItemHelp(pet, item, quantity, favoriteFoodIds)} label="恢复说明" />}</div>;
  const actual = getItemEffectBadges(preview.actual);
  const book = item.id === 'picture_book' ? getPictureBookReward(pet.partnerSchedule.skills.study, quantity) : undefined;
  return <div className="item-recovery-preview" aria-live="polite">
    {preview.quantity < preview.requestedQuantity && <p>本次只用 {preview.quantity} 份，其余保留。</p>}
    <p>本次实际恢复：{actual.length ? actual.map((badge) => badge.label).join(' · ') : L('属性已满', 'Stats are full')}</p>
    {book && <p>{[book.xp > 0 ? formatPracticeSkillXp('study', book.xp) : '', book.heartServings > 0 ? '基础心心 +' + book.heartServings : ''].filter(Boolean).join(' · ')}</p>}
    {item.id === 'ribbon_bell' && <p>基础心心 +{quantity}</p>}
    {showHelp && <HelpButton {...getItemHelp(pet, item, quantity, favoriteFoodIds)} label="恢复说明" />}
  </div>;
};
