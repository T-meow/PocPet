import { useState } from 'react';
import { createItemBrowseState, type ItemBrowseCategory } from '../itemBrowse';

export const useInventoryController = () => {
  const [browse, setBrowse] = useState(createItemBrowseState);
  const prepareOpen = (category?: ItemBrowseCategory) => {
    if (category) setBrowse((current) => ({ ...current, category, query: '', selectedId: undefined, quantity: 1 }));
  };
  return { browse, setBrowse, prepareOpen };
};
