const statusLabels: Record<string, string> = {
  NEW: "חדש",
  CONTACTED: "נוצר קשר",
  NO_RESPONSE: "אין מענה",
  TRIAL_SCHEDULED: "ניסיון נקבע",
  TRIAL_COMPLETED: "ניסיון הושלם",
  FOLLOW_UP_AFTER_TRIAL: "מעקב אחרי ניסיון",
  CONVERTED: "הומר",
  CLOSED: "סגור",
  SCHEDULED: "מתוכנן",
  COMPLETED: "הושלם",
  NO_SHOW: "לא הגיע",
  CANCELLED: "בוטל",
  PENDING: "ממתין",
  SENDING: "בשליחה",
  SENT: "נשלח",
  FAILED: "נכשל",
  ACTIVE: "פעיל",
  INACTIVE: "לא פעיל",
  PAUSED: "מושהה",
  FULL: "מלא",
  ARCHIVED: "בארכיון",
  HIGH: "גבוה",
  MEDIUM: "בינוני",
  LOW: "נמוך",
  FOLLOW_UP: "מעקב",
  CALL: "שיחה",
  GENERAL: "כללי",
  TRIAL_REMINDER: "תזכורת ניסיון",
  FACEBOOK: "פייסבוק",
  INSTAGRAM: "אינסטגרם",
  WEBSITE: "אתר",
  MANUAL: "ידני",
  OTHER: "אחר",
  ONLINE: "מקוון",
  IN_PERSON: "פרונטלי",
}

const statusClassMap: Record<string, string> = {
  NEW: "badge--new",
  CONTACTED: "badge--contacted",
  NO_RESPONSE: "badge--no-response",
  TRIAL_SCHEDULED: "badge--trial-scheduled",
  TRIAL_COMPLETED: "badge--trial-completed",
  FOLLOW_UP_AFTER_TRIAL: "badge--follow-up",
  CONVERTED: "badge--converted",
  CLOSED: "badge--closed",
  SCHEDULED: "badge--scheduled",
  COMPLETED: "badge--completed",
  NO_SHOW: "badge--no-show",
  CANCELLED: "badge--cancelled",
  PENDING: "badge--pending",
  SENDING: "badge--sending",
  SENT: "badge--sent",
  FAILED: "badge--failed",
  ACTIVE: "badge--active",
  INACTIVE: "badge--inactive",
  PAUSED: "badge--paused",
  FULL: "badge--full",
  ARCHIVED: "badge--archived",
  HIGH: "badge--priority-high",
  MEDIUM: "badge--priority-medium",
  LOW: "badge--priority-low",
  FACEBOOK: "badge--source",
  INSTAGRAM: "badge--source",
  WEBSITE: "badge--source",
  MANUAL: "badge--source",
  OTHER: "badge--source",
}

interface Props {
  status: string
  className?: string
}

export default function StatusBadge({ status, className = "" }: Props) {
  const cssClass = statusClassMap[status] || "badge--closed"
  const label = statusLabels[status] || status

  return (
    <span className={`badge ${cssClass} ${className}`}>
      {label}
    </span>
  )
}
