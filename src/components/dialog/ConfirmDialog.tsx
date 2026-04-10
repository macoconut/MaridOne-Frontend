import { createPortal } from 'react-dom';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEscapeDismiss(open && !isBusy, onCancel, 100);

  if (!open) return null;

  return createPortal(
    <div className="confirmDialog__backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="confirmDialog__card">
        <h3 className="confirmDialog__title">{title}</h3>
        <p className="confirmDialog__message">{message}</p>

        <div className="confirmDialog__actions">
          <button
            className="confirmDialog__btn confirmDialog__btn--ghost"
            type="button"
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            className="confirmDialog__btn"
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? 'Submitting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
