export const NOTIFICATION_ENDPOINTS = {
  // queries
  listMyNotifications: '/api/notifications',

  // actions
  readNotification: (notificationId: number) => `/api/notifications?notificationId=${notificationId}`,
};