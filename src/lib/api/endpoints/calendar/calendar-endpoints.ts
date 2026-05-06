export const CALENDAR_ENDPOINTS = {
  // queries
  listEvents: (month: number, year: number) =>  `/api/calendar/events?month=${month}&year=${year}`,

  // actions
  createEvent: '/api/calendar/events/create',
  updateEvent: '/api/calendar/events/update',
  deleteEvent: (calendarId: number) => `/api/calendar/events/delete/${calendarId}`,
};