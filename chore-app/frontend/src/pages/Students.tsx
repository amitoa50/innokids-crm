import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import client from "../api/client"
import type { Student } from "../types"
import StatusBadge from "../components/StatusBadge"

export default function Students() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["students", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (search) params.set("search", search)
      const { data } = await client.get(`/student?${params}`)
      return data
    }
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">תלמידים</h1>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="pr-9 pl-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">כל הסטטוסים</option>
          <option value="ACTIVE">פעיל</option>
          <option value="INACTIVE">לא פעיל</option>
          <option value="PAUSED">מושהה</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">שם הילד/ה</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">הורה</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">קבוצה</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">פורמט</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">סניף</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">הרשמה</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr
                key={student.id}
                onClick={() => navigate(`/students/${student.id}`)}
                className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{student.childName}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{student.lead?.fullName || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{student.group?.name || "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={student.learningFormat} /></td>
                <td className="px-4 py-3 text-sm text-slate-600">{student.branch || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {new Date(student.enrolledAt).toLocaleDateString("he-IL")}
                </td>
                <td className="px-4 py-3"><StatusBadge status={student.status} /></td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  אין תלמידים להצגה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
