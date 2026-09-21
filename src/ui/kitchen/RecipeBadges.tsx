import { Apple, Droplets, HeartPulse, Smile, Zap } from 'lucide-react';
import { rarityNames } from '../../core/foodCatalog';
import { getRecipeEffect, recipeCategoryNames, type RecipeDefinition } from '../../core/kitchenRecipes';
import { getItemEffectBadges } from '../itemEffectBadges';

const effectIcons = { hunger: Apple, mood: Smile, cleanliness: Droplets, energy: Zap, health: HeartPulse };

export const RecipeBadges = ({ recipe, banana = false }: { recipe: RecipeDefinition; banana?: boolean }) => <span className="recipe-badges">
  <span className="recipe-badge-row">
    <span className="storage-tile-tag recipe-category-tag">{recipeCategoryNames[recipe.category]}</span>
    <span className="storage-tile-tag recipe-rarity-tag" data-rarity={recipe.rarity}>{rarityNames[recipe.rarity]}</span>
  </span>
  <span className="recipe-badge-row" role="group" aria-label="每份基础属性">
    {getItemEffectBadges(getRecipeEffect(recipe, banana)).map(badge => {
      const Icon = effectIcons[badge.key];
      return <span key={badge.key} className={`storage-tile-tag storage-tile-tag--${badge.key}`} title={badge.label} role="img" aria-label={badge.label}>
        <Icon size={13} aria-hidden="true" /><span aria-hidden="true">{badge.amount}</span>
      </span>;
    })}
  </span>
</span>;
