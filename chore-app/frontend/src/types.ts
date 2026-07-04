export interface User {
  id: number
  email: string
  name: string
  role: "ADMIN" | "MEMBER"
  createdAt?: string
}

export interface Chore {
  id: number
  title: string
  description: string | null
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY"
  dueDate: string
  status: "PENDING" | "COMPLETED" | "OVERDUE"
  completedAt: string | null
  notes: string | null
  createdAt: string
  assignedToId: number
  createdById: number
  assignedTo: User
  createdBy: User
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

export interface Stats {
  totalChores: number
  completedChores: number
  overdueChores: number
  pendingChores: number
}
