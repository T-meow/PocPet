import { useEffect, useRef, type ReactNode } from 'react';

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
}

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

export const DialogShell = ({
  children,
  className,
  backdropClassName,
  labelId,
  descriptionId,
  onClose,
  closeOnEscape = true,
  role = 'dialog',
  fullscreen = false,
}: DialogShellProps) => {
  const dialogRef = useRef<HTMLElement>(null);
  const dialogIdRef = useRef(Symbol('dialog'));
  const closeRef = useRef(onClose);

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
    const focusTarget = dialog?.querySelector<HTMLElement>(focusableSelector) ?? dialog;
    window.requestAnimationFrame(() => focusTarget?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== dialogId) return;

      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
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
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [closeOnEscape]);

  return (
    <div className={`modal-backdrop${fullscreen ? ' modal-backdrop--fullscreen' : ''}${backdropClassName ? ` ${backdropClassName}` : ''}`} role="presentation">
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
