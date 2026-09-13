import { getItemRecoveryPreview, getPictureBookReward } from '../core/itemEffects';
import { activityText as L } from '../core/kitchenRecipes';
import { formatPracticeSkillXp } from '../core/partnerSchedule';
import type { ItemDefinition, ItemId, PetState } from '../core/pet';
import { getItemEffectBadges } from './itemEffectBadges';

export const ItemRecoveryPreview = ({ pet, item, quantity = 1, favoriteFoodIds }: {
  pet: PetState; item: ItemDefinition; quantity?: number; favoriteFoodIds?: readonly ItemId[];
}) => {
  if (!item.usable || item.kind === 'garden') return null;
  const preview = getItemRecoveryPreview(pet, item, quantity, favoriteFoodIds);
  const actual = getItemEffectBadges(preview.actual);
  const overflow = getItemEffectBadges(preview.overflow);
  const book = item.id === 'picture_book' ? getPictureBookReward(pet.partnerSchedule.skills.study, quantity) : undefined;
  return <div className="item-recovery-preview" aria-live="polite">
    <p>{L(`使用 ${quantity} 份的道具恢复（已计上限）：`, `Item recovery from ${quantity}, after stat caps: `)}{actual.length ? actual.map((badge) => badge.label).join(' · ') : L('属性已满', 'Stats are full')}</p>
    {overflow.length > 0 && <small>{L('超过上限的部分：', 'Beyond the stat caps: ')}{overflow.map((badge) => badge.label).join(' · ')}</small>}
    {book && <p>{[book.xp > 0 ? formatPracticeSkillXp('study', book.xp) : '', book.heartServings > 0 ? L(`${book.xp > 0 ? `其中 ${book.heartServings} 本在满级后阅读` : '学习已满级'} · 基础心心 +${book.heartServings}，成就与增益卡加成另计`, `${book.xp > 0 ? `${book.heartServings} books read after mastering Study` : 'Study mastered'} · base hearts +${book.heartServings}; achievement and card bonuses also apply`) : ''].filter(Boolean).join(' · ')}</p>}
    {item.id === 'ribbon_bell' && <p>{L(`基础心心 +${quantity} · 成就与增益卡加成另计`, `Base hearts +${quantity} · achievement and card bonuses also apply`)}</p>}
  </div>;
};
