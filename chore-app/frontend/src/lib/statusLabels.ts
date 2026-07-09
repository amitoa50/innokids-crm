// Single source of truth for Hebrew UI labels of internal (English) enum values.
// DB/API values stay English; only what the user sees is Hebrew.

export const statusLabels: Record<string, string> = {
  // Lead pipeline
  NEW: "ליד חדש",
  CONTACTED: "נוצר קשר",
  NO_RESPONSE: "ללא מענה",
  TRIAL_SCHEDULED: "שיעור ניסיון נקבע",
  TRIAL_COMPLETED: "שיעור ניסיון בוצע",
  FOLLOW_UP_AFTER_TRIAL: "מעקב אחרי שיעור ניסיון",
  CONVERTED: "הומר לתלמיד",
  CLOSED: "נסגר",
  // Trial lesson
  SCHEDULED: "מתוכנן",
  COMPLETED: "הושלם",
  NO_SHOW: "לא הגיע",
  CANCELLED: "בוטל",
  // Message / automation
  PENDING: "ממתין",
  SENDING: "בשליחה",
  SENT: "נשלח",
  FAILED: "נכשל",
  // Group / student
  ACTIVE: "פעיל",
  INACTIVE: "לא פעיל",
  PAUSED: "מושהה",
  FULL: "מלא",
  ARCHIVED: "בארכיון",
  // Priority
  HIGH: "גבוה",
  MEDIUM: "בינוני",
  LOW: "נמוך",
  // Task type
  FOLLOW_UP: "מעקב",
  CALL: "שיחה",
  GENERAL: "כללי",
  TRIAL_REMINDER: "תזכורת ניסיון",
  // Source
  FACEBOOK: "פייסבוק",
  INSTAGRAM: "אינסטגרם",
  WEBSITE: "אתר",
  MANUAL: "ידני",
  OTHER: "אחר",
  // Learning format
  ONLINE: "מקוון",
  IN_PERSON: "פרונטלי",
}

// The 8 lead pipeline statuses, in flow order — for status dropdowns and board columns.
export const PIPELINE_STATUSES = [
  "NEW",
  "CONTACTED",
  "NO_RESPONSE",
  "TRIAL_SCHEDULED",
  "TRIAL_COMPLETED",
  "FOLLOW_UP_AFTER_TRIAL",
  "CONVERTED",
  "CLOSED",
] as const

export function statusLabel(status: string): string {
  return statusLabels[status] || status
}
