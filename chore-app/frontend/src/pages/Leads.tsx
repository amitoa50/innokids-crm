import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Plus, Search, LayoutGrid, List } from "lucide-react"
import client from "../api/client"
import type { Lead, Tag } from "../types"
import StatusBadge from "../components/StatusBadge"
import { TagChips } from "../components/TagPicker"
import { PIPELINE_STATUSES, statusLabel } from "../lib/statusLabels"
import LeadModal from "../components/LeadModal"
import LeadBoard from "../components/LeadBoard"

export default function Leads() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")
  const [sourceFilter, setSourceFilter] = useState("")
  const [search, setSearch] = useState("")
  const [tagFilter, setTagFilter] = useState("")
  const [view, setView] = useState<"table" | "board">("table")

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: async () => { const { data } = await client.get("/tag"); return data }
  })

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads", statusFilter, sourceFilter, search, tagFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (sourceFilter) params.set("source", sourceFilter)
      if (search) params.set("search", search)
      if (tagFilter) params.set("tagId", tagFilter)
      const { data } = await client.get(`/lead?${params}`)
      return data
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">לידים</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === "table" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <List size={16} />
              טבלה
            </button>
            <button
              onClick={() => setView("board")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === "board" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <LayoutGrid size={16} />
              לוח
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            ליד חדש
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או טלפון..."
            className="pr-9 pl-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">כל הסטטוסים</option>
          {PIPELINE_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">כל המקורות</option>
          <option value="FACEBOOK">פייסבוק</option>
          <option value="INSTAGRAM">אינסטגרם</option>
          <option value="WEBSITE">אתר</option>
          <option value="MANUAL">ידני</option>
          <option value="OTHER">אחר</option>
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">כל התגיות</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Table / Board */}
      {view === "board" ? (
        <LeadBoard leads={leads} />
      ) : (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">שם</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">טלפון</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">מקור</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">סטטוס</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">משויך ל</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">מעקב הבא</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">נוצר</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-800">
                  <div>{lead.fullName}</div>
                  {lead.tags && lead.tags.length > 0 && (
                    <div className="mt-1"><TagChips tags={lead.tags} /></div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600" dir="ltr">{lead.phone}</td>
                <td className="px-4 py-3"><StatusBadge status={lead.source} /></td>
                <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                <td className="px-4 py-3 text-sm text-slate-600">{lead.assignedTo?.name || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {lead.nextFollowUpDate
                    ? new Date(lead.nextFollowUpDate).toLocaleDateString("he-IL")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {new Date(lead.createdAt).toLocaleDateString("he-IL")}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  אין לידים להצגה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      <LeadModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}
