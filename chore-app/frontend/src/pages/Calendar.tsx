import { useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import client from "../api/client"
import { useAuth } from "../hooks/useAuth"
import type { User } from "../types"

interface CalendarEvent {
  id: string
  type: "TRIAL" | "GROUP" | "TASK" | "FOLLOW_UP"
  title: string
  start: string
  end?: string
  allDay: boolean
  entityType: string
  entityId: number
  overdue?: boolean
}

const TYPE_COLOR: Record<string, string> = {
  TRIAL: "var(--color-event-trial)",
  GROUP: "var(--color-event-group)",
  TASK: "var(--color-event-task)",
  FOLLOW_UP: "var(--color-event-followup)",
}

function colorFor(e: CalendarEvent): string {
  if (e.type === "FOLLOW_UP" && e.overdue) return "var(--color-event-overdue)"
  return TYPE_COLOR[e.type] || "var(--color-event-trial)"
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  // Admin filter: "" = my calendar, "all" = whole team, "<id>" = a specific staff member.
  const [staffFilter, setStaffFilter] = useState("")

  const { data: staff = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const { data } = await client.get("/user"); return data },
    enabled: isAdmin,
  })

  // Staff users are always locked to themselves server-side (no param sent).
  const staffParam = isAdmin ? (staffFilter === "" ? String(user?.id ?? "") : staffFilter) : ""

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar", range?.from, range?.to, staffParam],
    queryFn: async () => {
      const params = new URLSearchParams({ from: range!.from, to: range!.to })
      if (staffParam) params.set("staffId", staffParam)
      const { data } = await client.get(`/calendar?${params}`)
      return data
    },
    enabled: !!range,
  })

  const fcEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: colorFor(e),
    borderColor: colorFor(e),
    extendedProps: { entityType: e.entityType, entityId: e.entityId },
  }))

  function handleDatesSet(arg: DatesSetArg) {
    setRange({ from: arg.startStr, to: arg.endStr })
  }

  function handleEventClick(arg: EventClickArg) {
    const { entityType, entityId } = arg.event.extendedProps as { entityType: string; entityId: number }
    if (entityType === "LEAD") navigate(`/leads/${entityId}`)
    else if (entityType === "STUDENT") navigate(`/students/${entityId}`)
    else if (entityType === "GROUP") navigate("/groups")
    else navigate("/tasks")
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">יומן</h1>
        {isAdmin && (
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">היומן שלי</option>
            <option value="all">כל הצוות</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          direction="rtl"
          locale="he"
          events={fcEvents}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          headerToolbar={{
            right: "prev,next today",
            center: "title",
            left: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{ today: "היום", month: "חודש", week: "שבוע", day: "יום" }}
          slotMinTime="08:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={true}
          allDayText="כל היום"
          height="auto"
        />
      </div>

      <div className="flex gap-4 mt-4 flex-wrap">
        <LegendDot color="var(--color-event-trial)" label="שיעור ניסיון" />
        <LegendDot color="var(--color-event-group)" label="קבוצה" />
        <LegendDot color="var(--color-event-task)" label="משימה" />
        <LegendDot color="var(--color-event-followup)" label="מעקב" />
        <LegendDot color="var(--color-event-overdue)" label="באיחור" />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} /> {label}
    </div>
  )
}
