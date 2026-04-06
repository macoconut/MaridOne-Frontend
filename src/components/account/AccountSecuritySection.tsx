import { useEffect, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import type { TwoFactorSetupResponse } from '../../lib/accountSecurity';

type PasswordChangeRequest = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type AccountSecuritySectionProps = {
  savedEmail: string;
  emailDirty: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorCode: string;
  setup: TwoFactorSetupResponse | null;
  statusMessage: string;
  sendingVerification: boolean;
  startingTwoFactor: boolean;
  confirmingTwoFactor: boolean;
  disablingTwoFactor: boolean;
  changingPassword: boolean;
  canChangePasswordNow: boolean;
  passwordChangeAvailableAtLabel: string;
  onTwoFactorCodeChange: (value: string) => void;
  onSendVerification: () => void;
  onStartTwoFactor: () => void;
  onConfirmTwoFactor: () => void;
  onDisableTwoFactor: () => void;
  onChangePassword: (payload: PasswordChangeRequest) => void;
};

export default function AccountSecuritySection({
  savedEmail,
  emailDirty,
  emailVerified,
  twoFactorEnabled,
  twoFactorCode,
  setup,
  statusMessage,
  sendingVerification,
  startingTwoFactor,
  confirmingTwoFactor,
  disablingTwoFactor,
  changingPassword,
  canChangePasswordNow,
  passwordChangeAvailableAtLabel,
  onTwoFactorCodeChange,
  onSendVerification,
  onStartTwoFactor,
  onConfirmTwoFactor,
  onDisableTwoFactor,
  onChangePassword,
}: AccountSecuritySectionProps) {
  const emailReady = savedEmail.trim().length > 0 && !emailDirty;
  const isBusy =
    sendingVerification || startingTwoFactor || confirmingTwoFactor || disablingTwoFactor || changingPassword;
  const [showManualSecret, setShowManualSecret] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorSubmitAttempted, setTwoFactorSubmitAttempted] = useState(false);
  const [passwordSubmitAttempted, setPasswordSubmitAttempted] = useState(false);
  const emailStatusClass = !savedEmail.trim()
    ? 'is-neutral'
    : emailVerified
      ? 'is-success'
      : 'is-warning';
  const emailStatusLabel = !savedEmail.trim()
    ? 'No Email'
    : emailVerified
      ? 'Verified'
      : 'Not Verified';
  const verificationButtonLabel = sendingVerification
    ? 'Sending...'
    : emailVerified
      ? 'Resend Verification Email'
      : 'Send Verification Email';

  useEffect(() => {
    if (!setup) {
      setShowManualSecret(false);
      return;
    }

    if (!setup.qrCodeImageUri) {
      setShowManualSecret(true);
    }
  }, [setup]);

  function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPasswordSubmitAttempted(true);
    onChangePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  }

  function handleTwoFactorSubmit() {
    setTwoFactorSubmitAttempted(true);
    onConfirmTwoFactor();
  }

  return (
    <section className="dashSecurity">
      <div className="dashSecurity__grid">
        <article className="dashSecurityCard">
          <div className="dashSecurityCard__head">
            <div>
              <h3>Email Verification</h3>
              <p>{savedEmail || 'No saved email yet.'}</p>
            </div>
            <span className={`dashSecurityPill ${emailStatusClass}`}>{emailStatusLabel}</span>
          </div>

          <p className="dashSecurityCard__copy">
            {!savedEmail.trim()
              ? 'Add and save an email address first so we know where to send the verification link.'
              : emailVerified
                ? 'This email address is already verified. If you change it later, the new address will need to be verified again.'
                : 'This email address is not verified yet. We can send a verification link to your currently saved address.'}
          </p>

          {emailDirty && (
            <p className="dashSecurityCard__note">
              Save your email changes first so the verification link goes to the right inbox.
            </p>
          )}

          <div className="dashSecurityCard__actions">
            <button
              type="button"
              className="dashSecurityBtn"
              onClick={onSendVerification}
              disabled={!emailReady || isBusy}
            >
              {verificationButtonLabel}
            </button>
          </div>
        </article>

        <article className="dashSecurityCard">
          <div className="dashSecurityCard__head">
            <div>
              <h3>Two-Factor Authentication</h3>
              <p>{twoFactorEnabled ? 'Authenticator app is active.' : 'Authenticator app is not set up yet.'}</p>
            </div>
            <span className={`dashSecurityPill ${twoFactorEnabled ? 'is-success' : 'is-neutral'}`}>
              {twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <p className="dashSecurityCard__copy">
            Supported apps include Google Authenticator, Microsoft Authenticator, Authy, and 1Password.
          </p>

          <div className="dashSecurityCard__actions">
            {twoFactorEnabled ? (
              <button
                type="button"
                className="dashSecurityBtn dashSecurityBtn--ghost"
                onClick={onDisableTwoFactor}
                disabled={isBusy}
              >
                {disablingTwoFactor ? 'Disabling...' : 'Disable 2FA'}
              </button>
            ) : (
              <button
                type="button"
                className="dashSecurityBtn"
                onClick={onStartTwoFactor}
                disabled={isBusy}
              >
                {startingTwoFactor ? 'Preparing...' : 'Set Up 2FA'}
              </button>
            )}
          </div>

          {setup && !twoFactorEnabled && (
            <div className="dashTwoFactorSetup">
              <div className="dashTwoFactorSetup__media">
                {setup.qrCodeImageUri ? (
                  <img
                    className="dashTwoFactorSetup__qr"
                    src={setup.qrCodeImageUri}
                    alt="Authenticator QR code"
                  />
                ) : (
                  <div className="dashTwoFactorSetup__placeholder">QR code unavailable</div>
                )}

                <div className="dashTwoFactorSetup__body">
                  <p className="dashTwoFactorSetup__step">
                    1. Scan the QR code in your authenticator app.
                  </p>
                  <p className="dashTwoFactorSetup__step">
                    2. Enter the current 6-digit code below to confirm setup.
                  </p>
                  {setup.manualSecret && (
                    <div className="dashTwoFactorSetup__manual">
                      {!showManualSecret ? (
                        <button
                          type="button"
                          className="dashSecurityBtn dashSecurityBtn--ghost"
                          onClick={() => setShowManualSecret(true)}
                        >
                          Use Manual Key Instead
                        </button>
                      ) : (
                        <div className="dashTwoFactorSetup__secret">
                          <div className="dashTwoFactorSetup__manualTop">
                            <span>Manual secret</span>
                            <button
                              type="button"
                              className="dashTwoFactorSetup__manualToggle"
                              onClick={() => setShowManualSecret(false)}
                            >
                              Hide
                            </button>
                          </div>
                          <code>{setup.manualSecret}</code>
                        </div>
                      )}
                    </div>
                  )}
                  <label className="dashTwoFactorSetup__field">
                    <span>Current 6-digit code</span>
                    <input
                      value={twoFactorCode}
                      onChange={(event) => onTwoFactorCodeChange(event.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      aria-invalid={twoFactorSubmitAttempted && twoFactorCode.trim().length === 0}
                    />
                  </label>
                  <button
                    type="button"
                    className="dashSecurityBtn"
                    onClick={handleTwoFactorSubmit}
                    disabled={confirmingTwoFactor || isBusy || twoFactorCode.trim().length === 0}
                  >
                    {confirmingTwoFactor ? 'Confirming...' : 'Confirm 2FA'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </article>

        <article className="dashSecurityCard dashSecurityCard--full">
          <div className="dashSecurityCard__head">
            <div>
              <h3>Password</h3>
              <p>Use your current password to set a new one from here.</p>
            </div>
            <span className={`dashSecurityPill ${canChangePasswordNow ? 'is-success' : 'is-warning'}`}>
              {canChangePasswordNow ? 'Available Now' : 'Monthly Limit'}
            </span>
          </div>

          <p className="dashSecurityCard__copy">
            New passwords must be at least 8 characters long. For account security, this self-service password change
            is available once every 30 days.
          </p>

          {!canChangePasswordNow && (
            <p className="dashSecurityCard__note">
              You can change your password again on {passwordChangeAvailableAtLabel || 'a later date'}.
            </p>
          )}

          <form className="dashPasswordForm" onSubmit={handlePasswordSubmit}>
            <div className="dashPasswordForm__grid">
              <label className="dashPasswordForm__field">
                <span>Current Password</span>
                <div className="dashPasswordForm__inputWrap">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled={isBusy || !canChangePasswordNow}
                    aria-invalid={passwordSubmitAttempted && currentPassword.trim().length === 0}
                  />
                  <button
                    type="button"
                    className="dashPasswordForm__toggle"
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    disabled={isBusy || !canChangePasswordNow}
                  >
                    {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </label>

              <label className="dashPasswordForm__field">
                <span>New Password</span>
                <div className="dashPasswordForm__inputWrap">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={isBusy || !canChangePasswordNow}
                    aria-invalid={passwordSubmitAttempted && newPassword.trim().length === 0}
                  />
                  <button
                    type="button"
                    className="dashPasswordForm__toggle"
                    onClick={() => setShowNewPassword((value) => !value)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    disabled={isBusy || !canChangePasswordNow}
                  >
                    {showNewPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </label>

              <label className="dashPasswordForm__field dashPasswordForm__field--full">
                <span>Confirm New Password</span>
                <div className="dashPasswordForm__inputWrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={isBusy || !canChangePasswordNow}
                    aria-invalid={passwordSubmitAttempted && confirmPassword.trim().length === 0}
                  />
                  <button
                    type="button"
                    className="dashPasswordForm__toggle"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    disabled={isBusy || !canChangePasswordNow}
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </label>
            </div>

            <div className="dashPasswordForm__actions">
              <button type="submit" className="dashSecurityBtn" disabled={isBusy || !canChangePasswordNow}>
                {changingPassword ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </article>
      </div>

      {statusMessage && <div className="dashSecurity__status">{statusMessage}</div>}
    </section>
  );
}
