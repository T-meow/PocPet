import { createPreviewHost, mountMiniGames } from './index';
import type { MiniGameHost } from './types';
let host: MiniGameHost;
try { host = createPreviewHost(window.localStorage); }
catch { host = { load: () => { throw new Error('Preview storage is unavailable'); } }; }
const element = document.getElementById('minigames-root');
if (element) mountMiniGames(element, { host });
