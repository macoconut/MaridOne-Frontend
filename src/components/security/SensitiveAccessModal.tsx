import { useEffect, useState } from 'react';
import ModalCloseButton from '../dialog/ModalCloseButton';
import { verifySensitiveAccess } from '../../lib/sensitiveAccess';
import { getFriendlyErrorMessage } from '../../lib/uiErrors';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';
import './SensitiveAccessModal.css';

type SensitiveAccessModalProps = {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  notice?: string;
};

export default function SensitiveAccessModal({
  open,
  onClose,
  onVerified,
  notice,
}: SensitiveAccessModalProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  useEscapeDismiss(open, onClose, 40);

  useEffect(() => {
    if (!open) return undefined;
    setErrorMessage('');
    setPassword('');
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [open]);

  async function handleSubmit() {
    setErrorMessage('');
    setSubmitting(true);

    try {
      if (!password.trim()) {
        throw new Error('Enter your password to continue.');
      }
      await verifySensitiveAccess({ password });

      onVerified();
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="sensitiveAccessModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sensitive access verification"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <article className="sensitiveAccessModal">
        <div className="sensitiveAccessModal__top">
          <div className="sensitiveAccessModal__heading">
            <div className="sensitiveAccessModal__eyebrow">Sensitive Access</div>
            <h2 className="sensitiveAccessModal__title">Verify Before Viewing</h2>
            <p className="sensitiveAccessModal__subtitle">
              {notice || 'This HR action exposes protected employee information. Verify your identity before continuing.'}
            </p>
          </div>
          <ModalCloseButton className="sensitiveAccessModal__close" aria-label="Close sensitive access modal" onClick={onClose} />
        </div>

        <div className="sensitiveAccessModal__rule" />
        <label className="sensitiveAccessModal__field">
          <span>Enter Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </label>

        {errorMessage ? <div className="sensitiveAccessModal__error">{errorMessage}</div> : null}

        <div className="sensitiveAccessModal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Verifying...' : 'Verify Access'}
          </button>
        </div>
      </article>
    </div>
  );
}
