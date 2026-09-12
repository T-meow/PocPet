import { AlertTriangle } from 'lucide-react';
import { DialogShell } from './DialogShell';

interface ConfirmDialogProps {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmTone?: 'danger' | 'primary';
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  title,
  message,
  cancelLabel,
  confirmLabel,
  confirmTone = 'danger',
  disabled = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) => (
    <DialogShell
      className="confirm-modal"
      backdropClassName="modal-backdrop--confirm"
      role="alertdialog"
      labelId="confirm-dialog-title"
      descriptionId="confirm-dialog-message"
      onClose={onCancel}
      closeOnEscape={false}
    >
      <div className="confirm-modal__icon" aria-hidden="true">
        <AlertTriangle size={28} />
      </div>
      <div className="confirm-modal__copy">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
      </div>
      <div className="confirm-modal__actions">
        <button type="button" className="text-button confirm-modal__cancel" disabled={disabled} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`${confirmTone === 'danger' ? 'danger-button' : 'primary-button'} confirm-modal__confirm`}
          disabled={disabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
);
