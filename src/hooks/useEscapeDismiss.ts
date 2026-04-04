import { useEffect, useRef } from 'react';

type EscapeRegistration = {
  dismiss: () => void;
  id: symbol;
  order: number;
  priority: number;
};

const escapeRegistrations: EscapeRegistration[] = [];
let escapeOrder = 0;
let listening = false;

function onEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;

  const topRegistration = escapeRegistrations.reduce<EscapeRegistration | null>((currentTop, entry) => {
    if (!currentTop) return entry;
    if (entry.priority > currentTop.priority) return entry;
    if (entry.priority === currentTop.priority && entry.order > currentTop.order) return entry;
    return currentTop;
  }, null);

  if (!topRegistration) return;

  event.preventDefault();
  topRegistration.dismiss();
}

function syncEscapeListener() {
  if (typeof document === 'undefined') return;

  if (escapeRegistrations.length > 0 && !listening) {
    document.addEventListener('keydown', onEscapeKey);
    listening = true;
    return;
  }

  if (escapeRegistrations.length === 0 && listening) {
    document.removeEventListener('keydown', onEscapeKey);
    listening = false;
  }
}

export function useEscapeDismiss(enabled: boolean, onDismiss: () => void, priority = 0) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!enabled) return;

    const registration: EscapeRegistration = {
      id: Symbol('escape-dismiss'),
      dismiss: () => dismissRef.current(),
      priority,
      order: ++escapeOrder,
    };

    escapeRegistrations.push(registration);
    syncEscapeListener();

    return () => {
      const index = escapeRegistrations.findIndex((entry) => entry.id === registration.id);
      if (index >= 0) {
        escapeRegistrations.splice(index, 1);
      }
      syncEscapeListener();
    };
  }, [enabled, priority]);
}
