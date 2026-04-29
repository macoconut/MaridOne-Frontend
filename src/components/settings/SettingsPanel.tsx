import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiSidebar,
} from 'react-icons/fi';
import AccountSecuritySection from '../account/AccountSecuritySection';
import { useUiDialog } from '../dialog/useUiDialog';
import {
  beginTwoFactorSetup,
  changeOwnPassword,
  confirmTwoFactorSetup,
  disableTwoFactor,
  sendEmailVerification,
  type TwoFactorSetupResponse,
} from '../../lib/accountSecurity';
import { apiFetchJson } from '../../lib/api';
import {
  getStoredReduceMotion,
  getStoredSidebarCollapsed,
  setStoredReduceMotion,
  setStoredSidebarCollapsed,
  subscribeToUiPreferencesChange,
} from '../../lib/uiPreferences';
import { getFriendlyErrorMessage } from '../../lib/uiErrors';
import { getUserEmail } from '../../lib/session';
import './SettingsPanel.css';

type UserDetails = {
  username?: string;
  employeeId?: number;
  twoFactorEnabled?: boolean;
  canChangePasswordNow?: boolean;
  passwordChangeAvailableAt?: string;
  employee?: EmployeeProfile | null;
};

type EmployeeProfile = {
  employeeId?: number;
  companyEmail?: string;
  personalEmail?: string;
  email?: string;
  isVerified?: boolean | string;
};

function isEmailVerified(value: EmployeeProfile | null | undefined) {
  const rawValue = value?.isVerified;

  if (typeof rawValue === 'boolean') return rawValue;
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'verified') return true;
    if (normalized === 'false' || normalized === 'unverified') return false;
  }

  return false;
}

function formatDisplayDateTime(value?: string) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SettingsPanel() {
  const { showSuccess } = useUiDialog();
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(getStoredSidebarCollapsed);
  const [reduceMotion, setReduceMotionState] = useState(getStoredReduceMotion);
  const [profile, setProfile] = useState<UserDetails | null>(null);
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [sendingVerification, setSendingVerification] = useState(false);
  const [startingTwoFactor, setStartingTwoFactor] = useState(false);
  const [confirmingTwoFactor, setConfirmingTwoFactor] = useState(false);
  const [disablingTwoFactor, setDisablingTwoFactor] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  useEffect(() => {
    const syncUiPreferences = () => {
      setSidebarCollapsedState(getStoredSidebarCollapsed());
      setReduceMotionState(getStoredReduceMotion());
    };

    const unsubscribeUiPreferences = subscribeToUiPreferencesChange(syncUiPreferences);

    syncUiPreferences();
    return () => {
      unsubscribeUiPreferences();
    };
  }, []);

  useEffect(() => {
    const username = getUserEmail();
    if (!username) {
      setLoadingProfile(false);
      setProfileError('No active user session was found.');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoadingProfile(true);
        setProfileError('');

        const details = await apiFetchJson<UserDetails>(`/api/user/details/${encodeURIComponent(username)}`);
        if (cancelled) return;

        setProfile(details);

        const employeeFromDetails =
          details.employee && typeof details.employee === 'object' ? details.employee : null;
        const resolvedEmployeeId =
          typeof details.employeeId === 'number'
            ? details.employeeId
            : typeof employeeFromDetails?.employeeId === 'number'
              ? employeeFromDetails.employeeId
              : null;

        if (employeeFromDetails) {
          setEmployee(employeeFromDetails);
        } else if (resolvedEmployeeId) {
          const employeeDetails = await apiFetchJson<EmployeeProfile>(`/api/employees/${resolvedEmployeeId}`);
          if (cancelled) return;
          setEmployee(employeeDetails);
        } else {
          setEmployee(null);
        }
      } catch (error) {
        if (cancelled) return;
        setProfile(null);
        setEmployee(null);
        setProfileError(getFriendlyErrorMessage(error, 'generic'));
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const emailVerified = isEmailVerified(employee);
  const savedEmail = employee?.personalEmail ?? '';
  const canChangePasswordNow = profile?.canChangePasswordNow !== false;
  const passwordChangeAvailableAtLabel = useMemo(
    () => (profile?.passwordChangeAvailableAt ? formatDisplayDateTime(profile.passwordChangeAvailableAt) : 'Not available'),
    [profile?.passwordChangeAvailableAt]
  );

  function clearSecurityFeedback() {
    setSecurityMessage('');
    setSecurityError('');
  }

  function updateSidebarPreference(compact: boolean) {
    setStoredSidebarCollapsed(compact);
    setSidebarCollapsedState(compact);
  }

  function updateReduceMotionPreference(nextReduceMotion: boolean) {
    setStoredReduceMotion(nextReduceMotion);
    setReduceMotionState(nextReduceMotion);
  }

  async function refreshProfileDetails() {
    const username = getUserEmail();
    if (!username) return;

    const details = await apiFetchJson<UserDetails>(`/api/user/details/${encodeURIComponent(username)}`);
    setProfile(details);

    const employeeFromDetails =
      details.employee && typeof details.employee === 'object' ? details.employee : null;
    const resolvedEmployeeId =
      typeof details.employeeId === 'number'
        ? details.employeeId
        : typeof employeeFromDetails?.employeeId === 'number'
          ? employeeFromDetails.employeeId
          : null;

    if (employeeFromDetails) {
      setEmployee(employeeFromDetails);
      return;
    }

    if (resolvedEmployeeId) {
      const employeeDetails = await apiFetchJson<EmployeeProfile>(`/api/employees/${resolvedEmployeeId}`);
      setEmployee(employeeDetails);
      return;
    }

    setEmployee(null);
  }

  async function handleSendEmailVerification() {
    clearSecurityFeedback();
    setSendingVerification(true);

    try {
      await sendEmailVerification();
      const message = 'Verification email sent. Check your inbox and follow the link to finish.';
      showSuccess(message, 'Verification Email Sent');
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleStartTwoFactorSetup() {
    clearSecurityFeedback();
    setStartingTwoFactor(true);

    try {
      const setup = await beginTwoFactorSetup();
      setTwoFactorSetup(setup);
      setTwoFactorCode('');
      setSecurityMessage('Scan the QR code, then enter the current 6-digit code to finish enabling 2FA.');
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setStartingTwoFactor(false);
    }
  }

  async function handleConfirmTwoFactor() {
    const code = twoFactorCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setSecurityMessage('');
      setSecurityError('Enter the current 6-digit code from your authenticator app.');
      return;
    }

    clearSecurityFeedback();
    setConfirmingTwoFactor(true);

    try {
      const message = await confirmTwoFactorSetup(code);
      const successMessage = message || 'Two-factor authentication is now enabled.';
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setProfile((current) => (current ? { ...current, twoFactorEnabled: true } : current));
      showSuccess(successMessage, 'Two-Factor Authentication Enabled');
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setConfirmingTwoFactor(false);
    }
  }

  async function handleDisableTwoFactor() {
    clearSecurityFeedback();
    setDisablingTwoFactor(true);

    try {
      await disableTwoFactor();
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setProfile((current) => (current ? { ...current, twoFactorEnabled: false } : current));
      setSecurityMessage('Two-factor authentication has been disabled.');
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setDisablingTwoFactor(false);
    }
  }

  async function handleChangePassword(payload: {
    confirmPassword: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const currentPassword = payload.currentPassword.trim();
    const newPassword = payload.newPassword.trim();
    const confirmPassword = payload.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setSecurityMessage('');
      setSecurityError('Fill in your current password, your new password, and the confirmation.');
      return;
    }

    if (newPassword.length < 8) {
      setSecurityMessage('');
      setSecurityError('Your new password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage('');
      setSecurityError('Your new password and confirmation do not match.');
      return;
    }

    clearSecurityFeedback();
    setChangingPassword(true);

    try {
      await changeOwnPassword(currentPassword, newPassword);
      await refreshProfileDetails();
      setSecurityMessage('Your password has been updated. The next self-service password change unlocks after the 30-day cooldown.');
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="settingsPanel">
      <div className="settingsPanel__grid">
        <section className="settingsCard">
          <div className="settingsCard__top">
            <div>
              <div className="settingsCard__eyebrow">Appearance</div>
              <h3 className="settingsCard__title">Sidebar and motion defaults</h3>
              <p className="settingsCard__copy">
                Keep the default sidebar state and reduce interface motion when you want the workspace to feel calmer.
              </p>
            </div>
          </div>

          <div className="settingsToggleGrid">
            <div className="settingsToggleCard">
              <div className="settingsToggleCard__icon">
                <FiSidebar />
              </div>
              <div className="settingsToggleCard__body">
                <div className="settingsToggleCard__title">Compact sidebar by default</div>
                <p className="settingsToggleCard__copy">
                  Keeps more horizontal room for content while leaving the Marid logo and nav icons visible.
                </p>
              </div>
              <button
                type="button"
                className={`settingsSwitch${sidebarCollapsed ? ' is-on' : ''}`}
                role="switch"
                aria-checked={sidebarCollapsed}
                aria-label="Use compact sidebar on desktop"
                onClick={() => updateSidebarPreference(!sidebarCollapsed)}
              >
                <span className="settingsSwitch__track" />
                <span className="settingsSwitch__thumb" />
              </button>
            </div>

            <div className="settingsToggleCard">
              <div className="settingsToggleCard__icon">
                <FiActivity />
              </div>
              <div className="settingsToggleCard__body">
                <div className="settingsToggleCard__title">Reduce interface motion</div>
                <p className="settingsToggleCard__copy">
                  Softens transitions and animations across the app for a steadier experience.
                </p>
              </div>
              <button
                type="button"
                className={`settingsSwitch${reduceMotion ? ' is-on' : ''}`}
                role="switch"
                aria-checked={reduceMotion}
                aria-label="Reduce interface motion"
                onClick={() => updateReduceMotionPreference(!reduceMotion)}
              >
                <span className="settingsSwitch__track" />
                <span className="settingsSwitch__thumb" />
              </button>
            </div>
          </div>
        </section>

        <section className="settingsCard settingsCard--security">
          <div className="settingsCard__top">
            <div>
              <div className="settingsCard__eyebrow">Security</div>
              <h3 className="settingsCard__title">Personal email verification, 2FA, and password control</h3>
              <p className="settingsCard__copy">
                Protect the current account without leaving the page. Your personal email verification, authenticator setup, and password update are all here.
              </p>
            </div>
          </div>

          {loadingProfile ? (
            <div className="settingsInlineNotice">Loading your security controls...</div>
          ) : profileError ? (
            <div className="settingsInlineNotice is-error">{profileError}</div>
          ) : (
            <AccountSecuritySection
              savedEmail={savedEmail}
              emailDirty={false}
              emailVerified={emailVerified}
              twoFactorEnabled={Boolean(profile?.twoFactorEnabled)}
              twoFactorCode={twoFactorCode}
              setup={twoFactorSetup}
              errorMessage={securityError}
              statusMessage={securityMessage}
              sendingVerification={sendingVerification}
              startingTwoFactor={startingTwoFactor}
              confirmingTwoFactor={confirmingTwoFactor}
              disablingTwoFactor={disablingTwoFactor}
              changingPassword={changingPassword}
              canChangePasswordNow={canChangePasswordNow}
              passwordChangeAvailableAtLabel={passwordChangeAvailableAtLabel}
              onTwoFactorCodeChange={(value) => setTwoFactorCode(value.replace(/\D/g, '').slice(0, 6))}
              onSendVerification={() => void handleSendEmailVerification()}
              onStartTwoFactor={() => void handleStartTwoFactorSetup()}
              onConfirmTwoFactor={() => void handleConfirmTwoFactor()}
              onDisableTwoFactor={() => void handleDisableTwoFactor()}
              onChangePassword={(payload) => void handleChangePassword(payload)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
