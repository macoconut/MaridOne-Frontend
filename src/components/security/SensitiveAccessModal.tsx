import { useEffect, useState } from 'react';
import LargePopup from '../dialog/LargePopup';
import { verifySensitiveAccess } from '../../lib/sensitiveAccess';
import { getFriendlyErrorMessage } from '../../lib/uiErrors';

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

  return (
    <LargePopup
      open={open}
      ariaLabel="Sensitive access verification"
      title="Verify Before Viewing"
      subtitle={
        notice || 'This HR action exposes protected employee information. Verify your identity before continuing.'
      }
      size="md"
      onClose={onClose}
      closeDisabled={submitting}
      dismissOnBackdrop
      footer={(
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Verifying...' : 'Verify Access'}
          </button>
        </>
      )}
    >
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
    </LargePopup>
  );
}
