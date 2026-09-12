import { t } from '../i18n';
import { getInventoryItem, shopItems } from './items';
import type { NeighborEventContext, NeighborGiftCandidate } from './petTypes';

const defaultGiftCandidates: readonly NeighborGiftCandidate[] = shopItems.filter((item) => !item.purchaseContents).map((item) => ({
  itemId: item.id,
  displayName: item.name,
  price: item.price,
}));

export const getNeighborEventRandom = (context?: NeighborEventContext) => context?.random ?? Math.random;

export const pickNeighborEventValue = <T>(items: readonly T[], random: () => number): T =>
  items[Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))];

export const pickNeighborName = (context: NeighborEventContext | undefined, random: () => number) => {
  const neighbors = [...(context?.neighbors ?? [])].sort((left, right) => left.modId.localeCompare(right.modId));
  return neighbors.length > 0 ? pickNeighborEventValue(neighbors, random).name : undefined;
};

export const selectNeighborGift = (
  candidates: readonly NeighborGiftCandidate[],
  random: () => number = Math.random,
): NeighborGiftCandidate => {
  const available = candidates.filter((item) => item.itemId !== 'golden_apple' && !getInventoryItem(item.itemId)?.purchaseContents);
  if (available.length === 0) {
    return {
      itemId: 'emergency_biscuit',
      displayName: getInventoryItem('emergency_biscuit')?.name ?? t('pet.shop.items.emergency_biscuit.name'),
      price: 0,
    };
  }
  const highValue = available.filter((item) => item.price > 1000);
  if (random() < 0.01) {
    if (highValue.length === 0 || random() < 0.6) {
      return {
        itemId: 'golden_apple',
        displayName: getInventoryItem('golden_apple')?.name ?? t('pet.shop.items.golden_apple.name'),
        price: 888,
      };
    }
    return pickNeighborEventValue(highValue, random);
  }

  const common = available.filter((item) => item.price <= 1000);
  return common.length > 0
    ? pickNeighborEventValue(common, random)
    : {
        itemId: 'emergency_biscuit',
        displayName: getInventoryItem('emergency_biscuit')?.name ?? t('pet.shop.items.emergency_biscuit.name'),
        price: 0,
      };
};

export const createNeighborGift = (context?: NeighborEventContext) => {
  const random = getNeighborEventRandom(context);
  return {
    neighborName: pickNeighborName(context, random),
    gift: selectNeighborGift(context?.giftCandidates ?? defaultGiftCandidates, random),
  };
};
