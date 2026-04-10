import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';

export type AlertDialogVariant = 'error' | 'info' | 'success';

type AlertDialogProps = {
  open: boolean;
  title: string;
  message: string;
  variant?: AlertDialogVariant;
  confirmLabel?: string;
  onClose: () => void;
};

function eyebrowLabel(variant: AlertDialogVariant) {
  if (variant === 'error') return 'Error';
  if (variant === 'success') return 'Success';
  return 'Notice';
}

export default function AlertDialog({
  open,
  title,
  message,
  variant = 'info',
  confirmLabel = 'Close',
  onClose,
}: AlertDialogProps) {
  const titleId = useId();
  const messageId = useId();
  useEscapeDismiss(open, onClose, 200);

  if (!open) return null;

  return createPortal(
    <div
      className="alertDialog__backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onClick={onClose}
    >
      <div
        className={`alertDialog__card is-${variant}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="alertDialog__eyebrow">{eyebrowLabel(variant)}</div>
        <h2 id={titleId} className="alertDialog__title">
          {title}
        </h2>
        <p id={messageId} className="alertDialog__message">
          {message}
        </p>

        <div className="alertDialog__actions">
          <button type="button" className="alertDialog__btn" onClick={onClose}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
