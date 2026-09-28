import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { registerDialogBack } from './dialogNavigation';

interface DialogShellProps {
  children: ReactNode;
  className: string;
  backdropClassName?: string;
  labelId: string;
  descriptionId?: string;
  onClose: () => void;
  closeOnEscape?: boolean;
  role?: 'dialog' | 'alertdialog';
  fullscreen?: boolean;
  closeOnBackdrop?: boolean;
}

type ScopedEntry = DialogShellProps & { id: symbol; owner?: symbol };
const ScopeContext = createContext<{ put: (entry: ScopedEntry) => void; remove: (id: symbol) => void; closeAll: () => void } | undefined>(undefined);
const OwnerContext = createContext<symbol | undefined>(undefined);
export const useCloseDialogScope = () => useContext(ScopeContext)?.closeAll;
export const DialogScope = ({ children, status }: { children: ReactNode; status?: ReactNode }) => {
  const [entries, setEntries] = useState<ScopedEntry[]>([]);
  const records = useRef(new Map<symbol, ScopedEntry>());
  const disposers = useRef(new Map<symbol, () => void>());
  const scope = useMemo(() => ({
    put: (entry: ScopedEntry) => {
      const existing = records.current.get(entry.id);
      records.current.set(entry.id, entry);
      if (!existing) disposers.current.set(entry.id, registerDialogBack(entry.id, () => records.current.get(entry.id)?.onClose()));
      setEntries([...records.current.values()]);
    },
    remove: (id: symbol) => {
      const remove = (key: symbol) => {
        for (const child of [...records.current.values()]) if (child.owner === key) remove(child.id);
        records.current.delete(key);
      };
      const dispose = disposers.current.get(id);
      remove(id);
      dispose?.();
      for (const [key, cleanup] of disposers.current) if (!records.current.has(key)) { cleanup(); disposers.current.delete(key); }
      setEntries([...records.current.values()]);
    },
    closeAll: () => records.current.values().next().value?.onClose(),
  }), []);
  useEffect(() => () => { for (const cleanup of disposers.current.values()) cleanup(); disposers.current.clear(); }, []);
  const active = entries[entries.length - 1];
  return <ScopeContext.Provider value={scope}>{children}{active && <DialogFrame {...active} backdropClassName={`exploration-backdrop ${active.backdropClassName ?? ''}`} className={`exploration-sheet ${active.className}`} focusKey={active.id}>
    {status && <div className="exploration-sheet-status">{status}</div>}
    {entries.map(entry => <div className="exploration-sheet-view" key={String(entries.indexOf(entry))} hidden={entry.id !== active.id}><OwnerContext.Provider value={entry.id}>{entry.children}</OwnerContext.Provider></div>)}
  </DialogFrame>}</ScopeContext.Provider>;
};

export const DialogShell = (props: DialogShellProps) => {
  const scope = useContext(ScopeContext), owner = useContext(OwnerContext), id = useRef(Symbol('sheet'));
  useLayoutEffect(() => {
    scope?.put({ ...props, id: id.current, owner });
  }, [scope, owner, props.children, props.className, props.backdropClassName, props.labelId, props.descriptionId, props.onClose, props.closeOnEscape, props.role, props.fullscreen, props.closeOnBackdrop]);
  useLayoutEffect(() => () => scope?.remove(id.current), [scope]);
  return scope ? null : <DialogFrame {...props} />;
};

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const dialogStack: symbol[] = [];
const dialogLayers = new Map<symbol, number>();
let bodyOverflowBeforeDialogs: string | undefined;

const DialogFrame = ({
  children,
  className,
  backdropClassName,
  labelId,
  descriptionId,
  onClose,
  closeOnEscape = true,
  role = 'dialog',
  fullscreen = false,
  closeOnBackdrop = false,
  focusKey,
}: DialogShellProps & { focusKey?: symbol }) => {
  const dialogRef = useRef<HTMLElement>(null);
  const dialogIdRef = useRef(Symbol('dialog'));
  const closeRef = useRef(onClose);
  const focusLayers = useRef<{ key: symbol; trigger: HTMLElement | null }[]>([]);

  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialogId = dialogIdRef.current;
    if (dialogStack.length === 0) bodyOverflowBeforeDialogs = document.body.style.overflow;
    dialogStack.push(dialogId);
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const backdrop = dialog?.parentElement;
    if (backdrop) {
      const baseLayer = Number(window.getComputedStyle(backdrop).zIndex) || 20;
      const layer = Math.max(baseLayer, ...dialogLayers.values()) + 1;
      backdrop.style.zIndex = String(layer);
      dialogLayers.set(dialogId, layer);
    }
    const focusTarget = Array.from(dialog?.querySelectorAll<HTMLElement>('[data-dialog-autofocus]') ?? []).find(node => node.getClientRects().length > 0) ?? Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).find(node => node.getClientRects().length > 0) ?? dialog;
    window.requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== dialogId) return;

      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(node => node.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const stackIndex = dialogStack.lastIndexOf(dialogId);
      if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
      dialogLayers.delete(dialogId);
      if (dialogStack.length === 0) {
        document.body.style.overflow = bodyOverflowBeforeDialogs ?? '';
        bodyOverflowBeforeDialogs = undefined;
      } else {
        document.body.style.overflow = 'hidden';
      }
      window.requestAnimationFrame(() => { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); });
    };
  }, [closeOnEscape]);

  useEffect(() => {
    if (!focusKey) return;
    const stack = focusLayers.current;
    const index = stack.findIndex(layer => layer.key === focusKey);
    const returning = index >= 0 ? stack.splice(index + 1)[0]?.trigger : undefined;
    if (index < 0) stack.push({ key: focusKey, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null });
    const dialog = dialogRef.current;
    const visible = (selector: string) => Array.from(dialog?.querySelectorAll<HTMLElement>(selector) ?? []).find(node => node.getClientRects().length > 0);
    const target = returning?.isConnected && returning.getClientRects().length ? returning : visible('[data-dialog-autofocus]') ?? visible(focusableSelector) ?? dialog;
    const frame = window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [focusKey]);

  return (
    <div className={`modal-backdrop${fullscreen ? ' modal-backdrop--fullscreen' : ''}${backdropClassName ? ` ${backdropClassName}` : ''}`} role="presentation" onClick={event => { if (event.target === event.currentTarget && closeOnBackdrop) closeRef.current(); }}>
      <section
        ref={dialogRef}
        className={`dialog-shell ${className}${fullscreen ? ' dialog-shell--fullscreen' : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  );
};
