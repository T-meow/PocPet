import { useRef, useState } from 'react';
import { isFestivalId } from '../../core/festivalCalendar';

export const getInitialFestival = () => {
  const id = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  return isFestivalId(id) ? id : null;
};

export type ActivePage = 'home' | 'achievements' | 'garden' | 'partnerSchedule' | 'commonDreams' | 'settings' | 'memories' | 'festival';
export type UtilityDialog = 'inventory' | 'shop' | 'boostCards' | 'gacha' | 'kitchen' | 'play' | null;

export const useAppNavigation = () => {
  const [activePage, setActivePageState] = useState<ActivePage>(() => getInitialFestival() ? 'festival' : 'home');
  const [utilityDialog, setUtilityDialog] = useState<UtilityDialog>(null);
  const isHomeRef = useRef(activePage === 'home');

  const setActivePage = (page: ActivePage) => {
    isHomeRef.current = page === 'home';
    setUtilityDialog(null);
    setActivePageState(page);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  };

  const openUtilityDialog = (dialog: Exclude<UtilityDialog, null>) => {
    setUtilityDialog(dialog);
  };

  const closeUtilityDialog = () => setUtilityDialog(null);

  return {
    activePage,
    isHomeRef,
    utilityDialog,
    setActivePage,
    openUtilityDialog,
    closeUtilityDialog,
  };
};
