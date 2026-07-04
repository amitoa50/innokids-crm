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
