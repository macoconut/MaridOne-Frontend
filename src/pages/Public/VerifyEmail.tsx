import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmailToken } from '../../lib/accountSecurity';
import { getAuthToken, getUserRole } from '../../lib/session';
import { getFriendlyErrorMessage } from '../../lib/uiErrors';
import './VerifyEmail.css';

function roleHome(role: ReturnType<typeof getUserRole>) {
  switch (role) {
    case 'employee':
      return '/employee/dashboard';
    case 'hr':
      return '/hr/dashboard';
    case 'manager':
      return '/manager/dashboard';
    case 'management':
      return '/management/attendance';
    case 'accounting':
      return '/accounting/payroll-dashboard';
    default:
      return '/login';
  }
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const startedRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    token ? 'loading' : 'idle'
  );
  const [message, setMessage] = useState(
    token ? 'Verifying your email now...' : 'Open this page from the verification link in your inbox.'
  );

  async function submitVerification() {
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing from the link.');
      return;
    }

    setStatus('loading');
    setMessage('Verifying your email now...');

    try {
      const responseMessage = await verifyEmailToken(token);
      setStatus('success');
      setMessage(responseMessage || 'Email successfully verified');
    } catch (error) {
      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'generic'));
    }
  }

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;
    void submitVerification();
  }, [token]);

  const loggedIn = Boolean(getAuthToken() && getUserRole());

  return (
    <main className="verifyEmailPage">
      <div className="verifyEmailCard">
        <div className={`verifyEmailBadge is-${status}`}>{status === 'success' ? 'Verified' : 'Email Check'}</div>
        <h1>Verify your email</h1>
        <p>{message}</p>

        <div className="verifyEmailActions">
          {status !== 'success' && token && (
            <button type="button" className="verifyEmailBtn" onClick={() => void submitVerification()} disabled={status === 'loading'}>
              {status === 'loading' ? 'Verifying...' : 'Try Again'}
            </button>
          )}

          <button
            type="button"
            className="verifyEmailBtn verifyEmailBtn--ghost"
            onClick={() => navigate(loggedIn ? roleHome(getUserRole()) : '/login')}
          >
            {loggedIn ? 'Go to Dashboard' : 'Go to Login'}
          </button>
        </div>
      </div>
    </main>
  );
}
