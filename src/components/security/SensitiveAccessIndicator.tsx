import { useEffect, useMemo, useState } from 'react';
import { FiLock, FiUnlock } from 'react-icons/fi';
import { clearSensitiveAccessSession } from '@/lib/sensitiveAccess';
import { getSensitiveAccessExpiry, getSensitiveAccessToken } from '@/lib/session';
import './SensitiveAccessIndicator.css';

type SensitiveAccessIndicatorProps = {
  onActivate?: () => void;
};

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

export default function SensitiveAccessIndicator({
  onActivate,
}: SensitiveAccessIndicatorProps) {
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
  const timerLabel = useMemo(
    () => (isActive ? formatRemainingTime(remainingMs) : ''),
    [isActive, remainingMs]
  );
  const isInteractive = isActive || Boolean(onActivate);

  return (
    <div className="sensitiveAccessIndicator" aria-live="polite">
      <button
        type="button"
        className={`sensitiveAccessIndicator__iconBtn ${isActive ? 'is-active' : 'is-inactive'}`}
        onClick={() => {
          if (isActive) {
            clearSensitiveAccessSession();
            setRemainingMs(0);
            return;
          }
          onActivate?.();
        }}
        disabled={!isInteractive}
        aria-label={isActive ? 'Lock sensitive access now' : 'Unlock sensitive access'}
        title={isActive ? 'Lock sensitive access now' : 'Unlock sensitive access'}
      >
        {isActive ? <FiUnlock aria-hidden="true" /> : <FiLock aria-hidden="true" />}
      </button>
      {isActive ? <span className="sensitiveAccessIndicator__timer">{timerLabel}</span> : null}
    </div>
  );
}
