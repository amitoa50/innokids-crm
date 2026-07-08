import { useState, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { TemplateWithUsage } from "../types"
import { triggerLabel, variableLabels, variableSamples } from "../lib/automationLabels"

interface Props {
  template: TemplateWithUsage
  onClose: () => void
}

function renderPreview(body: string, variables: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_m, n) => {
    const name = variables[Number(n) - 1]
    return name ? variableSamples[name] ?? `{{${n}}}` : `{{${n}}}`
  })
}

export default function TemplateEditorModal({ template, onClose }: Props) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState(template.body)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mutation = useMutation({
    mutationFn: async () => client.put(`/automation/template/${template.id}`, { body }),
    onSuccess: (res: { data?: { approvalRevoked?: boolean } }) => {
      if (res.data?.approvalRevoked) {
        toast.warning("התבנית נשמרה וסומנה כטיוטה — נדרש אישור מחדש של מטא לפני שליחה")
      } else {
        toast.success("התבנית נשמרה")
      }
      queryClient.invalidateQueries({ queryKey: ["automation", "template"] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
      toast.error(msg || "שמירת התבנית נכשלה")
    }
  })

  function insertPlaceholder(index: number) {
    const token = `{{${index}}}`
    const el = textareaRef.current
    if (!el) {
      setBody(body + token)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    setBody(body.slice(0, start) + token + body.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const owner = template.usedBy.map((u) => triggerLabel(u.triggerEvent)).join(", ") || "—"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">עריכת תבנית</h3>
            <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{template.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-slate-600">
            <span className="text-slate-400">אוטומציה: </span>{owner}
          </div>

          {template.status === "APPROVED" && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              תבנית זו מאושרת. שמירת שינוי בנוסח עשויה לדרוש אישור מחדש של מטא לפני שההודעה תישלח שוב.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">תוכן ההודעה</label>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {template.variables.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">שדות זמינים (לחצו כדי להוסיף):</p>
              <div className="flex flex-wrap gap-2">
                {template.variables.map((v, i) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertPlaceholder(i + 1)}
                    className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                  >
                    {variableLabels[v] || v} <span dir="ltr" className="text-indigo-400">{`{{${i + 1}}}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-500 mb-1">תצוגה מקדימה:</p>
            <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">
              {renderPreview(body, template.variables)}
            </div>
          </div>
        </div>

        <div className="flex justify-start gap-3 p-5 border-t border-slate-100">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || body.trim().length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "שומר..." : "שמירה"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
