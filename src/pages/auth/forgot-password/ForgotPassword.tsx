import { useLoading } from '../../../context/useLoading';
import { useRef, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useUiDialog } from '../../../components/dialog/useUiDialog';
import { apiFetchText } from '../../../lib/api';
import '../login/Login.css';

export default function ForgotPassword() {
  const { showLoading, hideLoading } = useLoading();

  const navigate = useNavigate();
  const { showError, showInfo, showSuccess } = useUiDialog();
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      showError('Enter your username first so we know where to send the reset code.', 'Forgot password');
      return;
    }

    showLoading();
    setIsSubmitting(true);
    try {
      await apiFetchText('/api/auth/forgot-password/request', {
        method: 'POST',
        body: JSON.stringify({ username: trimmedUsername }),
      });
      setCodeSent(true);
      showInfo(
        'If that account exists, a 6-digit reset code has been sent to the email on file.',
        'Check your email'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send the reset code right now.';
      showError(message, 'Forgot password');
    } finally {
      hideLoading();
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedCode = code.trim();
    if (!trimmedUsername || !trimmedCode || !newPassword || !confirmPassword) {
      showError('Fill in your username, the email code, and your new password.', 'Forgot password');
      return;
    }

    if (!/^\d{6}$/.test(trimmedCode)) {
      showError('Enter the 6-digit code that was sent to your email.', 'Forgot password');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Your new password and confirmation do not match.', 'Forgot password');
      return;
    }

    if (newPassword.trim().length < 8) {
      showError('Your new password must be at least 8 characters long.', 'Forgot password');
      return;
    }

    showLoading();
    setIsSubmitting(true);
    try {
      await apiFetchText('/api/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({
          username: trimmedUsername,
          code: trimmedCode,
          newPassword,
        }),
      });

      showSuccess('Your password has been reset. You can log in with the new password now.', 'Password reset');
      navigate('/login', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reset the password right now.';
      showError(message, 'Forgot password');
    } finally {
      hideLoading();
      setIsSubmitting(false);
    }
  }

  function updateCode(next: string) {
    setCode(next.replace(/\D/g, '').slice(0, 6));
  }

  function handleDigitChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const nextDigits = Array.from({ length: 6 }, (_, currentIndex) => code[currentIndex] ?? '');
    nextDigits[index] = digit;
    updateCode(nextDigits.join(''));

    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
      codeInputRefs.current[index + 1]?.select();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      codeInputRefs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      codeInputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    updateCode(pasted);
    const focusIndex = Math.min(pasted.length, 6) - 1;
    if (focusIndex >= 0) {
      codeInputRefs.current[focusIndex]?.focus();
      codeInputRefs.current[focusIndex]?.select();
    }
  }

  return (
    <div className="elogin">
      <div className="elogin__left">
        <button
          className="eloginBack"
          type="button"
          onClick={() => navigate('/login')}
          aria-label="Back to login"
        >
          <span className="eloginBack__arrow" aria-hidden="true" />
        </button>

        <div className="eloginCard">
          <form className="eloginForm" onSubmit={codeSent ? handleResetPassword : handleSendCode}>
            <div className="eloginHint">
              <strong>Forgot your password?</strong>
              <span>
                Enter your username to receive a 6-digit reset code by email, then set a new password with at
                least 8 characters.
              </span>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="fp-username">
                Username
              </label>
              <input
                id="fp-username"
                className="field__input"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={isSubmitting || codeSent}
                autoComplete="username"
              />
            </div>

            {codeSent && (
              <>
                <div className="field">
                  <label className="field__label">Email Reset Code</label>
                  <div className="otpGroup" role="group" aria-label="6-digit email reset code">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          codeInputRefs.current[index] = element;
                        }}
                        className="otpInput"
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        value={code[index] ?? ''}
                        onChange={(event) => handleDigitChange(index, event.target.value)}
                        onKeyDown={(event) => handleKeyDown(index, event)}
                        onFocus={(event) => event.target.select()}
                        onPaste={handlePaste}
                        aria-label={`Code digit ${index + 1}`}
                        disabled={isSubmitting}
                      />
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="fp-new-password">
                    New Password
                  </label>
                  <div className="passwordWrap">
                    <input
                      id="fp-new-password"
                      className="field__input passwordWrap__input"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="eyeBtn"
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      onClick={() => setShowNewPassword((value) => !value)}
                    >
                      {showNewPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="fp-confirm-password">
                    Confirm New Password
                  </label>
                  <div className="passwordWrap">
                    <input
                      id="fp-confirm-password"
                      className="field__input passwordWrap__input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="eyeBtn"
                      aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                      onClick={() => setShowConfirmPassword((value) => !value)}
                    >
                      {showConfirmPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <div className="eloginTwoFactorAction">
                  <button
                    type="button"
                    className="eloginTwoFactorSwitch"
                    onClick={() => {
                      setCodeSent(false);
                      setCode('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    disabled={isSubmitting}
                  >
                    Use a different username
                  </button>
                </div>
              </>
            )}

            <div className="eloginRow">
              <button
                type="button"
                className="submitBtn submitBtn--ghost"
                onClick={() => navigate('/login')}
                disabled={isSubmitting}
              >
                Back to Login
              </button>

              <button className="submitBtn" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? codeSent
                    ? 'Resetting...'
                    : 'Sending...'
                  : codeSent
                    ? 'Reset Password'
                    : 'Send Reset Code'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="elogin__right">
        <div className="eloginHero">
          <img
            className="eloginHero__img"
            src="/images/product-login-page.png"
            alt="Marid Industries product display"
          />
          <div className="eloginHero__shade" aria-hidden="true" />

          <div className="eloginHero__brand">
            <img
              className="eloginHero__icon"
              src="/images/marid-logo-transparent.png"
              alt="MaridOne logo"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
