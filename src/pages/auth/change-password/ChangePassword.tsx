import { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useUiDialog } from '@/components/dialog/useUiDialog';
import { expireCurrentSession } from '@/lib/api/api';
import { changeOwnPassword } from '@/lib/utils/accountSecurity';
import { getUserRole, setRequiresPasswordChange } from '@/lib/utils/session';
import { getRoleHomePath } from '@/lib/utils/roleRoutes';
import '../login/Login.css';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useUiDialog();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showError('Fill in your current password, your new password, and the confirmation.', 'Change password');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Your new password and confirmation do not match.', 'Change password');
      return;
    }

    if (newPassword.trim().length < 8) {
      showError('Your new password must be at least 8 characters long.', 'Change password');
      return;
    }

    setIsSaving(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);

      setRequiresPasswordChange(false);
      const role = getUserRole();
      showSuccess('Your password has been updated. You can continue to your workspace.', 'Password updated');
      navigate(role ? getRoleHomePath(role) : '/login', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update password right now.';
      showError(message, 'Change password');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    setIsSaving(true);
    try {
      await expireCurrentSession();
      navigate('/login', { replace: true });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="elogin">
      <div className="elogin__left">
        <div className="eloginCard">
          <form className="eloginForm" onSubmit={handleSubmit}>
            <div className="eloginHint">
              <strong>Temporary password detected</strong>
              <span>
                HR gave you a temporary password. Change it now so your next login uses a password only you
                know. New passwords must be at least 8 characters.
              </span>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="cp-current-password">
                Current Temporary Password
              </label>
              <div className="passwordWrap">
                <input
                  id="cp-current-password"
                  className="field__input passwordWrap__input"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  disabled={isSaving}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eyeBtn"
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  onClick={() => setShowCurrentPassword((value) => !value)}
                >
                  {showCurrentPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="cp-new-password">
                New Password
              </label>
              <div className="passwordWrap">
                <input
                  id="cp-new-password"
                  className="field__input passwordWrap__input"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  disabled={isSaving}
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
              <label className="field__label" htmlFor="cp-confirm-password">
                Confirm New Password
              </label>
              <div className="passwordWrap">
                <input
                  id="cp-confirm-password"
                  className="field__input passwordWrap__input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isSaving}
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

            <div className="eloginRow">
              <button
                type="button"
                className="submitBtn submitBtn--ghost"
                onClick={handleSignOut}
                disabled={isSaving}
              >
                Sign Out
              </button>

              <button className="submitBtn" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save New Password'}
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
