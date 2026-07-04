import { useQuery } from "@tanstack/react-query"
import { ClipboardList, CheckCircle2, Clock, AlertTriangle } from "lucide-react"
import client from "../api/client"
import type { Stats, Chore } from "../types"

export default function Reports() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ["reports", "stats"],
    queryFn: async () => {
      const { data } = await client.get("/reports/stats")
      return data
    },
  })

  const { data: overdue = [] } = useQuery<Chore[]>({
    queryKey: ["reports", "overdue"],
    queryFn: async () => {
      const { data } = await client.get("/reports/overdue")
      return data
    },
  })

  const { data: history = [] } = useQuery<Chore[]>({
    queryKey: ["reports", "history"],
    queryFn: async () => {
      const { data } = await client.get("/reports/history?limit=20")
      return data
    },
  })

  const statCards = [
    { label: "סה״כ תורנויות", value: stats?.totalChores ?? 0, icon: ClipboardList, color: "bg-slate-100 text-slate-600" },
    { label: "הושלמו", value: stats?.completedChores ?? 0, icon: CheckCircle2, color: "bg-green-100 text-green-600" },
    { label: "ממתינות", value: stats?.pendingChores ?? 0, icon: Clock, color: "bg-blue-100 text-blue-600" },
    { label: "באיחור", value: stats?.overdueChores ?? 0, icon: AlertTriangle, color: "bg-red-100 text-red-600" },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">דוחות</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">תורנויות באיחור</h2>
          </div>
          {overdue.length === 0 ? (
            <div className="p-5 text-sm text-slate-400 text-center">אין תורנויות באיחור</div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {overdue.map((c) => (
                <li key={c.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{c.title}</p>
                    <p className="text-xs text-slate-400">
                      מוקצה ל{c.assignedTo?.name ?? "לא ידוע"} &middot; יעד {new Date(c.dueDate).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                  <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    באיחור
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">היסטוריית השלמות</h2>
          </div>
          {history.length === 0 ? (
            <div className="p-5 text-sm text-slate-400 text-center">אין היסטוריה עדיין</div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {history.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">{c.title}</p>
                    <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      הושלם
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {c.assignedTo?.name ?? "לא ידוע"} &middot;{" "}
                    {c.completedAt ? new Date(c.completedAt).toLocaleDateString("he-IL") : "לא זמין"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
