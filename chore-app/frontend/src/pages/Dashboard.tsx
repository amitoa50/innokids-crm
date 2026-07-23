import { useQuery } from "@tanstack/react-query"
import { Users2, FlaskConical, TrendingUp, GraduationCap } from "lucide-react"
import client from "../api/client"
import type { DashboardStats, PipelineStats, SourceStats, Lead } from "../types"
import StatusBadge from "../components/StatusBadge"

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => { const { data } = await client.get("/report/dashboard"); return data }
  })

  const { data: pipeline } = useQuery<PipelineStats>({
    queryKey: ["pipeline-stats"],
    queryFn: async () => { const { data } = await client.get("/report/pipeline"); return data }
  })

  const { data: sources } = useQuery<SourceStats>({
    queryKey: ["source-stats"],
    queryFn: async () => { const { data } = await client.get("/report/source"); return data }
  })

  const { data: recentLeads = [] } = useQuery<Lead[]>({
    queryKey: ["recent-leads"],
    queryFn: async () => { const { data } = await client.get("/lead"); return data }
  })

  const upcomingFollowUps = recentLeads.filter(
    l => l.nextFollowUpDate && l.status !== "CLOSED" && l.status !== "CONVERTED"
  ).slice(0, 5)

  const statCards = [
    { label: "לידים חדשים החודש", value: stats?.newLeads ?? 0, icon: Users2, color: "text-blue-600 bg-blue-50" },
    { label: "שיעורי ניסיון", value: stats?.trialsScheduled ?? 0, icon: FlaskConical, color: "text-cyan-600 bg-cyan-50" },
    { label: "המרות", value: stats?.conversions ?? 0, icon: TrendingUp, color: "text-green-600 bg-green-50" },
    { label: "תלמידים פעילים", value: stats?.activeStudents ?? 0, icon: GraduationCap, color: "text-indigo-600 bg-indigo-50" },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[var(--font-serif)] font-semibold text-[var(--color-text-primary)]">דשבורד</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-tile__label">{label}</p>
                <p className="stat-tile__value">{value}</p>
              </div>
              <div className={`p-3 rounded-lg ${color}`}>
                <Icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div className="card">
          <h3 className="font-[var(--font-serif)] font-semibold text-[var(--color-text-primary)] mb-4">צנרת מכירות</h3>
          {pipeline && Object.entries(pipeline).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(pipeline).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <StatusBadge status={status} />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state__message">אין לידים עדיין</p>
          )}
        </div>

        {/* Sources */}
        <div className="card">
          <h3 className="font-[var(--font-serif)] font-semibold text-[var(--color-text-primary)] mb-4">לידים לפי מקור</h3>
          {sources && Object.entries(sources).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(sources).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <StatusBadge status={source} />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state__message">אין נתונים</p>
          )}
        </div>
      </div>

      {/* Upcoming follow-ups */}
      <div className="card">
        <h3 className="font-[var(--font-serif)] font-semibold text-[var(--color-text-primary)] mb-4">מעקבים קרובים</h3>
        {upcomingFollowUps.length > 0 ? (
          <div className="space-y-2">
            {upcomingFollowUps.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{lead.fullName}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{lead.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={lead.status} />
                  {lead.nextFollowUpDate && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {new Date(lead.nextFollowUpDate).toLocaleDateString("he-IL")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state__message">אין מעקבים מתוכננים</p>
        )}
      </div>
    </div>
  )
}
