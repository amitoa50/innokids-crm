import { useState, useRef, useEffect } from "react"
import { Bell } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import client from "../api/client"
import type { Notification } from "../types"

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return "עכשיו"
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`
  return `לפני ${Math.floor(diff / 86400)} ימים`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await client.get("/notification?unreadOnly=true")
      return data
    },
    refetchInterval: 30000,
  })

  const markRead = useMutation({
    mutationFn: (id: number) => client.put(`/notification/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">
            התראות
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-slate-400 text-center">אין התראות חדשות</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  markRead.mutate(n.id)
                }}
                className="w-full text-right p-3 hover:bg-slate-50 border-b border-slate-50 transition-colors"
              >
                <p className="text-sm text-slate-700">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
