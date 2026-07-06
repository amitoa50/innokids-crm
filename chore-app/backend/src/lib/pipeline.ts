// Lead pipeline transition rules and auto-stage timing constants.
// Valid statuses: NEW, CONTACTED, NO_RESPONSE, TRIAL_SCHEDULED,
// TRIAL_COMPLETED, FOLLOW_UP_AFTER_TRIAL, CONVERTED, CLOSED

export const allowedTransitions: Record<string, string[]> = {
  NEW: ["CONTACTED", "NO_RESPONSE", "TRIAL_SCHEDULED", "CLOSED"],
  CONTACTED: ["NO_RESPONSE", "TRIAL_SCHEDULED", "CLOSED"],
  NO_RESPONSE: ["CONTACTED", "TRIAL_SCHEDULED", "CLOSED"],
  TRIAL_SCHEDULED: ["TRIAL_COMPLETED", "NO_RESPONSE", "CLOSED"],
  TRIAL_COMPLETED: ["FOLLOW_UP_AFTER_TRIAL", "CONVERTED", "CLOSED"],
  FOLLOW_UP_AFTER_TRIAL: ["CONVERTED", "NO_RESPONSE", "CLOSED"],
  CONVERTED: ["CLOSED"],
  CLOSED: ["NEW"]
}

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true
  const targets = allowedTransitions[from]
  return targets ? targets.includes(to) : false
}

// Days after a completed trial before the lead is auto-advanced to FOLLOW_UP_AFTER_TRIAL
export const FOLLOW_UP_AFTER_TRIAL_DELAY_DAYS = 2

// Days a NEW/CONTACTED lead can sit past its follow-up date before aging to NO_RESPONSE
export const NO_RESPONSE_AGING_DAYS = 3
