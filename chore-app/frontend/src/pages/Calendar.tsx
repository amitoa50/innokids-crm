import { useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { useQuery } from "@tanstack/react-query"
import client from "../api/client"
import { useAuth } from "../hooks/useAuth"
import type { Chore } from "../types"
import ChoreModal from "../components/ChoreModal"

const statusColorMap: Record<string, string> = {
  PENDING: "#3b82f6",
  COMPLETED: "#22c55e",
  OVERDUE: "#ef4444",
}

export default function CalendarPage() {
  const { isAdmin } = useAuth()
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const { data: chores = [] } = useQuery<Chore[]>({
    queryKey: ["chores"],
    queryFn: async () => {
      const { data } = await client.get("/chores")
      return data
    },
  })

  const events = chores.map((chore) => ({
    id: String(chore.id),
    title: chore.title,
    date: chore.dueDate.slice(0, 10),
    backgroundColor: statusColorMap[chore.status] ?? "#94a3b8",
    borderColor: statusColorMap[chore.status] ?? "#94a3b8",
    extendedProps: { chore },
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">יומן</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          direction="rtl"
          locale="he"
          events={events}
          headerToolbar={{
            right: "prev,next today",
            center: "title",
            left: "dayGridMonth",
          }}
          buttonText={{
            today: "היום",
            month: "חודש",
          }}
          height="auto"
          eventClick={(info) => {
            const chore = info.event.extendedProps.chore as Chore
            if (isAdmin) {
              setSelectedChore(chore)
              setModalOpen(true)
            }
          }}
        />
      </div>

      <div className="flex gap-4 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="w-3 h-3 rounded-full bg-blue-500" /> ממתין
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="w-3 h-3 rounded-full bg-green-500" /> הושלם
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="w-3 h-3 rounded-full bg-red-500" /> באיחור
        </div>
      </div>

      <ChoreModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedChore(null)
        }}
        chore={selectedChore}
      />
    </div>
  )
}
