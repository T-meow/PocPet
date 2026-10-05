import { useEffect, useRef, useState } from 'react';
import type { AdventureMapSelection } from './AdventureMap';
import { hasDialogBackLayer } from './dialogNavigation';
import type { CampaignVisitId } from '../core/explorationCampaignData';
export interface ExplorationNavigation {
  screen: 'home' | 'map' | 'prepare' | 'journey' | 'receipt' | 'growth' | 'journal' | 'tasks';
  selection?: AdventureMapSelection | 'tutorial';
  mode: 'manual' | 'idle';
  target?: string;
  campaignVisit?: CampaignVisitId;
  taskTab?: 'current' | 'completed';
}
export const useExplorationNavigation = (initial: ExplorationNavigation, leave: () => void, available: { journey: boolean; receipt: boolean }) => {
  const [navigation, setNavigation] = useState(initial);
  const session = useRef(`exploration:${Date.now()}:${Math.random()}`), leaveRef = useRef(leave);
  const availableRef = useRef(available);
  const entry = useRef(0), nextEntry = useRef(0);
  const initialized = useRef(false);
  leaveRef.current = leave;
  availableRef.current = available;
  const restore = (next: ExplorationNavigation): ExplorationNavigation =>
    (next.screen === 'journey' || next.screen === 'receipt') && !availableRef.current[next.screen] ? { ...next, screen: 'home' } : next;
  useEffect(() => {
    if (!initialized.current) { window.history.pushState({ ...window.history.state, pocpetAdventure: { session: session.current, entry: entry.current, navigation: initial }, pocpetDialog: undefined }, ''); initialized.current = true; }
    const pop = (event: PopStateEvent) => {
      const state = event.state?.pocpetAdventure;
      if (state?.session === session.current) {
        // Dialog history shares its page entry. Closing a layer must preserve
        // the page underneath, including the just-claimed receipt.
        const next = state.entry === entry.current ? state.navigation : restore(state.navigation);
        entry.current = state.entry;
        if (next !== state.navigation) window.history.replaceState({ ...event.state, pocpetAdventure: { ...state, navigation: next } }, '');
        setNavigation(next);
      }
      else leaveRef.current();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !hasDialogBackLayer()) { event.preventDefault(); window.history.back(); } };
    window.addEventListener('popstate', pop); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('keydown', key); };
  }, []);
  const navigate = (next: ExplorationNavigation, replace = false) => {
    // A claimed receipt may still offer the next destination, but it must not
    // become the return page for another trip. Retire it in browser history too.
    const previous = restore(navigation);
    if (!replace && !hasDialogBackLayer() && previous !== navigation) {
      window.history.replaceState({ ...window.history.state, pocpetAdventure: { session: session.current, entry: entry.current, navigation: previous }, pocpetDialog: undefined }, '');
      if (next.screen === previous.screen) replace = true;
    }
    const replacing = replace || hasDialogBackLayer();
    if (!replacing) entry.current = ++nextEntry.current;
    const state = { ...window.history.state, pocpetAdventure: { session: session.current, entry: entry.current, navigation: next }, pocpetDialog: replace && next.screen === navigation.screen ? window.history.state?.pocpetDialog : undefined };
    if (replacing) window.history.replaceState(state, ''); else window.history.pushState(state, '');
    setNavigation(next);
  };
  return { navigation, navigate, back: () => window.history.back() };
};
