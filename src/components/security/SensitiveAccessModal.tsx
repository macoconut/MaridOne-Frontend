import { useEffect, useMemo, useRef, useState } from 'react';
import ModalCloseButton from '../dialog/ModalCloseButton';
import {
  fetchSensitiveAccessState,
  sendSensitiveAccessEmailCode,
  verifySensitiveAccess,
  type SensitiveAccessMode,
} from '../../lib/sensitiveAccess';
import { getFriendlyErrorMessage } from '../../lib/uiErrors';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';
import './SensitiveAccessModal.css';

type SensitiveAccessModalProps = {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  notice?: string;
};

const DIGIT_COUNT = 6;

export default function SensitiveAccessModal({
  open,
  onClose,
  onVerified,
  notice,
}: SensitiveAccessModalProps) {
  const [loadingState, setLoadingState] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [mode, setMode] = useState<SensitiveAccessMode>('PASSWORD');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  useEscapeDismiss(open, onClose, 40);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingState(true);
    setErrorMessage('');
    setPassword('');
    setCode('');
    setMode('PASSWORD');

    void (async () => {
      try {
        const state = await fetchSensitiveAccessState();
        if (cancelled) return;
        setTwoFactorEnabled(Boolean(state.twoFactorEnabled));
      } catch (error) {
        if (cancelled) return;
        setTwoFactorEnabled(false);
        setErrorMessage(getFriendlyErrorMessage(error, 'generic'));
      } finally {
        if (!cancelled) {
          setLoadingState(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || mode === 'PASSWORD') return;
    inputRefs.current[0]?.focus();
  }, [mode, open]);

  const trimmedCode = useMemo(() => code.replace(/\D/g, '').slice(0, DIGIT_COUNT), [code]);

  function updateCode(next: string) {
    setCode(next.replace(/\D/g, '').slice(0, DIGIT_COUNT));
  }

  function handleDigitChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const nextDigits = Array.from({ length: DIGIT_COUNT }, (_, currentIndex) => trimmedCode[currentIndex] ?? '');
    nextDigits[index] = digit;
    updateCode(nextDigits.join(''));

    if (digit && index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    }
  }

  function handleDigitKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !trimmedCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < DIGIT_COUNT - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGIT_COUNT);
    if (!pasted) return;

    updateCode(pasted);
    const focusIndex = Math.min(pasted.length, DIGIT_COUNT) - 1;
    if (focusIndex >= 0) {
      inputRefs.current[focusIndex]?.focus();
      inputRefs.current[focusIndex]?.select();
    }
  }

  async function handleSendEmailCode() {
    setErrorMessage('');
    setSendingCode(true);

    try {
      await sendSensitiveAccessEmailCode();
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit() {
    setErrorMessage('');
    setSubmitting(true);

    try {
      if (mode === 'PASSWORD') {
        if (!password.trim()) {
          throw new Error('Enter your current password to continue.');
        }
        await verifySensitiveAccess({ mode, password });
      } else {
        if (!/^\d{6}$/.test(trimmedCode)) {
          throw new Error('Enter the current 6-digit verification code.');
        }
        await verifySensitiveAccess({ mode, code: trimmedCode });
      }

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

        <div className="sensitiveAccessModal__modes">
          <button
            type="button"
            className={`sensitiveAccessModal__mode ${mode === 'PASSWORD' ? 'is-selected' : ''}`}
            onClick={() => setMode('PASSWORD')}
          >
            Password
          </button>
          {twoFactorEnabled ? (
            <>
              <button
                type="button"
                className={`sensitiveAccessModal__mode ${mode === 'AUTHENTICATOR' ? 'is-selected' : ''}`}
                onClick={() => setMode('AUTHENTICATOR')}
              >
                Authenticator
              </button>
              <button
                type="button"
                className={`sensitiveAccessModal__mode ${mode === 'EMAIL_OTP' ? 'is-selected' : ''}`}
                onClick={() => setMode('EMAIL_OTP')}
              >
                Email Code
              </button>
            </>
          ) : null}
        </div>

        {loadingState ? (
          <div className="sensitiveAccessModal__status">Loading your verification options...</div>
        ) : mode === 'PASSWORD' ? (
          <label className="sensitiveAccessModal__field">
            <span>Current Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </label>
        ) : (
          <div className="sensitiveAccessModal__otpPanel">
            <div className="sensitiveAccessModal__otpIntro">
              {mode === 'EMAIL_OTP'
                ? 'Request a 6-digit code from your verified email, then enter it below.'
                : 'Enter the current 6-digit code from your authenticator app.'}
            </div>

            {mode === 'EMAIL_OTP' ? (
              <button
                type="button"
                className="sensitiveAccessModal__sendCode btn btn--ghost"
                onClick={() => void handleSendEmailCode()}
                disabled={sendingCode || submitting}
              >
                {sendingCode ? 'Sending code...' : 'Send Code to Verified Email'}
              </button>
            ) : null}

            <div className="sensitiveAccessModal__otpGroup" role="group" aria-label="Sensitive access verification code">
              {Array.from({ length: DIGIT_COUNT }).map((_, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  className="sensitiveAccessModal__otpInput"
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={trimmedCode[index] ?? ''}
                  onChange={(event) => handleDigitChange(index, event.target.value)}
                  onKeyDown={(event) => handleDigitKeyDown(index, event)}
                  onFocus={(event) => event.target.select()}
                  onPaste={handleDigitPaste}
                  aria-label={`Verification digit ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {errorMessage ? <div className="sensitiveAccessModal__error">{errorMessage}</div> : null}

        <div className="sensitiveAccessModal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void handleSubmit()} disabled={loadingState || submitting}>
            {submitting ? 'Verifying...' : 'Verify Access'}
          </button>
        </div>
      </article>
    </div>
  );
}
