import { createRoot } from 'react-dom/client';
import { MiniGamesHub, type MiniGamesHubProps } from './MiniGamesHub';
export { MiniGamesHub };
export type { MiniGamesHubProps };
export { miniGameRegistry } from './registry';
export { miniGameCatalog, isHubGameId, type HubGameId } from './catalog';
export { createMiniGamesSave, normalizeMiniGamesSave, createPreviewHost, previewStorageKey } from './storage';
export type { MiniGameHost, MiniGamesSave, GameResult, GameId, GameStates, CompanionArtwork } from './types';

export function mountMiniGames(element: HTMLElement, options: MiniGamesHubProps = {}) {
  const root = createRoot(element);
  root.render(<MiniGamesHub {...options}/>);
  return { update: (next: MiniGamesHubProps) => root.render(<MiniGamesHub {...next}/>), unmount: () => root.unmount() };
}
