import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import client from "../api/client"
import type { AutomationRule, ScheduledMessageList, TemplateWithUsage } from "../types"
import StatusBadge from "../components/StatusBadge"
import TemplateEditorModal from "../components/TemplateEditorModal"
import ConfirmDialog from "../components/ConfirmDialog"
import { triggerLabel } from "../lib/automationLabels"

const templateStatusLabels: Record<string, string> = {
  DRAFT: "טיוטה",
  PENDING: "ממתין לאישור",
  APPROVED: "מאושר",
  REJECTED: "נדחה"
}

const templateCategoryLabels: Record<string, string> = {
  UTILITY: "שירות",
  MARKETING: "שיווק",
  AUTHENTICATION: "אימות"
}

function hebUnit(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`
}

function timingLabel(mins: number): string {
  if (mins === 0) return "מיידי"
  const abs = Math.abs(mins)
  let unit: string
  if (abs % 1440 === 0) unit = hebUnit(abs / 1440, "יום", "ימים")
  else if (abs % 60 === 0) unit = hebUnit(abs / 60, "שעה", "שעות")
  else unit = hebUnit(abs, "דקה", "דקות")
  return mins < 0 ? `${unit} לפני` : `${unit} אחרי`
}

const fmt = (iso: string) => new Date(iso).toLocaleString("he-IL")

const outboxFilters = [
  { key: "", label: "הכל" },
  { key: "PENDING", label: "ממתין" },
  { key: "SENT", label: "נשלח" },
  { key: "FAILED", label: "נכשל" },
  { key: "CANCELLED", label: "בוטל" }
]

export default function Automation() {
  const [status, setStatus] = useState("")

  const rules = useQuery<AutomationRule[]>({
    queryKey: ["automation", "rule"],
    queryFn: async () => {
      const { data } = await client.get("/automation/rule")
      return data
    }
  })

  const outbox = useQuery<ScheduledMessageList>({
    queryKey: ["automation", "scheduled-message", status],
    queryFn: async () => {
      const { data } = await client.get("/automation/scheduled-message", {
        params: status ? { status } : {}
      })
      return data
    },
    refetchInterval: 30000
  })

  const [editing, setEditing] = useState<TemplateWithUsage | null>(null)
  const templates = useQuery<TemplateWithUsage[]>({
    queryKey: ["automation", "template"],
    queryFn: async () => {
      const { data } = await client.get("/automation/template")
      return data
    }
  })

  // Manual Meta-approval sync: the admin mirrors WhatsApp Manager outcomes here.
  const queryClient = useQueryClient()
  const [pendingApprove, setPendingApprove] = useState<TemplateWithUsage | null>(null)
  const statusMutation = useMutation({
    mutationFn: async (params: { id: number; status: string; category?: string }) =>
      client.put(`/automation/template/${params.id}/status`, { status: params.status, category: params.category }),
    onSuccess: () => {
      toast.success("סטטוס התבנית עודכן")
      queryClient.invalidateQueries({ queryKey: ["automation", "template"] })
      setPendingApprove(null)
    },
    onError: () => toast.error("עדכון סטטוס התבנית נכשל")
  })

  function changeStatus(t: TemplateWithUsage, status: string) {
    if (status === "APPROVED") {
      setPendingApprove(t)
      return
    }
    statusMutation.mutate({ id: t.id, status })
  }

  useEffect(() => {
    if (rules.isError || outbox.isError || templates.isError) toast.error("טעינת האוטומציות נכשלה")
  }, [rules.isError, outbox.isError, templates.isError])

  const counts = outbox.data?.counts || {}
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const chipCount = (key: string) => (key ? counts[key] || 0 : total)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">אוטומציות</h1>

      {/* Rules */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">כללי אוטומציה</h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">שם</th>
                <th className="px-4 py-3 font-medium">טריגר</th>
                <th className="px-4 py-3 font-medium">תבנית</th>
                <th className="px-4 py-3 font-medium">תזמון</th>
                <th className="px-4 py-3 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">טוען...</td></tr>
              ) : (rules.data?.length ?? 0) === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">אין כללי אוטומציה</td></tr>
              ) : (
                rules.data!.map((r) => (
                  <tr key={r.id} className="text-slate-700">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 text-slate-500">{triggerLabel(r.triggerEvent)}</td>
                    <td className="px-4 py-3" dir="ltr">{r.templateName}</td>
                    <td className="px-4 py-3">{timingLabel(r.offsetMinutes)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Templates */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">תבניות הודעה</h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">תבנית</th>
                <th className="px-4 py-3 font-medium">אוטומציה</th>
                <th className="px-4 py-3 font-medium">תוכן</th>
                <th className="px-4 py-3 font-medium">קטגוריה</th>
                <th className="px-4 py-3 font-medium">אישור מטא</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.isLoading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">טוען...</td></tr>
              ) : (templates.data?.length ?? 0) === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">אין תבניות</td></tr>
              ) : (
                templates.data!.map((t) => (
                  <tr key={t.id} className="text-slate-700">
                    <td className="px-4 py-3" dir="ltr">{t.name}</td>
                    <td className="px-4 py-3 text-slate-500">{t.usedBy.map((u) => triggerLabel(u.triggerEvent)).join(", ") || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-md overflow-hidden text-ellipsis whitespace-nowrap text-slate-500">{t.body}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.category}
                        onChange={(e) => statusMutation.mutate({ id: t.id, status: t.status, category: e.target.value })}
                        disabled={statusMutation.isPending}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 bg-white"
                      >
                        {Object.entries(templateCategoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.status}
                        onChange={(e) => changeStatus(t, e.target.value)}
                        disabled={statusMutation.isPending}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 bg-white"
                      >
                        {Object.entries(templateStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditing(t)}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                      >
                        ערוך
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Outbox */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">הודעות מתוזמנות</h2>

        <div className="flex flex-wrap gap-2 mb-3">
          {outboxFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                status === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label} ({chipCount(f.key)})
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">ליד</th>
                <th className="px-4 py-3 font-medium">אוטומציה</th>
                <th className="px-4 py-3 font-medium">תבנית</th>
                <th className="px-4 py-3 font-medium">סטטוס</th>
                <th className="px-4 py-3 font-medium">מתוזמן ל</th>
                <th className="px-4 py-3 font-medium">עודכן</th>
                <th className="px-4 py-3 font-medium">סיבת כשל</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {outbox.isLoading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">טוען...</td></tr>
              ) : (outbox.data?.items.length ?? 0) === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">אין הודעות מתוזמנות</td></tr>
              ) : (
                outbox.data!.items.map((m) => (
                  <tr key={m.id} className="text-slate-700">
                    <td className="px-4 py-3">
                      {m.lead ? (
                        <Link to={`/leads/${m.lead.id}`} className="text-indigo-600 hover:underline">{m.lead.fullName}</Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{triggerLabel(m.triggerEvent)}</td>
                    <td className="px-4 py-3" dir="ltr">{m.templateName}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">{fmt(m.dueAt)}</td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">{fmt(m.updatedAt)}</td>
                    <td className="px-4 py-3 text-slate-500">{m.failureReason || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && <TemplateEditorModal template={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        isOpen={pendingApprove !== null}
        onClose={() => setPendingApprove(null)}
        onConfirm={() => pendingApprove && statusMutation.mutate({ id: pendingApprove.id, status: "APPROVED" })}
        title="סימון תבנית כמאושרת"
        message={`יש לסמן "מאושר" רק כאשר נוסח התבנית ב-CRM זהה במדויק לנוסח שאושר על ידי מטא. תבנית מאושרת נשלחת ללקוחות אמיתיים. לאשר את "${pendingApprove?.name}"?`}
        confirmLabel="סמן כמאושר"
        isPending={statusMutation.isPending}
      />
    </div>
  )
}
