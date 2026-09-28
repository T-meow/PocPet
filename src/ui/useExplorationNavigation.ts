import { useEffect, useRef, useState } from 'react';
import type { AdventureMapSelection } from './AdventureMap';
import { hasDialogBackLayer } from './dialogNavigation';
export interface ExplorationNavigation {
  screen: 'home' | 'map' | 'prepare' | 'journey' | 'receipt' | 'growth' | 'journal';
  selection?: AdventureMapSelection | 'tutorial';
  mode: 'manual' | 'idle';
  target?: string;
}
export const useExplorationNavigation = (initial: ExplorationNavigation, leave: () => void) => {
  const [navigation, setNavigation] = useState(initial);
  const session = useRef(`exploration:${Date.now()}:${Math.random()}`), leaveRef = useRef(leave);
  const initialized = useRef(false);
  leaveRef.current = leave;
  useEffect(() => {
    if (!initialized.current) { window.history.pushState({ ...window.history.state, pocpetAdventure: { session: session.current, navigation: initial }, pocpetDialog: undefined }, ''); initialized.current = true; }
    const pop = (event: PopStateEvent) => {
      const state = event.state?.pocpetAdventure;
      if (state?.session === session.current) setNavigation(state.navigation);
      else leaveRef.current();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !hasDialogBackLayer()) { event.preventDefault(); window.history.back(); } };
    window.addEventListener('popstate', pop); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('keydown', key); };
  }, []);
  const navigate = (next: ExplorationNavigation, replace = false) => {
    const state = { ...window.history.state, pocpetAdventure: { session: session.current, navigation: next }, pocpetDialog: replace && next.screen === navigation.screen ? window.history.state?.pocpetDialog : undefined };
    if (replace || hasDialogBackLayer()) window.history.replaceState(state, ''); else window.history.pushState(state, '');
    setNavigation(next);
  };
  return { navigation, navigate, back: () => window.history.back() };
};
