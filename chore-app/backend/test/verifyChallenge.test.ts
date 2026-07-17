import { describe, it, expect } from "vitest"
import { MockProvider } from "../src/services/whatsapp/mock.provider"
import type { WhatsAppConfig } from "../src/lib/whatsappConfig"

function configWith(verifyToken: string): WhatsAppConfig {
  return {
    provider: "mock",
    apiVersion: "v21.0",
    phoneNumberId: "",
    accessToken: "",
    verifyToken,
    appSecret: "test-app-secret"
  }
}

describe("verifyChallenge fail-closed", () => {
  it("denies the challenge when no verify token is configured", () => {
    const provider = new MockProvider(configWith(""))
    const echo = provider.verifyChallenge({ "hub.verify_token": "", "hub.challenge": "echo-me" })
    expect(echo).toBeNull()
  })

  it("still echoes when the token matches", () => {
    const provider = new MockProvider(configWith("innokids_verify"))
    const echo = provider.verifyChallenge({ "hub.verify_token": "innokids_verify", "hub.challenge": "echo-me" })
    expect(echo).toBe("echo-me")
  })
})
