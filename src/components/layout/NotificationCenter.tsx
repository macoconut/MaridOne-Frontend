import type { RefObject, WheelEvent } from 'react';
import { FiBell, FiCheckCircle } from 'react-icons/fi';
import type { NotificationItem } from '@/lib/utils/notificationRouting';

type NotificationCenterProps = {
  bellRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  notifOpen: boolean;
  unreadCount: number;
  notifications: NotificationItem[];
  todayLabel: string;
  notificationPresence: {
    isMounted: boolean;
    isClosing: boolean;
  };
  onBellClick: () => void;
  onNotificationClick: (notification: NotificationItem) => void;
  onPanelWheel: (event: WheelEvent<HTMLDivElement>, selector: string) => void;
};

export default function NotificationCenter({
  bellRef,
  panelRef,
  notifOpen,
  unreadCount,
  notifications,
  todayLabel,
  notificationPresence,
  onBellClick,
  onNotificationClick,
  onPanelWheel,
}: NotificationCenterProps) {
  return (
    <div className="notif">
      <button
        ref={bellRef}
        className="eTop__bell"
        type="button"
        aria-label="Notifications"
        aria-expanded={notifOpen}
        onClick={onBellClick}
      >
        <FiBell />
        {unreadCount > 0 && <span className="notif__badge">{unreadCount}</span>}
      </button>

      {notificationPresence.isMounted && (
        <div className={`notif__backdrop${notificationPresence.isClosing ? ' is-closing' : ''}`} />
      )}

      {notificationPresence.isMounted && (
        <div
          ref={panelRef}
          className={`notifPanel${notificationPresence.isClosing ? ' is-closing' : ''}`}
          role="dialog"
          aria-label="Notifications"
          onWheel={(event) => onPanelWheel(event, '.notifPanel__list')}
        >
          <div className="notifPanel__header">
            <div className="notifPanel__title">Notifications ({unreadCount})</div>
            <div className="notifPanel__date">Today, {todayLabel}</div>
          </div>

          <div className="notifPanel__list">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notifItem ${notification.isRead ? 'notifItem--read' : 'notifItem--unread'}`}
                >
                  <div className="notifItem__icon">
                    <FiCheckCircle />
                  </div>
                  <button
                    type="button"
                    className="notifItem__main"
                    onClick={() => onNotificationClick(notification)}
                  >
                    <div className="notifItem__body">
                      <div className="notifItem__title">{notification.title}</div>
                      {notification.description && (
                        <div className="notifItem__msg">{notification.description}</div>
                      )}
                    </div>
                    <div className="notifItem__time">{notification.time}</div>
                  </button>
                </div>
              ))
            ) : (
              <div className="notifItem">
                <div className="notifItem__icon">
                  <FiCheckCircle />
                </div>
                <div className="notifItem__body">
                  <div className="notifItem__title">No new notifications.</div>
                </div>
                <div className="notifItem__time">Now</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
