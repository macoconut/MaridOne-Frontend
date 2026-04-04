import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmailToken } from '../../lib/accountSecurity';
import { useErrorDialogEffect } from '../../hooks/useErrorDialogEffect';
import { getFriendlyErrorMessage } from '../../lib/uiErrors';
import './VerifyEmail.css';

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

  useErrorDialogEffect(status === 'error' ? message : '', 'Email verification failed');

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
            onClick={() => navigate('/')}
          >
            Back to Landing Page
          </button>
        </div>
      </div>
    </main>
  );
}
