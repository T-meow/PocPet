import { useCallback, useEffect, useRef, useState } from 'react';
import idle from '../assets/pet/compressed/pet_idle_sit.png';
import happy from '../assets/pet/compressed/pet_happy.png';
import { miniGameRegistry } from './registry';
import { normalizeMiniGamesSave } from './storage';
import { clone } from './shared/state';
import { normalizeGameReceipts } from './shared/receipts';
import { useGameAudio } from './shared/audio';
import { Flower, Icon, Instructions } from './shared/ui';
import type { GameId, GameResult, GameStates, MiniGameHost, MiniGamesSave } from './types';
import type { HubGameId } from './catalog';
import './styles.css';
import './games.css';

export interface MiniGamesHubProps { host?: MiniGameHost; embedded?: boolean; paused?: boolean; gameId?: HubGameId; }
const emptyHost: MiniGameHost = {};
export function MiniGamesHub({ host = emptyHost, embedded = false, paused: hostPaused = false, gameId }: MiniGamesHubProps) {
  const [initial] = useState(() => { try { return { save: normalizeMiniGamesSave(host.load?.()), error: '' }; } catch { return { save: normalizeMiniGamesSave(null), error: '暂时读不到本地进度，这次仍然可以正常试玩。' }; } });
  const [save, setSave] = useState(initial.save), current = useRef(save), hostRef = useRef(host); hostRef.current = host;
  const [notice, setNotice] = useState(initial.error);
  const [manualPause, setManualPause] = useState(!embedded && initial.save.activeGame === 'fruit' && initial.save.games.fruit.bodies.length > 0 && !initial.save.games.fruit.over);
  const [pageActive, setPageActive] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [speech, setSpeech] = useState('这一小会儿，我都陪着你。慢慢来，不用着急。');
  const [cheering, setCheering] = useState(false), cheerTimer = useRef<ReturnType<typeof setTimeout>>(), persistTimer = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true), storageDirty = useRef(false);
  const paused = manualPause || hostPaused || !pageActive, pausedRef = useRef(paused); pausedRef.current = paused;
  const playSound = useGameAudio(save.sound), soundRef = useRef(playSound); soundRef.current = playSound;
  const persist = useCallback(() => {
    clearTimeout(persistTimer.current);
    if (!storageDirty.current) return;
    try { hostRef.current.save?.(clone(current.current)); storageDirty.current = false; }
    catch { if (mounted.current) setNotice('本地保存暂时不可用，当前页面仍保留你的进度。'); }
  }, []);
  const commit = useCallback((next: MiniGamesSave) => {
    current.current = next; storageDirty.current = true;
    if (mounted.current) setSave(next);
    clearTimeout(persistTimer.current);
    if (mounted.current) persistTimer.current = setTimeout(persist, 120);
    else persist();
  }, [persist]);
  const change = useCallback(<K extends GameId,>(id: K, expectedSession: string, state: GameStates[K]) => {
    if (current.current.games[id].id !== expectedSession) return;
    commit({ ...current.current, games: { ...current.current.games, [id]: state } });
  }, [commit]);
  const complete = useCallback((result: GameResult) => {
    if (current.current.games[result.game].id !== result.sessionId || current.current.reportedSessions.includes(result.sessionId)) return;
    commit({ ...current.current, reportedSessions: normalizeGameReceipts([...current.current.reportedSessions, result.sessionId], current.current.games) }); persist();
    try { hostRef.current.onResult?.({ ...result }); } catch { if (mounted.current) setNotice('这局成绩已经留在这里，暂时没能通知外部游戏。'); }
  }, [commit, persist]);
  useEffect(() => {
    mounted.current = true;
    const visibility = () => { const shown = document.visibilityState !== 'hidden'; setPageActive(shown); if (!shown) persist(); };
    const blur = () => { setPageActive(false); persist(); }, focus = () => setPageActive(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', blur); window.addEventListener('focus', focus); window.addEventListener('pagehide', persist);
    return () => { mounted.current = false; persist(); clearTimeout(cheerTimer.current); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); window.removeEventListener('pagehide', persist); };
  }, [persist]);
  const activeGame = gameId ?? save.activeGame;
  const game = miniGameRegistry.find(g => g.id === activeGame)!;
  const companion = host.companion || { name: '伙伴', idle, happy };
  const selectGame = (id: GameId) => { commit({ ...current.current, activeGame: id }); setManualPause(false); setSpeech(miniGameRegistry.find(g => g.id === id)!.welcome); };
  return <div className={`mg-root${embedded ? ' mg-embedded' : ''}${paused ? ' mg-paused' : ''}`} data-minigames-root>
    {!embedded && <header className="topbar"><div className="topbar-inner"><div className="brand"><Flower className="brand-mark"/><strong>PocPet</strong><span>陪伴小日常</span></div><div className="top-note"><Icon name="leaf"/>给自己一点慢下来的时间</div></div></header>}
    <main>{!embedded && <div className="intro"><div><div className="eyebrow">A LITTLE TIME, TOGETHER</div><h1>一起玩一会儿</h1><p>摆一摆，理一理。和伙伴度过轻松的一小会儿。</p></div><Flower className="intro-flower"/></div>}
      <div className="layout"><div className="play-area">{!gameId && <nav className="game-tabs" role="tablist" aria-label="选择小游戏">{miniGameRegistry.map((entry, i) => <button type="button" key={entry.id} className={`tab${entry.id === activeGame ? ' active' : ''}`} data-game={entry.id} role="tab" aria-selected={entry.id === activeGame} tabIndex={entry.id === activeGame ? 0 : -1} onClick={() => selectGame(entry.id)} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = miniGameRegistry[(i + (event.key === 'ArrowLeft' ? -1 : 1) + miniGameRegistry.length) % miniGameRegistry.length]; selectGame(next.id); event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-game="${next.id}"]`)?.focus(); } }}><span className={`tab-art game-icon game-icon-${entry.id}`}><Icon name={entry.icon}/></span><span><strong>{entry.name}</strong><small>{entry.subtitle}</small></span></button>)}</nav>}
        {!gameId && <div className="hub-controls"><span><Icon name="heart"/>随时开始，随时休息</span><button type="button" className="pause-button" onClick={() => setManualPause(!manualPause)} aria-pressed={manualPause} disabled={hostPaused} data-testid="pause"><Icon name={manualPause ? 'play' : 'pause'}/>{manualPause ? '继续玩' : '休息一下'}</button></div>}
        {miniGameRegistry.filter(entry => !gameId || entry.id === gameId).map(entry => <section key={entry.id} className="game-panel game-frame" role={gameId ? 'region' : 'tabpanel'} aria-label={entry.name} hidden={entry.id !== activeGame} data-panel={entry.id}>
          {entry.render({ active: entry.id === activeGame, paused, complete, feedback: (text, sound) => { if ((gameId ?? current.current.activeGame) !== entry.id || pausedRef.current) return; setSpeech(text); if (sound) soundRef.current(sound); if (sound === 'clear' || sound === 'win') { clearTimeout(cheerTimer.current); setCheering(true); cheerTimer.current = setTimeout(() => setCheering(false), 1400); } } }, save.games, change)}
          {paused && entry.id === activeGame && <div className="pause-overlay"><div className="win-card"><Icon name="cup"/><h3>先歇一小会儿</h3><p>进度留在这里，回来再一起玩。</p>{!hostPaused && pageActive && <button type="button" className="tool primary" onClick={() => setManualPause(false)}>继续一起玩</button>}</div></div>}
        </section>)}
        {notice && <p className="save-notice" role="status">{notice}</p>}
      </div><aside className="side"><div className="companion-card"><div className="companion-heading"><Icon name="heart"/>{companion.name}陪你一起</div><div className="companion-stage"><span className="pet-star" aria-hidden="true">✧</span><span className="pet-heart" aria-hidden="true">♡</span><img className={`pet${cheering ? ' cheer' : ''}`} src={cheering ? companion.happy : companion.idle} alt={`陪你玩的${companion.name}`} draggable={false}/></div><div className="speech" aria-live="polite">{speech}</div><p className="companion-caption">开心就好，不用每次都拿满分。</p></div><Instructions game={game}/><p className="rest-note"><Icon name="cup"/>玩累了，记得伸个懒腰。</p></aside></div>
      <footer className="footer"><span><Icon name="heart"/>小小的快乐，也值得认真收藏。</span><button type="button" className="sound-button" aria-pressed={save.sound} onClick={() => commit({ ...current.current, sound: !current.current.sound })}><Icon name={save.sound ? 'sound' : 'muted'}/>{save.sound ? '轻柔音效' : '声音已关'}</button></footer>
    </main>
  </div>;
}
