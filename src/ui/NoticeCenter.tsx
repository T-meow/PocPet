import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, Info, MessageCircle, X } from 'lucide-react';
import { activityText as L } from '../core/kitchenRecipes';
import { DialogShell } from './DialogShell';

export type Notice = { id: number; text: string; kind: 'info' | 'success' | 'error'; at: number };
export const appendNotice = (history: Notice[], notice: Notice) => [notice, ...history.filter((entry) => entry.id !== notice.id)].slice(0, 20);
export const useNotices = () => {
  const [history, setHistory] = useState<Notice[]>([]);
  const [current, setCurrent] = useState<Notice | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const nextId = useRef(0);
  const notify = useCallback((text: string, kind: Notice['kind'] = 'info') => {
    if (!text.trim()) return;
    const notice = { id: ++nextId.current, text, kind, at: Date.now() };
    setHistory((old) => appendNotice(old, notice));
    setCurrent(notice);
  }, []);
  return { history, current, historyOpen, setHistoryOpen, dismiss: () => setCurrent(null), notify };
};
export const NoticeCenter = ({ controller, recentEvent }: { controller: ReturnType<typeof useNotices>; recentEvent: string }) => {
  const { history, current, historyOpen, setHistoryOpen } = controller;
  const [expanded, setExpanded] = useState(false);
  const dismissRef = useRef(controller.dismiss);
  dismissRef.current = controller.dismiss;
  useEffect(() => setExpanded(false), [current?.id]);
  useEffect(() => {
    if (!current || expanded || historyOpen) return;
    const timer = window.setTimeout(() => dismissRef.current(), 5000);
    return () => window.clearTimeout(timer);
  }, [current?.id, expanded, historyOpen]);
  const Icon = current?.kind === 'error' ? Info : current?.kind === 'success' ? Check : MessageCircle;
  return <>
    {current && <div key={current.id} className={`v2-notification${expanded ? ' expanded' : ''}`} data-kind={current.kind} role="status" aria-live="polite">
      <Icon size={19} />
      <div className="notice-copy">
        <p>{current.text}</p>
        {current.text.length > 45 && <button className="notice-expand" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? L('收起', 'Collapse') : L('展开全文', 'Read more')}</button>}
      </div>
      <button className="icon-button" onClick={() => setHistoryOpen(true)} aria-label={L('查看最近 20 条消息', 'View the last 20 messages')}><Bell size={17} /></button>
      <button className="icon-button" onClick={controller.dismiss} aria-label={L('关闭通知', 'Dismiss notification')}><X size={18} /></button>
    </div>}
    {historyOpen && <DialogShell className="notice-history-modal" backdropClassName="notice-history-backdrop" labelId="notice-history-title" onClose={() => setHistoryOpen(false)}>
      <header className="dialog-header"><h2 id="notice-history-title"><Bell size={21} />{L('最近的小消息', 'Recent little messages')}</h2><button className="icon-button" onClick={() => setHistoryOpen(false)} aria-label={L('关闭', 'Close')}><X /></button></header>
      <div className="notice-history">{(history.length ? history : [{ id: 0, at: 0, text: recentEvent, kind: 'info' as const }]).map((notice) => <article key={notice.id}>{notice.at > 0 && <time>{new Date(notice.at).toLocaleTimeString()}</time>}<p>{notice.text}</p></article>)}</div>
    </DialogShell>}
  </>;
};
