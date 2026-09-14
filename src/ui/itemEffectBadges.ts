import type { ItemEffect } from '../core/pet';
import { t } from '../i18n';

export const itemEffectKeys = ['hunger', 'mood', 'cleanliness', 'energy', 'health'] as const;

export type ItemEffectBadge = {
  key: (typeof itemEffectKeys)[number];
  label: string;
  amount: string;
};

export const getItemEffectBadges = (effect: ItemEffect, quantity = 1): ItemEffectBadge[] =>
  itemEffectKeys
    .map((key) => {
      const value = effect[key];
      if (!value) return undefined;
      const total = Math.round(value * Math.max(1, Math.floor(quantity)) * 10) / 10;
      if (!total) return undefined;
      const amount = total > 0 ? `+${total}` : String(total);
      return {
        key,
        amount,
        label: `${t(`ui.stats.${key}`)} ${amount}`,
      };
    })
    .filter((badge): badge is ItemEffectBadge => Boolean(badge));

export const getItemEffectTitle = (summary: string, effect: ItemEffect, quantity = 1) => {
  const effectText = getItemEffectBadges(effect, quantity).map((badge) => badge.label).join(', ');
  return effectText ? `${summary}\n${effectText}` : summary;
};
