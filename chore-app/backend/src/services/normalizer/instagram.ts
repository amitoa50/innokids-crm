import type { NormalizedLead } from "./facebook"

export function normalize(payload: Record<string, unknown>): NormalizedLead {
  // Instagram lead forms are similar to Facebook Lead Ads
  const fieldData = payload.field_data as Array<{ name: string; values: string[] }> | undefined
  const externalId = (payload.leadgen_id || payload.id) as string | undefined

  if (fieldData) {
    const getField = (name: string) => {
      const field = fieldData.find(f => f.name === name)
      return field?.values?.[0]
    }

    return {
      fullName: getField("full_name") || getField("name") || "",
      phone: getField("phone_number") || getField("phone") || "",
      email: getField("email"),
      campaignName: payload.campaign_name as string || payload.form_name as string,
      externalId
    }
  }

  return {
    fullName: (payload.full_name || payload.name || "") as string,
    phone: (payload.phone_number || payload.phone || "") as string,
    email: payload.email as string | undefined,
    campaignName: (payload.campaign_name || payload.form_name) as string | undefined,
    externalId
  }
}
