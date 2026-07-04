import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Users2 } from "lucide-react"
import client from "../api/client"
import type { Group } from "../types"
import StatusBadge from "../components/StatusBadge"
import GroupModal from "../components/GroupModal"
import { useAuth } from "../hooks/useAuth"

export default function Groups() {
  const { isAdmin } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups", statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : ""
      const { data } = await client.get(`/group${params}`)
      return data
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">קבוצות</h1>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            קבוצה חדשה
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {[
          { value: "", label: "הכל" },
          { value: "ACTIVE", label: "פעילות" },
          { value: "FULL", label: "מלאות" },
          { value: "ARCHIVED", label: "בארכיון" }
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === value
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-800">{group.name}</h3>
                <p className="text-sm text-slate-500">{group.type}</p>
              </div>
              <StatusBadge status={group.status} />
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              {group.ageRange && <p>גילאים: {group.ageRange}</p>}
              <p>פורמט: <StatusBadge status={group.learningFormat} /></p>
              {(group.dayOfWeek || group.time) && (
                <p>{group.dayOfWeek} {group.time && `| ${group.time}`}</p>
              )}
              {group.teacher && <p>מורה: {group.teacher.name}</p>}
              {group.branch && <p>סניף: {group.branch}</p>}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Users2 size={14} />
                <span>{group._count?.students || 0}</span>
                {group.maxCapacity && <span>/ {group.maxCapacity}</span>}
              </div>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="col-span-full text-center py-8 text-sm text-slate-400">
            אין קבוצות להצגה
          </div>
        )}
      </div>

      <GroupModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}
