import type { CSSProperties } from 'react';
import type { DishId, KitchenState } from '../../core/companionActivityTypes';
import { dishPresentation, kitchenItemIcons } from '../../companionActivityAssets';

export const DishArtwork = ({ id, image, plating, className = '' }: {
  id: DishId; image: string; plating: KitchenState['plating']; className?: string;
}) => {
  const presentation = dishPresentation[id];
  const builtin = image === kitchenItemIcons[id];
  return <div
    className={`dish-plate ${className}`.trim()}
    data-container={builtin ? presentation.container : 'custom'}
    data-plating={plating}
    style={{ '--dish-rim-bottom': presentation.rimBottom } as CSSProperties}
  ><img src={image} alt="" draggable={false} /></div>;
};
