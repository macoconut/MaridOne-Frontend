import { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import { expireCurrentSession } from '../../../lib/api';
import { changeOwnPassword } from '../../../lib/accountSecurity';
import { getUserRole, setRequiresPasswordChange } from '../../../lib/session';
import { getRoleHomePath } from '../../../lib/roleRoutes';
import './ChangePassword.css';

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
    <div className="changePasswordPage">
      <div className="changePasswordCard">
        <div className="changePasswordIntro">
          <p className="changePasswordEyebrow">Temporary password detected</p>
          <h1>Set your own password before continuing</h1>
          <p>
            HR gave you a temporary password for this account. Change it now so your next login uses a password that
            only you know.
          </p>
        </div>

        <form className="changePasswordForm" onSubmit={handleSubmit}>
          <label className="changePasswordField">
            <span>Current Temporary Password</span>
            <div className="changePasswordInputWrap">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isSaving}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="changePasswordToggle"
                onClick={() => setShowCurrentPassword((value) => !value)}
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              >
                {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <label className="changePasswordField">
            <span>New Password</span>
            <div className="changePasswordInputWrap">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSaving}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="changePasswordToggle"
                onClick={() => setShowNewPassword((value) => !value)}
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                {showNewPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <label className="changePasswordField">
            <span>Confirm New Password</span>
            <div className="changePasswordInputWrap">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSaving}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="changePasswordToggle"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <div className="changePasswordHint">
            You’ll only see this screen while your account is still using an HR-issued temporary password. Your new
            password must be at least 8 characters long.
          </div>

          <div className="changePasswordActions">
            <button type="button" className="changePasswordSecondary" onClick={handleSignOut} disabled={isSaving}>
              Sign Out
            </button>
            <button type="submit" className="changePasswordPrimary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save New Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
