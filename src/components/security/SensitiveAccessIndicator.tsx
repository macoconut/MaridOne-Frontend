import { useEffect, useMemo, useState } from 'react';
import { clearSensitiveAccessSession } from '../../lib/sensitiveAccess';
import { getSensitiveAccessExpiry, getSensitiveAccessToken } from '../../lib/session';
import './SensitiveAccessIndicator.css';

function readRemainingMs() {
  const token = getSensitiveAccessToken();
  const expiresAt = getSensitiveAccessExpiry();

  if (!token || !expiresAt) {
    return 0;
  }

  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) {
    return 0;
  }

  return Math.max(expiry - Date.now(), 0);
}

function formatRemainingTime(remainingMs: number) {
  const totalSeconds = Math.max(Math.ceil(remainingMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s left`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s left`;
}

export default function SensitiveAccessIndicator() {
  const [remainingMs, setRemainingMs] = useState(() => readRemainingMs());

  useEffect(() => {
    const syncState = () => setRemainingMs(readRemainingMs());
    syncState();

    const interval = window.setInterval(syncState, 1000);
    const handleFocus = () => syncState();
    const handleStorage = () => syncState();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const isActive = remainingMs > 0;
  const statusLabel = useMemo(() => {
    if (!isActive) {
      return 'Sensitive Access Inactive';
    }

    return `Sensitive Access Active • ${formatRemainingTime(remainingMs)}`;
  }, [isActive, remainingMs]);

  return (
    <div className={`sensitiveAccessIndicator ${isActive ? 'is-active' : 'is-inactive'}`} aria-live="polite">
      <span className="sensitiveAccessIndicator__dot" aria-hidden="true" />
      <span className="sensitiveAccessIndicator__label">{statusLabel}</span>
      {isActive ? (
        <button
          type="button"
          className="sensitiveAccessIndicator__lock"
          onClick={() => {
            clearSensitiveAccessSession();
            setRemainingMs(0);
          }}
        >
          Lock Now
        </button>
      ) : null}
    </div>
  );
}
