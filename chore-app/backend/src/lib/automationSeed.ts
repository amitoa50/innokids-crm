import prisma from "./prisma"

interface TemplateSeed {
  name: string
  category: string
  body: string
  variables: string[]
}

interface RuleSeed {
  name: string
  triggerEvent: string
  templateName: string
  offsetMinutes: number
}

const templates: TemplateSeed[] = [
  { name: "lead_welcome", category: "UTILITY", body: "שלום {{1}}! קיבלנו את פנייתך ל-INNOKIDS 🙂 נחזור אליך בהקדם. אפשר להשיב כאן בכל שאלה.", variables: ["parentName"] },
  { name: "no_response_nudge", category: "MARKETING", body: "היי {{1}}, ניסינו ליצור איתך קשר בנוגע לקורסי התכנות ב-INNOKIDS ולא הצלחנו להשיג אותך. עדיין מעוניינים? נשמח לחזור אליך 🙂", variables: ["parentName"] },
  { name: "trial_confirmation", category: "UTILITY", body: "שלום {{1}}, שיעור הניסיון שלכם ב-INNOKIDS נקבע ל-{{2}} בשעה {{3}}. נתראה!", variables: ["parentName", "date", "time"] },
  { name: "trial_reminder", category: "UTILITY", body: "היי {{1}}, תזכורת לשיעור הניסיון ב-INNOKIDS ב-{{2}} בשעה {{3}}. מחכים לראותכם!", variables: ["parentName", "date", "time"] },
  { name: "post_trial_followup", category: "MARKETING", body: "היי {{1}}, תודה שהשתתפתם בשיעור הניסיון של {{2}} ב-INNOKIDS! נשמח לשמוע איך היה ולעזור בהמשך 🙂", variables: ["parentName", "childName"] },
  { name: "trial_no_show_reschedule", category: "UTILITY", body: "היי {{1}}, חבל שלא הצלחתם להגיע לשיעור הניסיון ב-INNOKIDS. נשמח לתאם מועד חדש — מתי נוח לכם?", variables: ["parentName"] },
  { name: "student_welcome", category: "UTILITY", body: "ברוכים הבאים ל-INNOKIDS, {{1}}! שמחים ש{{2}} מצטרפ/ת אלינו. נעדכן בפרטי הקבוצה והשיעור הראשון בקרוב 🙂", variables: ["parentName", "childName"] }
]

const rules: RuleSeed[] = [
  { name: "ליד חדש — הודעת פתיחה", triggerEvent: "LEAD_WELCOME", templateName: "lead_welcome", offsetMinutes: 2 },
  { name: "ליד ללא מענה — תזכורת", triggerEvent: "NO_RESPONSE_NUDGE", templateName: "no_response_nudge", offsetMinutes: 0 },
  { name: "שיעור ניסיון — אישור", triggerEvent: "TRIAL_CONFIRMATION", templateName: "trial_confirmation", offsetMinutes: 0 },
  { name: "שיעור ניסיון — תזכורת", triggerEvent: "TRIAL_REMINDER", templateName: "trial_reminder", offsetMinutes: -1440 },
  { name: "אחרי ניסיון — מעקב", triggerEvent: "POST_TRIAL_FOLLOW_UP", templateName: "post_trial_followup", offsetMinutes: 1440 },
  { name: "לא הגיע לניסיון — תיאום מחדש", triggerEvent: "TRIAL_NO_SHOW_RESCHEDULE", templateName: "trial_no_show_reschedule", offsetMinutes: 180 },
  { name: "המרה לתלמיד — ברוכים הבאים", triggerEvent: "STUDENT_WELCOME", templateName: "student_welcome", offsetMinutes: 0 }
]

// Idempotent seed of the automation templates + rules. Templates are marked APPROVED
// only under the mock provider (dev convenience); real approval comes from Meta and is
// never faked in production.
export async function seedAutomation() {
  const approved = process.env.WHATSAPP_PROVIDER === "mock"

  for (const t of templates) {
    await prisma.messageTemplate.upsert({
      where: { name: t.name },
      update: {},
      create: {
        name: t.name,
        language: "he",
        category: t.category,
        body: t.body,
        variables: JSON.stringify(t.variables),
        status: approved ? "APPROVED" : "DRAFT"
      }
    })
  }

  for (const r of rules) {
    const existing = await prisma.automationRule.findFirst({ where: { triggerEvent: r.triggerEvent } })
    if (!existing) {
      await prisma.automationRule.create({
        data: {
          name: r.name,
          triggerEvent: r.triggerEvent,
          templateName: r.templateName,
          offsetMinutes: r.offsetMinutes,
          active: true
        }
      })
    }
  }

  console.log(`Seeded ${templates.length} WhatsApp templates and ${rules.length} automation rules`)
}
