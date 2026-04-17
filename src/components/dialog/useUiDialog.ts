import { useContext } from 'react';
import { UiDialogContext } from './uiDialogContext';

export function useUiDialog() {
  const value = useContext(UiDialogContext);

  if (!value) {
    throw new Error('useUiDialog must be used within UiDialogProvider.');
  }

  return value;
}
