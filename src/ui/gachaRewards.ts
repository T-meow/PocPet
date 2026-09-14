import { getGachaRewardItems } from '../core/goldenAppleGacha';
import { getInventoryItem } from '../core/items';
import type { BuiltinItemId, GachaResult } from '../core/petTypes';
import { t } from '../i18n';
import { formatCompactNumber } from './numberFormat';

export type GachaDisplayReward = Pick<GachaResult, 'id' | 'kind' | 'amount' | 'itemId' | 'contents'> & { rewardId?: string };

export const getGachaRewardLabel = (reward: GachaDisplayReward) => {
  if (reward.kind === 'coins') return t('ui.gacha.coinReward', { coins: formatCompactNumber(reward.amount) });
  if (reward.kind === 'hearts') return t('ui.gacha.heartReward', { hearts: formatCompactNumber(reward.amount) });
  if (reward.kind === 'bundle') return `${t(`ui.gacha.bundles.${reward.rewardId ?? reward.id}.name`)} ×${reward.amount}`;
  const itemName = reward.itemId ? getInventoryItem(reward.itemId)?.name ?? reward.itemId : t('ui.gacha.unknownReward');
  return `${itemName} ×${reward.amount}`;
};

export const getGachaRewardContentLabels = (reward: GachaDisplayReward) => getGachaRewardItems(reward)
  .map(({ itemId, amount }) => `${getInventoryItem(itemId)?.name ?? itemId} ×${amount}`);

export const summarizeGachaResults = (results: readonly GachaResult[]) => {
  const items = new Map<BuiltinItemId, number>();
  let coins = 0;
  let hearts = 0;
  for (const result of results) {
    if (result.kind === 'coins') coins += result.amount;
    if (result.kind === 'hearts') hearts += result.amount;
    for (const { itemId, amount } of getGachaRewardItems(result)) {
      items.set(itemId, (items.get(itemId) ?? 0) + amount);
    }
  }
  return { coins, hearts, items: Array.from(items, ([itemId, amount]) => ({ itemId, amount })) };
};
