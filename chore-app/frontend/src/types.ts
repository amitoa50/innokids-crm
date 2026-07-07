export interface User {
  id: number
  email: string
  name: string
  role: "ADMIN" | "STAFF"
  status: "ACTIVE" | "INACTIVE"
  createdAt?: string
}

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "NO_RESPONSE"
  | "TRIAL_SCHEDULED"
  | "TRIAL_COMPLETED"
  | "FOLLOW_UP_AFTER_TRIAL"
  | "CONVERTED"
  | "CLOSED"

export type LeadSource = "FACEBOOK" | "INSTAGRAM" | "WEBSITE" | "MANUAL" | "OTHER"

export interface Lead {
  id: number
  fullName: string
  phone: string
  phoneNormalized: string
  email: string | null
  source: LeadSource
  campaignName: string | null
  status: LeadStatus
  assignedToId: number | null
  assignedTo?: { id: number; name: string } | null
  nextFollowUpDate: string | null
  lastContactDate: string | null
  learningFormat: string | null
  branch: string | null
  closedReason: string | null
  notes: string | null
  childName: string | null
  childBirthYear: number | null
  whatsappConsent: boolean
  whatsappConsentAt: string | null
  marketingConsent: boolean
  preferredChannel: string | null
  whatsappWindowExpiresAt: string | null
  createdAt: string
  updatedAt: string
  students?: Student[]
  trialLessons?: TrialLesson[]
  tasks?: Task[]
  activityLogs?: ActivityLog[]
}

export interface Student {
  id: number
  leadId: number
  lead?: { id?: number; fullName: string; phone?: string; email?: string }
  childName: string
  childBirthYear: number | null
  learningFormat: string
  branch: string | null
  status: "ACTIVE" | "INACTIVE" | "PAUSED"
  groupId: number | null
  group?: { id?: number; name: string } | null
  enrolledAt: string
  notes: string | null
  createdAt: string
  updatedAt: string
  activityLogs?: ActivityLog[]
  tasks?: Task[]
}

export interface Group {
  id: number
  name: string
  type: string
  ageRange: string | null
  learningFormat: string
  branch: string | null
  dayOfWeek: string | null
  time: string | null
  startTime: string | null
  endTime: string | null
  startDate: string | null
  timezone: string | null
  maxCapacity: number | null
  teacherId: number | null
  teacher?: { id?: number; name: string } | null
  status: "ACTIVE" | "FULL" | "ARCHIVED"
  createdAt: string
  updatedAt: string
  students?: Student[]
  _count?: { students: number }
}

export interface TrialLesson {
  id: number
  leadId: number
  lead?: { id?: number; fullName: string; phone?: string }
  groupId: number | null
  group?: { id?: number; name: string } | null
  scheduledAt: string
  durationMinutes: number | null
  locationType: string | null
  meetingUrl: string | null
  status: "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELLED"
  outcome: string | null
  teacherId: number | null
  teacher?: { id?: number; name: string } | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: number
  title: string
  description: string | null
  type: "FOLLOW_UP" | "CALL" | "GENERAL" | "TRIAL_REMINDER"
  priority: "LOW" | "MEDIUM" | "HIGH"
  status: "PENDING" | "COMPLETED"
  dueDate: string | null
  assignedToId: number
  assignedTo?: { name: string }
  leadId: number | null
  lead?: { id?: number; fullName: string } | null
  studentId: number | null
  student?: { id?: number; childName: string } | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityLog {
  id: number
  type: string
  description: string
  leadId: number | null
  studentId: number | null
  performedById: number | null
  performedBy?: { name: string } | null
  metadata: string | null
  createdAt: string
}

export interface LeadIntake {
  id: number
  source: string
  rawPayload: string
  status: string
  leadId: number | null
  lead?: { fullName: string; phone: string } | null
  errorMessage: string | null
  createdAt: string
}

export interface Message {
  id: number
  conversationId: number
  direction: "INBOUND" | "OUTBOUND"
  channel: string
  body: string
  status: string
  templateName: string | null
  sentById: number | null
  sentBy?: { id: number; name: string } | null
  sentAt: string | null
  createdAt: string
}

export interface Conversation {
  id: number
  leadId: number | null
  studentId: number | null
  channel: string
  status: "OPEN" | "SNOOZED" | "CLOSED"
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
  messages: Message[]
}

export interface ExternalRef {
  id: number
  entityType: string
  entityId: number
  system: string
  externalId: string
  metadata: string | null
  createdAt: string
}

export interface MessageTemplate {
  id: number
  name: string
  language: string
  category: string
  body: string
  variables: string | null
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
  createdAt: string
  updatedAt: string
}

export interface AutomationRule {
  id: number
  name: string
  triggerEvent: string
  templateName: string
  channel: string
  offsetMinutes: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ScheduledMessage {
  id: number
  leadId: number
  channel: string
  templateName: string
  variables: string | null
  dueAt: string
  status: "PENDING" | "SENDING" | "SENT" | "CANCELLED" | "FAILED"
  failureReason: string | null
  messageId: number | null
  createdAt: string
  updatedAt: string
}

export interface ScheduledMessageItem {
  id: number
  status: string
  templateName: string
  triggerEvent: string
  dueAt: string
  failureReason: string | null
  createdAt: string
  updatedAt: string
  lead: { id: number; fullName: string } | null
}

export interface ScheduledMessageList {
  counts: Record<string, number>
  items: ScheduledMessageItem[]
}

export interface TemplateUsage {
  triggerEvent: string
  name: string
}

export interface TemplateWithUsage {
  id: number
  name: string
  language: string
  category: string
  body: string
  status: string
  variables: string[]
  usedBy: TemplateUsage[]
}

export interface Notification {
  id: number
  message: string
  read: boolean
  createdAt: string
  userId: number
}

export interface AuthResponse {
  token: string
  user: User
}

export interface DashboardStats {
  newLeads: number
  trialsScheduled: number
  conversions: number
  activeStudents: number
}

export type PipelineStats = Record<string, number>
export type SourceStats = Record<string, number>
