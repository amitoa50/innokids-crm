import nodemailer from "nodemailer"

let transporter: nodemailer.Transporter | null = null

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  })
  console.log("Email service enabled")
} else {
  console.log("Email service disabled: GMAIL_USER and GMAIL_APP_PASSWORD not set")
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    return
  }
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      html
    })
  } catch (err) {
    console.error("Failed to send email:", err)
  }
}

export async function sendChoreAssignedEmail(userEmail: string, choreName: string): Promise<void> {
  await sendEmail(
    userEmail,
    `New Chore Assigned: ${choreName}`,
    `<h2>New Chore Assigned</h2><p>You have been assigned a new chore: <strong>${choreName}</strong></p>`
  )
}

export async function sendChoreCompletedEmail(userEmail: string, choreName: string): Promise<void> {
  await sendEmail(
    userEmail,
    `Chore Completed: ${choreName}`,
    `<h2>Chore Completed</h2><p>The chore <strong>${choreName}</strong> has been marked as completed.</p>`
  )
}
