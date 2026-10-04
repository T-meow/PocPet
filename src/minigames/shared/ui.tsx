import type { ReactNode, CSSProperties } from 'react';
import type { GameDefinition } from '../types';
const paths: Record<string, ReactNode> = {
  blocks: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  bottle: <path d="M8 3h8M9 3v5l-4 4v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7l-4-4V3M5 14h14"/>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><path d="M9 9h6v6H9Z" fill="currentColor" opacity=".35"/></>,
  fruit: <><path d="M12 7C2 1-1 20 9 21q3-1 6 0C25 20 22 1 12 7Zm0 0q0-5 5-6"/><path d="M13 4q1-4 6-2-2 4-6 2Z" fill="currentColor" opacity=".4"/></>,
  leaf: <path d="M20 3C8 2 2 7 5 15c2 7 15 5 15-12ZM4 21 15 9M9 15v-5m0 5h5"/>,
  undo: <path d="m8 3-5 5 5 5M3 8h10a6 6 0 0 1 0 12"/>,
  rotate: <path d="M20 10a8 8 0 1 0-1 7M20 4v6h-6"/>,
  hint: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>,
  reset: <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>,
  heart: <path d="M20 5c-3-3-7 0-8 2-1-2-5-5-8-2-5 5 3 11 8 15 5-4 13-10 8-15Z"/>,
  cup: <path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm12 1h2a3 3 0 0 1 0 6h-2M8 2v3m5-3v3M2 22h18"/>,
  book: <path d="M12 6C8 3 4 4 2 5v14c3-1 6-1 10 1 4-2 7-2 10-1V5c-2-1-6-2-10 1Zm0 0v14"/>,
  sound: <path d="m11 4-6 5H2v6h3l6 5Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>,
  muted: <path d="m11 4-6 5H2v6h3l6 5Zm5 5 5 6m0-6-5 6"/>,
  pause: <path d="M8 4v16M16 4v16"/>, play: <path d="m7 3 14 9-14 9Z"/>, arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
};
export const Icon = ({ name, style }: { name: string; style?: CSSProperties }) => <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={style}>{paths[name] || paths.hint}</svg>;
export const Flower = ({ className }: { className?: string }) => <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M16 12C5-1 1 11 11 16-1 22 11 32 16 21c5 11 17 1 5-5C31 11 27-1 16 12Z" fill="#a5b691" stroke="#768b69" strokeWidth="1.2"/><circle cx="16" cy="16" r="4.1" fill="#f5de9b" stroke="#9b915b"/></svg>;
export const GameHeader = ({ icon, title, subtitle, label = '悠闲 · 不计时' }: { icon: string; title: string; subtitle: string; label?: string }) => <div className="panel-header"><div className="panel-title"><Icon name={icon}/><div><h2>{title}</h2><p>{subtitle}</p></div></div><span className="small-pill"><Icon name="leaf"/>{label}</span></div>;
export const Stat = ({ label, value, unit, secondary }: { label: string; value: ReactNode; unit?: string; secondary?: boolean }) => <div className={`score-item${secondary ? ' secondary' : ''}`}><small>{label}</small><strong>{value}</strong>{unit && <span className="unit">{unit}</span>}</div>;
export const Tool = ({ icon, children, onClick, disabled, primary, title, testId }: { icon: string; children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; title?: string; testId?: string }) => <button type="button" className={`tool${primary ? ' primary' : ''}`} onClick={onClick} disabled={disabled} title={title} data-testid={testId}><Icon name={icon}/>{children}</button>;
export const Instructions = ({ game }: { game: GameDefinition }) => <div className="instruction-card"><h3><Icon name="book"/>一点点小提示</h3><ol>{game.instructions.map(item => <li key={item.title}><span><strong>{item.title}</strong>{item.body}</span></li>)}</ol><p className="tip-note">{game.tip}</p></div>;
