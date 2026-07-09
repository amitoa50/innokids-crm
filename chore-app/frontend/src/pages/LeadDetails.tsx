import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Phone, Mail, Copy, Pencil } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Lead, User, Conversation } from "../types"
import StatusBadge from "../components/StatusBadge"
import { PIPELINE_STATUSES, statusLabel } from "../lib/statusLabels"
import ActivityTimeline from "../components/ActivityTimeline"
import StudentModal from "../components/StudentModal"
import TrialLessonModal from "../components/TrialLessonModal"
import TaskModal from "../components/TaskModal"
import LeadModal from "../components/LeadModal"
import TagPicker from "../components/TagPicker"

const statuses = [...PIPELINE_STATUSES]

function waTicks(status: string): string {
  if (status === "READ") return "✓✓ נקרא"
  if (status === "DELIVERED") return "✓✓ נמסר"
  if (status === "SENT") return "✓ נשלח"
  if (status === "FAILED") return "✗ נכשל"
  return status
}

export default function LeadDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showConvert, setShowConvert] = useState(false)
  const [showTrial, setShowTrial] = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [note, setNote] = useState("")
  const [msgBody, setMsgBody] = useState("")
  const [msgChannel, setMsgChannel] = useState("WHATSAPP")
  const [msgDirection, setMsgDirection] = useState("OUTBOUND")

  const { data: lead } = useQuery<Lead>({
    queryKey: ["lead", id],
    queryFn: async () => { const { data } = await client.get(`/lead/${id}`); return data }
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const { data } = await client.get("/user"); return data }
  })

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversation", id],
    queryFn: async () => { const { data } = await client.get(`/lead/${id}/conversation`); return data }
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => client.put(`/lead/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] })
      toast.success("סטטוס עודכן")
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { code?: string } } } }
      if (e.response?.data?.error?.code === "INVALID_TRANSITION") {
        toast.error("מעבר סטטוס לא חוקי בשלב זה")
      } else {
        toast.error("עדכון הסטטוס נכשל")
      }
    }
  })

  const messageMutation = useMutation({
    mutationFn: (body: { channel: string; direction: string; body: string }) =>
      client.post(`/lead/${id}/message`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation", id] })
      queryClient.invalidateQueries({ queryKey: ["lead", id] })
      setMsgBody("")
      toast.success("הודעה נשלחה")
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
      if (code === "NO_CONSENT") toast.error("אין אישור לשליחת וואטסאפ לליד זה")
      else if (code === "WINDOW_CLOSED_NO_TEMPLATE") toast.error("חלון 24 השעות סגור — נדרשת תבנית מאושרת")
      else toast.error("שליחת ההודעה נכשלה")
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
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
        >
          <Pencil size={14} />
          ערוך פרטים
        </button>
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
                  <option key={s} value={s}>{statusLabel(s)}</option>
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
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-sm text-slate-500">תגיות:</span>
              <TagPicker leadId={lead.id} tags={lead.tags || []} />
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

          {/* Communication */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">תקשורת</h3>
            {msgChannel === "WHATSAPP" && (
              <div className={`mb-3 text-xs rounded-lg px-3 py-2 ${
                !lead.whatsappConsent
                  ? "bg-red-50 text-red-700"
                  : lead.whatsappWindowExpiresAt && new Date(lead.whatsappWindowExpiresAt) > new Date()
                    ? "bg-green-50 text-green-700"
                    : "bg-amber-50 text-amber-700"
              }`}>
                {!lead.whatsappConsent
                  ? "אין אישור וואטסאפ — לא ניתן לשלוח"
                  : lead.whatsappWindowExpiresAt && new Date(lead.whatsappWindowExpiresAt) > new Date()
                    ? `חלון 24 השעות פתוח (עד ${new Date(lead.whatsappWindowExpiresAt).toLocaleString("he-IL")})`
                    : "חלון 24 השעות סגור — הודעה חופשית תיחסם, נדרשת תבנית מאושרת"}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={msgChannel}
                onChange={(e) => setMsgChannel(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
              >
                <option value="WHATSAPP">וואטסאפ</option>
                <option value="PHONE">טלפון</option>
                <option value="EMAIL">אימייל</option>
                <option value="SMS">SMS</option>
                <option value="MANUAL">אחר</option>
              </select>
              <select
                value={msgDirection}
                onChange={(e) => setMsgDirection(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
              >
                <option value="OUTBOUND">יוצאת</option>
                <option value="INBOUND">נכנסת</option>
              </select>
              <input
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="רשום הודעה..."
                className="flex-1 min-w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === "Enter" && msgBody && messageMutation.mutate({ channel: msgChannel, direction: msgDirection, body: msgBody })}
              />
              <button
                onClick={() => msgBody && messageMutation.mutate({ channel: msgChannel, direction: msgDirection, body: msgBody })}
                disabled={!msgBody || messageMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                רשום
              </button>
            </div>
            {conversations.length === 0 ? (
              <p className="text-sm text-slate-400">אין תקשורת מתועדת</p>
            ) : (
              conversations.map((c) => (
                <div key={c.id} className="mb-4">
                  <p className="text-xs text-slate-400 mb-1">{c.channel}</p>
                  <div className="conversation">
                    {c.messages.map((m) => (
                      <div key={m.id} className={`msg ${m.direction === "INBOUND" ? "inbound" : "outbound"}`}>
                        {m.body}
                        <span className="meta">
                          {new Date(m.createdAt).toLocaleString("he-IL")}
                          {m.sentBy ? ` · ${m.sentBy.name}` : ""}
                          {m.direction === "OUTBOUND" && m.channel === "WHATSAPP" ? ` · ${waTicks(m.status)}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
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
              {lead.childName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ילד/ה</span>
                  <span className="text-slate-700">{lead.childName}{lead.childBirthYear ? ` (${lead.childBirthYear})` : ""}</span>
                </div>
              )}
              {lead.preferredChannel && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ערוץ מועדף</span>
                  <span className="text-slate-700">{lead.preferredChannel}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">וואטסאפ</span>
                <span className="text-slate-700">{lead.whatsappConsent ? "מאושר" : "לא מאושר"}</span>
              </div>
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
        defaultLeadName={lead.fullName}
      />
      <TaskModal
        isOpen={showTask}
        onClose={() => setShowTask(false)}
        defaultLeadId={Number(id)}
      />
      <LeadModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        lead={lead}
      />
    </div>
  )
}
