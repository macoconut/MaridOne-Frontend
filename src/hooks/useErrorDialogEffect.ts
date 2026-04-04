import { useEffect, useRef } from 'react';
import { useUiDialog } from '../components/dialog/UiDialogProvider';

export function useErrorDialogEffect(errorMessage: string | null | undefined, title = 'Something went wrong') {
  const { showError } = useUiDialog();
  const lastShownRef = useRef('');

  useEffect(() => {
    const nextMessage = errorMessage?.trim() ?? '';

    if (!nextMessage) {
      lastShownRef.current = '';
      return;
    }

    if (lastShownRef.current === nextMessage) {
      return;
    }

    lastShownRef.current = nextMessage;
    showError(nextMessage, title);
  }, [errorMessage, showError, title]);
}
