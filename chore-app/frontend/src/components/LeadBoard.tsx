import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"
import client from "../api/client"
import type { Lead } from "../types"
import { PIPELINE_STATUSES, statusLabel } from "../lib/statusLabels"
import StatusBadge from "./StatusBadge"
import { TagChips } from "./TagPicker"

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead.id)}
      className={`bg-white border border-slate-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="text-sm font-medium text-slate-800">{lead.fullName}</div>
      <div className="text-xs text-slate-500 mt-1" dir="ltr">{lead.phone}</div>
      <div className="flex items-center gap-2 mt-2">
        <StatusBadge status={lead.source} />
        {lead.assignedTo?.name && (
          <span className="text-xs text-slate-500">{lead.assignedTo.name}</span>
        )}
      </div>
      {lead.tags && lead.tags.length > 0 && (
        <div className="mt-2"><TagChips tags={lead.tags} /></div>
      )}
    </div>
  )
}

function Column({ status, leads, onOpen }: { status: string; leads: Lead[]; onOpen: (id: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-sm font-semibold text-slate-700">{statusLabel(status)}</span>
        <span className="text-xs text-slate-400">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-xl border p-2 space-y-2 transition-colors ${isOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

export default function LeadBoard({ leads }: { leads: Lead[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      client.put(`/lead/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("שגיאה בעדכון הסטטוס"),
  })

  function handleDragStart(e: DragStartEvent) {
    setActiveLead(leads.find((l) => l.id === Number(e.active.id)) ?? null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveLead(null)
    const { active, over } = e
    if (!over) return
    const leadId = Number(active.id)
    const newStatus = String(over.id)
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === newStatus) return
    mutation.mutate({ id: leadId, status: newStatus })
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            leads={leads.filter((l) => l.status === status)}
            onOpen={(id) => navigate(`/leads/${id}`)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className="bg-white border border-indigo-300 rounded-lg p-3 shadow-lg w-60">
            <div className="text-sm font-medium text-slate-800">{activeLead.fullName}</div>
            <div className="text-xs text-slate-500 mt-1" dir="ltr">{activeLead.phone}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
