import { useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { DialogShell } from '../DialogShell';
import { playSfx } from '../../core/audio';

export interface HelpContent {
  title: string;
  overview: ReactNode;
  details?: ReactNode;
}

export const HelpButton = ({ title, overview, details, label = '说明' }: HelpContent & { label?: string }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'overview' | 'details'>('overview');
  const id = useId();
  const close = () => { playSfx('close'); setOpen(false); };
  const tabs = details ? ['overview', 'details'] as const : ['overview'] as const;
  return <>
    <button type="button" className="game-help-button" aria-label={title + '说明'} aria-haspopup="dialog" aria-expanded={open} onClick={event => { event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); playSfx('open'); setTab('overview'); setOpen(true); }}><Info size={16} aria-hidden="true" /><span>{label}</span></button>
    {open && createPortal(<DialogShell className="game-help-dialog" backdropClassName="game-help-backdrop" labelId={id + '-title'} onClose={close}>
      <header className="game-help-header"><h2 id={id + '-title'}>{title}</h2><button type="button" className="icon-button" onClick={close} aria-label="关闭说明"><X size={21} /></button></header>
      {details && <div className="game-help-tabs" role="tablist" aria-label="说明内容">{tabs.map((value, index) => <button key={value} type="button" role="tab" id={id + '-' + value} aria-controls={id + '-content'} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
        setTab(tabs[next]);
        (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
      }}>{value === 'overview' ? '玩法说明' : '计算详情'}</button>)}</div>}
      <div className="game-help-body" id={id + '-content'} role={details ? 'tabpanel' : undefined} aria-labelledby={details ? id + '-' + tab : undefined} tabIndex={0}>{tab === 'details' && details ? details : overview}</div>
    </DialogShell>, document.body)}
  </>;
};
