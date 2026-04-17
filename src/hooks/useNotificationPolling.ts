import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetchRaw } from '../lib/api';
import {
  mapNotificationItem,
  type NotificationItem,
  type NotificationRole,
} from '../lib/notificationRouting';
import {
  installNotificationSoundPrimer,
  playNotificationSound,
} from '../lib/notificationSound';

type UseNotificationPollingOptions = {
  intervalMs?: number;
};

export function useNotificationPolling(
  role: NotificationRole,
  options: UseNotificationPollingOptions = {}
) {
  const { intervalMs = 10000 } = options;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const previousUnreadIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    installNotificationSoundPrimer();
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await apiFetchRaw('/api/notifications?page=0&size=20', {
        method: 'GET',
      });

      if (!response.ok) {
        if (!hasLoadedRef.current) {
          setNotifications([]);
        }
        return;
      }

      const payload = (await response.json()) as {
        content?: Array<Record<string, unknown>>;
      };

      const mapped = Array.isArray(payload?.content)
        ? payload.content.map((row) => mapNotificationItem(role, row))
        : [];

      const unreadIds = new Set(
        mapped.filter((item) => !item.isRead).map((item) => item.id)
      );
      const hasNewUnread =
        hasLoadedRef.current &&
        [...unreadIds].some((id) => !previousUnreadIdsRef.current.has(id));

      previousUnreadIdsRef.current = unreadIds;
      hasLoadedRef.current = true;
      setNotifications(mapped);

      if (
        hasNewUnread &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        void playNotificationSound();
      }
    } catch {
      if (!hasLoadedRef.current) {
        setNotifications([]);
      }
    }
  }, [role]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined' || intervalMs <= 0) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadNotifications();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs, loadNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocus = () => {
      if (document.visibilityState !== 'visible') return;
      void loadNotifications();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void loadNotifications();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadNotifications]);

  return {
    notifications,
    setNotifications,
    loadNotifications,
  };
}
