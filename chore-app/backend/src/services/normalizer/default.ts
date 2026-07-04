import type { NormalizedLead } from "./facebook"

export function normalize(payload: Record<string, unknown>): NormalizedLead {
  return {
    fullName: (payload.fullName || payload.full_name || payload.name || "") as string,
    phone: (payload.phone || payload.phoneNumber || payload.phone_number || "") as string,
    email: (payload.email) as string | undefined,
    campaignName: (payload.campaignName || payload.campaign_name) as string | undefined,
    learningFormat: (payload.learningFormat || payload.learning_format) as string | undefined,
    branch: (payload.branch) as string | undefined
  }
}
