// Shared Hebrew labels + sample values for the automation screens.

export const triggerLabels: Record<string, string> = {
  LEAD_WELCOME: "ליד חדש — פתיחה",
  NO_RESPONSE_NUDGE: "ללא מענה — תזכורת",
  TRIAL_CONFIRMATION: "ניסיון — אישור",
  TRIAL_REMINDER: "ניסיון — תזכורת",
  POST_TRIAL_FOLLOW_UP: "אחרי ניסיון — מעקב",
  TRIAL_NO_SHOW_RESCHEDULE: "לא הגיע — תיאום מחדש",
  STUDENT_WELCOME: "תלמיד חדש — ברוכים הבאים"
}

export const triggerLabel = (t: string) => triggerLabels[t] || t

export const variableLabels: Record<string, string> = {
  parentName: "שם ההורה",
  childName: "שם הילד/ה",
  date: "תאריך",
  time: "שעה"
}

export const variableSamples: Record<string, string> = {
  parentName: "דנה",
  childName: "נועם",
  date: "12.07.2026",
  time: "17:00"
}
