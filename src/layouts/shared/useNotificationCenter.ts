import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEscapeDismiss } from '@/hooks/useEscapeDismiss';
import useAnimatedPresence from '@/hooks/useAnimatedPresence';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import { apiFetchRaw } from '@/lib/api/api';
import { routeWheelToScrollableChild } from '@/lib/scrollContain';
import type { NotificationItem, NotificationRole } from '@/lib/notificationRouting';

export function useNotificationCenter(
  role: NotificationRole,
  onNavigate: (destination: string) => void
) {
  const [notifOpen, setNotifOpen] = useState(false);
  const notificationPresence = useAnimatedPresence(notifOpen, 180);
  const { notifications, setNotifications } = useNotificationPolling(role);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const unreadOnOpenRef = useRef<string[]>([]);

  const markNotificationsRead = useCallback(
    async (ids: string[]) => {
      const numericIds = ids
        .map((id) => ({ id, numericId: Number(id) }))
        .filter((item) => Number.isFinite(item.numericId));

      if (numericIds.length === 0) return;

      const pendingIds = new Set(numericIds.map((item) => item.id));
      setNotifications((prev) =>
        prev.map((item) => (pendingIds.has(item.id) ? { ...item, isRead: true } : item))
      );

      const results = await Promise.allSettled(
        numericIds.map(async ({ numericId }) => {
          const response = await apiFetchRaw(`/api/notifications?notificationId=${numericId}`, {
            method: 'PATCH',
          });

          if (!response.ok) {
            throw new Error(`Unable to mark notification ${numericId} as read.`);
          }
        })
      );

      const failedIds = new Set<string>();
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          failedIds.add(numericIds[index].id);
        }
      });

      if (failedIds.size > 0) {
        setNotifications((prev) =>
          prev.map((item) => (failedIds.has(item.id) ? { ...item, isRead: false } : item))
        );
      }
    },
    [setNotifications]
  );

  const closeNotificationBell = useCallback(() => {
    if (!notifOpen) return;

    const unreadIds = unreadOnOpenRef.current;
    unreadOnOpenRef.current = [];
    setNotifOpen(false);
    void markNotificationsRead(unreadIds);
  }, [markNotificationsRead, notifOpen]);

  useEscapeDismiss(notifOpen, closeNotificationBell);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!notifOpen) return;

      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || bellRef.current?.contains(target)) return;

      closeNotificationBell();
    }

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [closeNotificationBell, notifOpen]);

  const handleNotificationBellClick = useCallback(() => {
    if (notifOpen) {
      closeNotificationBell();
      return;
    }

    unreadOnOpenRef.current = notifications.filter((item) => !item.isRead).map((item) => item.id);
    setNotifOpen(true);
  }, [closeNotificationBell, notifOpen, notifications]);

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      closeNotificationBell();
      onNavigate(notification.destination);
    },
    [closeNotificationBell, onNavigate]
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  return {
    bellRef,
    handleNotificationBellClick,
    handleNotificationClick,
    handleNotificationPanelWheel: routeWheelToScrollableChild,
    notificationPresence,
    notifications,
    notifOpen,
    panelRef,
    todayLabel,
    unreadCount,
  };
}
