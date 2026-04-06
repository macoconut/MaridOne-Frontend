import { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import { apiFetchText } from '../../../lib/api';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { showError, showInfo, showSuccess } = useUiDialog();
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
      setIsSubmitting(false);
    }
  }

  return (
    <div className="forgotPasswordPage">
      <div className="forgotPasswordCard">
        <div className="forgotPasswordIntro">
          <p className="forgotPasswordEyebrow">Forgot your password?</p>
          <h1>Reset it through your email</h1>
          <p>
            Enter your username, request the reset code, then type the 6-digit code from your email before setting a
            new password with at least 8 characters.
          </p>
        </div>

        <form className="forgotPasswordForm" onSubmit={codeSent ? handleResetPassword : handleSendCode}>
          <label className="forgotPasswordField">
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSubmitting || codeSent}
              autoComplete="username"
            />
          </label>

          {codeSent && (
            <>
              <label className="forgotPasswordField">
                <span>Email Reset Code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isSubmitting}
                />
              </label>

              <label className="forgotPasswordField">
                <span>New Password</span>
                <div className="forgotPasswordInputWrap">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="forgotPasswordToggle"
                    onClick={() => setShowNewPassword((value) => !value)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </label>

              <label className="forgotPasswordField">
                <span>Confirm New Password</span>
                <div className="forgotPasswordInputWrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="forgotPasswordToggle"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </label>

              <button
                type="button"
                className="forgotPasswordLinkButton"
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
            </>
          )}

          <div className="forgotPasswordActions">
            <button
              type="button"
              className="forgotPasswordSecondary"
              onClick={() => navigate('/login')}
              disabled={isSubmitting}
            >
              Back to Login
            </button>
            <button type="submit" className="forgotPasswordPrimary" disabled={isSubmitting}>
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
  );
}
