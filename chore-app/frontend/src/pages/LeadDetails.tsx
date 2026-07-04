import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Phone, Mail, Copy } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Lead, User } from "../types"
import StatusBadge from "../components/StatusBadge"
import ActivityTimeline from "../components/ActivityTimeline"
import StudentModal from "../components/StudentModal"
import TrialLessonModal from "../components/TrialLessonModal"
import TaskModal from "../components/TaskModal"

const statuses = [
  "NEW", "CONTACTED", "NO_RESPONSE", "TRIAL_SCHEDULED",
  "TRIAL_COMPLETED", "FOLLOW_UP_AFTER_TRIAL", "CONVERTED", "CLOSED"
]

export default function LeadDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showConvert, setShowConvert] = useState(false)
  const [showTrial, setShowTrial] = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [note, setNote] = useState("")

  const { data: lead } = useQuery<Lead>({
    queryKey: ["lead", id],
    queryFn: async () => { const { data } = await client.get(`/lead/${id}`); return data }
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const { data } = await client.get("/user"); return data }
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => client.put(`/lead/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] })
      toast.success("סטטוס עודכן")
    }
  })

  const assignMutation = useMutation({
    mutationFn: (assignedToId: number) => client.put(`/lead/${id}/assign`, { assignedToId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] })
      toast.success("ליד שויך")
    }
  })

  const noteMutation = useMutation({
    mutationFn: (noteText: string) => client.post(`/lead/${id}/note`, { note: noteText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] })
      setNote("")
      toast.success("הערה נוספה")
    }
  })

  const reopenMutation = useMutation({
    mutationFn: () => client.post(`/lead/${id}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] })
      toast.success("ליד נפתח מחדש")
    }
  })

  if (!lead) return <div className="text-center py-8 text-slate-400">טוען...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/leads")} className="p-2 text-slate-400 hover:text-slate-600">
          <ArrowRight size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{lead.fullName}</h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1 text-sm text-slate-500" dir="ltr">
              <Phone size={14} />
              {lead.phone}
              <button
                onClick={() => { navigator.clipboard.writeText(lead.phone); toast.success("טלפון הועתק") }}
                className="text-slate-400 hover:text-slate-600"
              >
                <Copy size={12} />
              </button>
            </span>
            {lead.email && (
              <span className="flex items-center gap-1 text-sm text-slate-500">
                <Mail size={14} />
                {lead.email}
              </span>
            )}
            <StatusBadge status={lead.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <select
                value={lead.status}
                onChange={(e) => statusMutation.mutate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={lead.assignedToId?.toString() || ""}
                onChange={(e) => e.target.value && assignMutation.mutate(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">שיוך לצוות...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowTrial(true)}
                className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
              >
                קבע ניסיון
              </button>
              <button
                onClick={() => setShowTask(true)}
                className="px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                צור משימה
              </button>
              {lead.status !== "CONVERTED" && lead.status !== "CLOSED" && (
                <button
                  onClick={() => setShowConvert(true)}
                  className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  המר לתלמיד
                </button>
              )}
              {lead.status === "CLOSED" && (
                <button
                  onClick={() => reopenMutation.mutate()}
                  className="px-3 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100"
                >
                  פתח מחדש
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">הוסף הערה</h3>
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="כתוב הערה..."
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === "Enter" && note && noteMutation.mutate(note)}
              />
              <button
                onClick={() => note && noteMutation.mutate(note)}
                disabled={!note || noteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                הוסף
              </button>
            </div>
            {lead.notes && (
              <pre className="mt-3 text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{lead.notes}</pre>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">היסטוריית פעילות</h3>
            <ActivityTimeline activities={lead.activityLogs || []} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-semibold text-slate-800">פרטים</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">מקור</span>
                <StatusBadge status={lead.source} />
              </div>
              {lead.campaignName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">קמפיין</span>
                  <span className="text-slate-700">{lead.campaignName}</span>
                </div>
              )}
              {lead.learningFormat && (
                <div className="flex justify-between">
                  <span className="text-slate-500">פורמט</span>
                  <StatusBadge status={lead.learningFormat} />
                </div>
              )}
              {lead.branch && (
                <div className="flex justify-between">
                  <span className="text-slate-500">סניף</span>
                  <span className="text-slate-700">{lead.branch}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">נוצר</span>
                <span className="text-slate-700">{new Date(lead.createdAt).toLocaleDateString("he-IL")}</span>
              </div>
              {lead.lastContactDate && (
                <div className="flex justify-between">
                  <span className="text-slate-500">קשר אחרון</span>
                  <span className="text-slate-700">{new Date(lead.lastContactDate).toLocaleDateString("he-IL")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Trial lessons */}
          {lead.trialLessons && lead.trialLessons.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">שיעורי ניסיון</h3>
              <div className="space-y-2">
                {lead.trialLessons.map((t) => (
                  <div key={t.id} className="text-sm p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span>{new Date(t.scheduledAt).toLocaleDateString("he-IL")}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    {t.group && <p className="text-xs text-slate-500 mt-1">{t.group.name}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {lead.tasks && lead.tasks.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">משימות</h3>
              <div className="space-y-2">
                {lead.tasks.map((t) => (
                  <div key={t.id} className="text-sm p-2 bg-slate-50 rounded-lg flex items-center justify-between">
                    <span>{t.title}</span>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <StudentModal
        isOpen={showConvert}
        onClose={() => setShowConvert(false)}
        leadId={Number(id)}
        leadName={lead.fullName}
      />
      <TrialLessonModal
        isOpen={showTrial}
        onClose={() => setShowTrial(false)}
        defaultLeadId={Number(id)}
      />
      <TaskModal
        isOpen={showTask}
        onClose={() => setShowTask(false)}
        defaultLeadId={Number(id)}
      />
    </div>
  )
}
