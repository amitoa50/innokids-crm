# Meta WhatsApp Cloud API — Setup Progress

Meta App: **Innokids-Bot** (developers.facebook.com/apps)
WhatsApp Business Account: **Test WhatsApp Business Account**

## Resume here next session

**2026-07-09 — live Meta test-number validation PAUSED. Now running in MOCK mode for the rest of dev.** The real Meta connection is proven (permanent token, successful sends with valid message IDs, 12 templates submitted). But Meta's throwaway test numbers created endless confusion (two US test WABAs, per-number recipient allow-lists, accepted-but-dropped sends), so we stopped chasing them. `WHATSAPP_PROVIDER=mock`, `AUTOMATION_ENABLED=true`, all 12 DB templates `APPROVED` — the full pipeline now runs end-to-end locally with no Meta calls.

**Resume the real cutover only when a production phone number is purchased:** register it to a fresh/real WABA, resubmit + approve the 12 templates there, flip `.env` to `WHATSAPP_PROVIDER=cloud` + `AUTOMATION_ENABLED=false`, then run plan 010 Phases D→F (webhook → staged automation → deploy). The cloud credentials below stay in `.env`, preserved for that day.

_(Earlier 2026-07-09 note, now superseded by the mock switch: templates had been reset to DRAFT then submitted to Meta as PENDING; that WABA is now set aside.)_

## Values collected so far

**Active setup (2026-07-09): the TEST account below.** A second WABA (`1430169641733295`, Phone Number ID `1055754777626659`, US test number **+1 555-173-2420**, verified name "Test Number") was used in the FIRST setup session and is now retired — ignore it; don't create templates or webhooks on it. (Earlier notes mislabeled it "the Israeli-number account" — that was wrong; both are US Meta test numbers. No Israeli number was ever registered as a sender; `+972-53-700-5288` is only the owner's recipient phone.) The owner's phone was verified as a recipient on this OLD number, which is why first-session messages arrived from +1 555-173-2420.

| Variable | Value | Where it came from |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | `727670483768019` | Test setup — WhatsApp Manager → Phone numbers → Test Number |
| WhatsApp Business Account ID (WABA) | `778267717924725` | Test setup. Not currently read by app code — needed for creating templates in WhatsApp Manager (make sure the Manager is scoped to THIS WABA). |
| Test number | `+1 (555) 820-3617` | Meta free test number on the WABA above |
| `WHATSAPP_ACCESS_TOKEN` | permanent, set in `chore-app/backend/.env` | System User `Innokidscrmapi` (Business Settings → System Users) → Generate New Token, expiration: Never. ⚠️ Originally verified against the OTHER (unintended) number — re-verified against the active test number on 2026-07-09 (see Status). |
| `WHATSAPP_VERIFY_TOKEN` | `innokids_verify_2026` | chosen arbitrarily — must match the value entered later in Meta's Webhook config screen |
| `WHATSAPP_APP_SECRET` | set in `.env` | App settings → Basic → App Secret ("Show") |

All actual secret values live only in `chore-app/backend/.env` (gitignored). This file tracks *what* was done and *where things came from*, not the secret values themselves.

## Status

- [x] Test WhatsApp Business Account created
- [x] Test Number obtained (Phone Number ID above)
- [x] Temporary access token generated and set in `.env` (`WHATSAPP_PROVIDER=cloud`)
- [x] App Secret set in `.env`
- [x] Send a test message end-to-end to confirm the token works (verified 2026-07-09 — but against the OTHER, now-unused number)
- [x] Token access re-verified against the ACTIVE test setup (2026-07-09, read-only Graph calls): phone number `727670483768019` readable (returns `+1 555-820-3617`, verified name INNOKIDS), and `message_templates` on WABA `778267717924725` listable (empty — clean slate, `whatsapp_business_management` confirmed)
- [ ] Re-verify the owner's phone (`+972-53-700-5288`) as an allowed recipient on the ACTIVE test number (App → WhatsApp → API Setup → "To" field → add + OTP; the old verification was on the other number)
- [ ] Send one real test message from the ACTIVE number to the owner's phone (after recipient re-verification)
- [x] All 12 templates submitted to the active WABA via Graph API (2026-07-09, owner-approved deviation from the manual plan) — all accepted as `PENDING`. `trial_reminder_1h` was redesigned first: the Zoom link is now variable `{{3}}`, filled at send time from the trial lesson's `meetingUrl` (editable per lesson in the CRM, no Meta re-approval to change it). ⚠️ Meta reclassified `trial_reminder_1h` UTILITY → **MARKETING** — this puts the 1h reminder behind the marketing-consent gate; appeal the category in WhatsApp Manager or accept the gate.
- [ ] Watch WhatsApp Manager for approval verdicts (minutes–48h), then sync each outcome into the CRM via the Automation page status controls (`APPROVED` only on exact-wording match; CRM rows already set to `PENDING`)
- [ ] Configure Webhook URL + verify token in Meta (App → WhatsApp → Configuration) — needs a public URL (cloudflared tunnel) to `localhost:4000`, path `/api/whatsapp/webhook`, subscribe to `messages`
- [x] Swap temporary access token for a permanent System User token before production (System User `Innokidscrmapi`, Admin role, assets: Innokids-Bot app + Test WhatsApp Business Account, both Full control; token permissions: `whatsapp_business_messaging`, `whatsapp_business_management`, `whatsapp_business_manage_events`, `manage_app_solution`; expiration: Never)
- [ ] Decide on a dedicated production phone number (personal number gets disconnected from the WhatsApp app once registered)

## Notes

- Now using a permanent System User token (no expiration) — no more 24h regeneration needed.
- If this token is ever suspected compromised, regenerate it from Business Settings → System Users → Innokidscrmapi (old token is invalidated immediately).
- Personal WhatsApp number is NOT registered to the API — currently using Meta's free Test Number, which can only message up to 5 manually-added recipient numbers.
- Verified test recipient number so far: `+972-53-700-5288` (owner's personal number) — **verified on the old, unused number only**; must be re-added on the active test number (allowed-recipient lists are per phone number).
