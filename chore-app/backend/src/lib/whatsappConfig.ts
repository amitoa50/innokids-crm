export interface WhatsAppConfig {
  provider: string
  apiVersion: string
  phoneNumberId: string
  accessToken: string
  verifyToken: string
  appSecret: string
}

export function getWhatsAppConfig(): WhatsAppConfig {
  return {
    provider: process.env.WHATSAPP_PROVIDER || "cloud",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || ""
  }
}

export function isWhatsAppEnabled(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER
  return !!provider && provider !== "disabled"
}
