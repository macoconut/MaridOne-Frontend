import { useEffect, useState } from 'react';
import type { TwoFactorSetupResponse } from '../lib/accountSecurity';

type AccountSecuritySectionProps = {
  savedEmail: string;
  emailDirty: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorCode: string;
  setup: TwoFactorSetupResponse | null;
  statusMessage: string;
  errorMessage: string;
  sendingVerification: boolean;
  startingTwoFactor: boolean;
  confirmingTwoFactor: boolean;
  disablingTwoFactor: boolean;
  onTwoFactorCodeChange: (value: string) => void;
  onSendVerification: () => void;
  onStartTwoFactor: () => void;
  onConfirmTwoFactor: () => void;
  onDisableTwoFactor: () => void;
};

export default function AccountSecuritySection({
  savedEmail,
  emailDirty,
  emailVerified,
  twoFactorEnabled,
  twoFactorCode,
  setup,
  statusMessage,
  errorMessage,
  sendingVerification,
  startingTwoFactor,
  confirmingTwoFactor,
  disablingTwoFactor,
  onTwoFactorCodeChange,
  onSendVerification,
  onStartTwoFactor,
  onConfirmTwoFactor,
  onDisableTwoFactor,
}: AccountSecuritySectionProps) {
  const emailReady = savedEmail.trim().length > 0 && !emailDirty;
  const isBusy = sendingVerification || startingTwoFactor || confirmingTwoFactor || disablingTwoFactor;
  const [showManualSecret, setShowManualSecret] = useState(false);
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

  return (
    <section className="dashSecurity">
      <div className="dashSecurity__header">
        <div>
          <div className="dashSecurity__title">Account Security</div>
          <p className="dashSecurity__copy">
            Verify your email address and protect sign-in with an authenticator app.
          </p>
        </div>
      </div>

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
                    />
                  </label>
                  <button
                    type="button"
                    className="dashSecurityBtn"
                    onClick={onConfirmTwoFactor}
                    disabled={confirmingTwoFactor || isBusy || twoFactorCode.trim().length === 0}
                  >
                    {confirmingTwoFactor ? 'Confirming...' : 'Confirm 2FA'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </article>
      </div>

      {statusMessage && <div className="dashSecurity__status">{statusMessage}</div>}
      {errorMessage && <div className="dashSecurity__error">{errorMessage}</div>}
    </section>
  );
}
