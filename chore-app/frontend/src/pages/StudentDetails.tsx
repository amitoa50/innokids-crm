import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Phone, Mail } from "lucide-react"
import client from "../api/client"
import type { Student } from "../types"
import StatusBadge from "../components/StatusBadge"
import ActivityTimeline from "../components/ActivityTimeline"

export default function StudentDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: student } = useQuery<Student>({
    queryKey: ["student", id],
    queryFn: async () => { const { data } = await client.get(`/student/${id}`); return data }
  })

  if (!student) return <div className="text-center py-8 text-slate-400">טוען...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/students")} className="p-2 text-slate-400 hover:text-slate-600">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{student.childName}</h1>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={student.status} />
            <StatusBadge status={student.learningFormat} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Activity */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">היסטוריית פעילות</h3>
            <ActivityTimeline activities={student.activityLogs || []} />
          </div>

          {/* Notes */}
          {student.notes && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">הערות</h3>
              <pre className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{student.notes}</pre>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Parent info */}
          {student.lead && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-semibold text-slate-800">פרטי הורה</h3>
              <div className="space-y-2 text-sm">
                <p className="text-slate-700 font-medium">{student.lead.fullName}</p>
                {student.lead.phone && (
                  <p className="flex items-center gap-1 text-slate-500" dir="ltr">
                    <Phone size={14} /> {student.lead.phone}
                  </p>
                )}
                {student.lead.email && (
                  <p className="flex items-center gap-1 text-slate-500">
                    <Mail size={14} /> {student.lead.email}
                  </p>
                )}
                {student.lead.id && (
                  <button
                    onClick={() => navigate(`/leads/${student.lead!.id}`)}
                    className="text-indigo-600 hover:text-indigo-700 text-sm"
                  >
                    צפה בליד
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Group */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-semibold text-slate-800">קבוצה</h3>
            {student.group ? (
              <p className="text-sm text-slate-700">{student.group.name}</p>
            ) : (
              <p className="text-sm text-slate-400">לא משויך לקבוצה</p>
            )}
          </div>

          {/* Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
            <h3 className="font-semibold text-slate-800">פרטים</h3>
            <div className="text-sm space-y-2">
              {student.childBirthYear && (
                <div className="flex justify-between">
                  <span className="text-slate-500">שנת לידה</span>
                  <span className="text-slate-700">{student.childBirthYear}</span>
                </div>
              )}
              {student.branch && (
                <div className="flex justify-between">
                  <span className="text-slate-500">סניף</span>
                  <span className="text-slate-700">{student.branch}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">הרשמה</span>
                <span className="text-slate-700">{new Date(student.enrolledAt).toLocaleDateString("he-IL")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
