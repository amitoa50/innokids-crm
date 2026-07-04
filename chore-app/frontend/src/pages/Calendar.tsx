import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { useQuery } from "@tanstack/react-query"
import client from "../api/client"
import type { TrialLesson, Lead, Group } from "../types"

export default function CalendarPage() {
  const { data: trials = [] } = useQuery<TrialLesson[]>({
    queryKey: ["trialLessons"],
    queryFn: async () => { const { data } = await client.get("/trial-lesson"); return data }
  })

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: async () => { const { data } = await client.get("/lead"); return data }
  })

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => { const { data } = await client.get("/group"); return data }
  })

  const now = new Date()

  // Trial events
  const trialEvents = trials.map((t) => ({
    id: `trial-${t.id}`,
    title: `ניסיון: ${t.lead?.fullName || "ליד"}`,
    date: t.scheduledAt.slice(0, 10),
    backgroundColor: "var(--color-event-trial)",
    borderColor: "var(--color-event-trial)",
  }))

  // Follow-up events
  const followUpEvents = leads
    .filter((l) => l.nextFollowUpDate && l.status !== "CLOSED" && l.status !== "CONVERTED")
    .map((l) => ({
      id: `followup-${l.id}`,
      title: `מעקב: ${l.fullName}`,
      date: l.nextFollowUpDate!.slice(0, 10),
      backgroundColor: new Date(l.nextFollowUpDate!) < now
        ? "var(--color-event-overdue)"
        : "var(--color-event-followup)",
      borderColor: new Date(l.nextFollowUpDate!) < now
        ? "var(--color-event-overdue)"
        : "var(--color-event-followup)",
    }))

  // Group session events (weekly recurring — show current week's day)
  const groupEvents = groups
    .filter((g) => g.status === "ACTIVE" && g.dayOfWeek)
    .map((g) => ({
      id: `group-${g.id}`,
      title: `קבוצה: ${g.name}`,
      daysOfWeek: [dayNameToNumber(g.dayOfWeek!)],
      backgroundColor: "var(--color-event-group)",
      borderColor: "var(--color-event-group)",
    }))

  const events = [...trialEvents, ...followUpEvents, ...groupEvents]

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
            left: "dayGridMonth,dayGridWeek",
          }}
          buttonText={{
            today: "היום",
            month: "חודש",
            week: "שבוע",
          }}
          height="auto"
        />
      </div>

      <div className="flex gap-4 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-event-trial)" }} /> שיעור ניסיון
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-event-followup)" }} /> מעקב
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-event-group)" }} /> קבוצה
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-event-overdue)" }} /> באיחור
        </div>
      </div>
    </div>
  )
}

function dayNameToNumber(dayName: string): number {
  const map: Record<string, number> = {
    "ראשון": 0,
    "שני": 1,
    "שלישי": 2,
    "רביעי": 3,
    "חמישי": 4,
    "שישי": 5,
    "שבת": 6,
  }
  return map[dayName] ?? 0
}
