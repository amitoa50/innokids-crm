import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import client from "../api/client"
import type { AutomationRule, ScheduledMessageList } from "../types"
import StatusBadge from "../components/StatusBadge"

const triggerLabels: Record<string, string> = {
  LEAD_WELCOME: "ליד חדש — פתיחה",
  NO_RESPONSE_NUDGE: "ללא מענה — תזכורת",
  TRIAL_CONFIRMATION: "ניסיון — אישור",
  TRIAL_REMINDER: "ניסיון — תזכורת",
  POST_TRIAL_FOLLOW_UP: "אחרי ניסיון — מעקב",
  TRIAL_NO_SHOW_RESCHEDULE: "לא הגיע — תיאום מחדש",
  STUDENT_WELCOME: "תלמיד חדש — ברוכים הבאים"
}

const triggerLabel = (t: string) => triggerLabels[t] || t

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

  useEffect(() => {
    if (rules.isError || outbox.isError) toast.error("טעינת האוטומציות נכשלה")
  }, [rules.isError, outbox.isError])

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
    </div>
  )
}
