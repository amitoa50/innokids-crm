import type { ActivityLog } from "../types"

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return "עכשיו"
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`
  return `לפני ${Math.floor(diff / 86400)} ימים`
}

function getDotClass(type: string): string {
  if (type.includes("STATUS")) return "timeline-dot--status-change"
  if (type.includes("NOTE")) return "timeline-dot--note"
  if (type.includes("TRIAL")) return "timeline-dot--trial"
  if (type.includes("CONVERTED")) return "timeline-dot--conversion"
  if (type.includes("SOURCE") || type.includes("REOPENED")) return "timeline-dot--source"
  return ""
}

interface Props {
  activities: ActivityLog[]
}

export default function ActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">אין פעילות</p>
  }

  return (
    <div className="timeline">
      {activities.map((activity) => (
        <div key={activity.id} className="timeline-item">
          <div className={`timeline-dot ${getDotClass(activity.type)}`} />
          <div className="timeline-content">
            <p className="timeline-description">{activity.description}</p>
            <div className="timeline-meta">
              <span>{timeAgo(activity.createdAt)}</span>
              {activity.performedBy && (
                <span> · {activity.performedBy.name}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
