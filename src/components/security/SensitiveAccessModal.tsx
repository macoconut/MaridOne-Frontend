import { useEffect, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setErrorMessage('');
    setPassword('');
    setShowPassword(false);
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
        notice || 'Enter your password to continue with this protected HR action.'
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
      <div className="sensitiveAccessModal__field">
        <div className="sensitiveAccessModal__inputWrap">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !submitting) {
                void handleSubmit();
              }
            }}
            placeholder="Enter your password"
            aria-label="Password"
            autoComplete="current-password"
            disabled={submitting}
          />
          <button
            type="button"
            className="sensitiveAccessModal__toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={submitting}
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>
      </div>

      {errorMessage ? <div className="sensitiveAccessModal__error">{errorMessage}</div> : null}
    </LargePopup>
  );
}
