import { foodHungerOverflowRatio, getItemRecoveryPreview, getPictureBookReward, overfedMessage } from '../core/itemEffects';
import { activityText as L } from '../core/kitchenRecipes';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { formatPracticeSkillXp } from '../core/partnerSchedule';
import type { ItemDefinition, ItemId, PetState } from '../core/pet';
import { getItemEffectBadges } from './itemEffectBadges';

export const ItemRecoveryPreview = ({ pet, item, quantity = 1, favoriteFoodIds }: {
  pet: PetState; item: ItemDefinition; quantity?: number; favoriteFoodIds?: readonly ItemId[];
}) => {
  if (!item.usable || item.kind === 'garden') return null;
  if (isAdventureTreasure(item.id)) return <div className="item-recovery-preview"><p>{L(`兑换后获得 ${getAdventureTreasureValue(item.id) * quantity} 金币，不恢复状态。`, `Exchange for ${getAdventureTreasureValue(item.id) * quantity} coins. Does not restore stats.`)}</p></div>;
  const preview = getItemRecoveryPreview(pet, item, quantity, favoriteFoodIds);
  if (preview.blocked) return <div className="item-recovery-preview" role="status"><p>{overfedMessage}</p><small>本次不消耗食物。</small></div>;
  const actual = getItemEffectBadges(preview.actual);
  const overflow = getItemEffectBadges(preview.overflow);
  const book = item.id === 'picture_book' ? getPictureBookReward(pet.partnerSchedule.skills.study, quantity) : undefined;
  return <div className="item-recovery-preview" aria-live="polite">
    {preview.quantity < preview.requestedQuantity && <p>吃饱自动停止：所选 {preview.requestedQuantity} 份中，本次只用 {preview.quantity} 份，其余保留。</p>}
    <p>{`使用 ${preview.quantity} 份的道具实际恢复：`}{actual.length ? actual.map((badge) => badge.label).join(' · ') : L('属性已满', 'Stats are full')}</p>
    {item.kind === 'food' && (preview.overflow.hunger ?? 0) > 0 && <small>饱食可超过上限，超出部分按 {foodHungerOverflowRatio * 100}% 计入。</small>}
    {overflow.length > 0 && <small>未计入的恢复量：{overflow.map((badge) => badge.label).join(' · ')}</small>}
    {book && <p>{[book.xp > 0 ? formatPracticeSkillXp('study', book.xp) : '', book.heartServings > 0 ? L(`${book.xp > 0 ? `其中 ${book.heartServings} 本在满级后阅读` : '学习已满级'} · 基础心心 +${book.heartServings}，成就与增益卡加成另计`, `${book.xp > 0 ? `${book.heartServings} books read after mastering Study` : 'Study mastered'} · base hearts +${book.heartServings}; achievement and card bonuses also apply`) : ''].filter(Boolean).join(' · ')}</p>}
    {item.id === 'ribbon_bell' && <p>{L(`基础心心 +${quantity} · 成就与增益卡加成另计`, `Base hearts +${quantity} · achievement and card bonuses also apply`)}</p>}
  </div>;
};
