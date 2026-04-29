import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmailToken } from '../../lib/accountSecurity';
import { useErrorDialogEffect } from '../../hooks/useErrorDialogEffect';
import { getFriendlyErrorMessage } from '../../lib/uiErrors';
import './VerifyEmail.css';

const VERIFY_REQUEST_TIMEOUT_MS = 15000;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const redirectedStatus = useMemo(() => {
    const raw = searchParams.get('status')?.trim().toLowerCase() ?? '';
    return raw === 'success' || raw === 'error' ? raw : '';
  }, [searchParams]);
  const redirectedMessage = useMemo(() => searchParams.get('message')?.trim() ?? '', [searchParams]);
  const startedRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    redirectedStatus === 'success'
      ? 'success'
      : redirectedStatus === 'error'
        ? 'error'
        : token
          ? 'loading'
          : 'idle'
  );
  const [message, setMessage] = useState(
    redirectedStatus === 'success'
      ? redirectedMessage || 'Email successfully verified'
      : redirectedStatus === 'error'
        ? redirectedMessage || 'Email verification failed.'
        : token
          ? 'Verifying your email now...'
          : 'Open this page from the verification link in your inbox.'
  );

  useErrorDialogEffect(status === 'error' ? message : '', 'Email verification failed');

  const submitVerification = useCallback(async () => {
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing from the link.');
      return;
    }

    setStatus('loading');
    setMessage('Verifying your email now...');
    requestAbortRef.current?.abort();

    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, VERIFY_REQUEST_TIMEOUT_MS);

    try {
      const responseMessage = await verifyEmailToken(token, { signal: abortController.signal });
      if (requestAbortRef.current !== abortController) return;
      setStatus('success');
      setMessage(responseMessage || 'Email successfully verified');
    } catch (error) {
      if (requestAbortRef.current !== abortController) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (!timedOut) {
          return;
        }

        setStatus('error');
        setMessage('Email verification is taking too long. Please try again.');
        return;
      }

      setStatus('error');
      setMessage(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      window.clearTimeout(timeoutId);
      if (requestAbortRef.current === abortController) {
        requestAbortRef.current = null;
      }
    }
  }, [token]);

  useEffect(() => {
    if (redirectedStatus || !token || startedRef.current) return;
    startedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void submitVerification();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [redirectedStatus, submitVerification, token]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
    };
  }, []);

  const helperMessage =
    status === 'error'
      ? token
        ? 'You can try the verification again using the button below.'
        : redirectedStatus === 'error'
          ? 'Request a fresh verification email if this link has already expired.'
          : 'Open this page from the verification link in your inbox to continue.'
      : '';

  return (
    <main className="verifyEmailPage">
      <div className="verifyEmailCard">
        <div className={`verifyEmailBadge is-${status}`}>{status === 'success' ? 'Verified' : 'Email Check'}</div>
        <h1>{message}</h1>
        {helperMessage ? <p>{helperMessage}</p> : null}

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
