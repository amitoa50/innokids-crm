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
  { name: "trial_confirmation", category: "UTILITY", body: "שלום {{1}}, שיעור הניסיון שלכם ב-INNOKIDS נקבע ל-{{2}} בשעה {{3}}. מומלץ להוסיף את המועד ליומן שלכם. נתראה!", variables: ["parentName", "date", "time"] },
  { name: "trial_reminder", category: "UTILITY", body: "היי {{1}}, תזכורת לשיעור הניסיון ב-INNOKIDS ב-{{2}} בשעה {{3}}. מחכים לראותכם!", variables: ["parentName", "date", "time"] },
  { name: "post_trial_followup", category: "MARKETING", body: "היי {{1}}, היה לנו ממש כיף ללמד את {{2}} בשיעור הניסיון ב-INNOKIDS! נשמח לשמוע איך היה מבחינתכם 🙂", variables: ["parentName", "childName"] },
  { name: "trial_no_show_reschedule", category: "UTILITY", body: "היי {{1}}, חבל שלא הצלחתם להגיע לשיעור הניסיון ב-INNOKIDS. נשמח לתאם מועד חדש — מתי נוח לכם?", variables: ["parentName"] },
  { name: "student_welcome", category: "UTILITY", body: "ברוכים הבאים ל-INNOKIDS, {{1}}! שמחים ש{{2}} מצטרפ/ת אלינו. נעדכן בפרטי הקבוצה והשיעור הראשון בקרוב 🙂", variables: ["parentName", "childName"] },
  { name: "lead_welcome_followup", category: "MARKETING", body: "היי {{1}}, רצינו לוודא שקיבלת את הפנייה שלנו ל-INNOKIDS 🙂 עדיין מעוניינים? נשמח לחזור אליך.", variables: ["parentName"] },
  { name: "no_response_nudge_2", category: "MARKETING", body: "היי {{1}}, ניסינו שוב ליצור קשר בנוגע לקורסי התכנות ב-INNOKIDS. עדיין רלוונטי עבורכם?", variables: ["parentName"] },
  { name: "no_response_nudge_3", category: "MARKETING", body: "היי {{1}}, זו פנייה אחרונה מצידנו — אם תרצו לשמוע עוד על INNOKIDS אנחנו כאן 🙂", variables: ["parentName"] },
  { name: "trial_reminder_1h", category: "UTILITY", body: "היי {{1}}, שיעור הניסיון ב-INNOKIDS מתחיל בעוד כשעה ({{2}}). קישור להצטרפות: {{3}} — נתראה!", variables: ["parentName", "time", "meetingUrl"] },
  { name: "trial_join_now", category: "UTILITY", body: "היי {{1}}, אפשר כבר להתחבר לשיעור הניסיון ב-INNOKIDS — מחכים לכם! 🙂", variables: ["parentName"] }
]

const rules: RuleSeed[] = [
  { name: "ליד חדש — הודעת פתיחה", triggerEvent: "LEAD_WELCOME", templateName: "lead_welcome", offsetMinutes: 2 },
  { name: "ליד ללא מענה — תזכורת", triggerEvent: "NO_RESPONSE_NUDGE", templateName: "no_response_nudge", offsetMinutes: 0 },
  { name: "שיעור ניסיון — אישור", triggerEvent: "TRIAL_CONFIRMATION", templateName: "trial_confirmation", offsetMinutes: 0 },
  { name: "שיעור ניסיון — תזכורת (24 שעות לפני)", triggerEvent: "TRIAL_REMINDER", templateName: "trial_reminder", offsetMinutes: -1440 },
  { name: "שיעור ניסיון — תזכורת (שעה לפני)", triggerEvent: "TRIAL_REMINDER_1H", templateName: "trial_reminder_1h", offsetMinutes: -60 },
  { name: "שיעור ניסיון — כניסה לשיעור", triggerEvent: "TRIAL_JOIN_NOW", templateName: "trial_join_now", offsetMinutes: -5 },
  { name: "אחרי ניסיון — מעקב", triggerEvent: "POST_TRIAL_FOLLOW_UP", templateName: "post_trial_followup", offsetMinutes: 60 },
  { name: "לא הגיע לניסיון — תיאום מחדש", triggerEvent: "TRIAL_NO_SHOW_RESCHEDULE", templateName: "trial_no_show_reschedule", offsetMinutes: 180 },
  { name: "המרה לתלמיד — ברוכים הבאים", triggerEvent: "STUDENT_WELCOME", templateName: "student_welcome", offsetMinutes: 0 },
  { name: "ליד חדש — מעקב", triggerEvent: "LEAD_WELCOME_FOLLOWUP", templateName: "lead_welcome_followup", offsetMinutes: 1440 },
  { name: "ליד ללא מענה — תזכורת 2", triggerEvent: "NO_RESPONSE_NUDGE_2", templateName: "no_response_nudge_2", offsetMinutes: 1440 },
  { name: "ליד ללא מענה — תזכורת 3", triggerEvent: "NO_RESPONSE_NUDGE_3", templateName: "no_response_nudge_3", offsetMinutes: 2880 }
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
    if (existing) {
      // Sync name/template/timing from code; preserve the operator's active toggle.
      await prisma.automationRule.update({
        where: { id: existing.id },
        data: { name: r.name, templateName: r.templateName, offsetMinutes: r.offsetMinutes }
      })
    } else {
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
