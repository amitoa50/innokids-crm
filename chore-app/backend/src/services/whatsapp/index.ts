import { getWhatsAppConfig } from "../../lib/whatsappConfig"
import type { WhatsAppProvider } from "./provider"
import { CloudApiProvider } from "./cloudApi.provider"
import { MockProvider } from "./mock.provider"

// Factory: returns the configured provider. Switching vendors is a config change,
// not a code change anywhere else in the CRM.
export function getProvider(): WhatsAppProvider {
  const config = getWhatsAppConfig()
  switch (config.provider) {
    case "mock":
      return new MockProvider(config)
    case "cloud":
      return new CloudApiProvider(config)
    case "twilio":
    case "360dialog":
      throw new Error(`WhatsApp provider "${config.provider}" is not implemented yet`)
    default:
      return new CloudApiProvider(config)
  }
}

export type { WhatsAppProvider } from "./provider"
