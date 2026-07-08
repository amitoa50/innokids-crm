# Plan 011: Meta Lead Ads → CRM via Make (no-code bridge)

Status: draft
Owner: Amit Ohana
Last updated: 2026-07-08

Connects Facebook/Instagram Lead Ads campaigns to the CRM's existing lead-intake webhook using a Make (formerly Integromat) scenario. **Zero CRM code changes** — `POST /api/lead-intake/webhook/facebook` (plans 002/003) already handles API-key auth, Meta field shapes, phone dedup, and `leadgen_id` idempotency. A direct Meta integration (no bridge, needs Meta App Review for `leads_retrieval`) remains a future plan; Make gets leads flowing now and is trivially removable later.

---

## Goal

Every lead submitted through an INNOKIDS Facebook/Instagram lead form appears in the CRM automatically within seconds — deduplicated, source-tagged, campaign-tagged — with no manual export/import and no code.

## Scope

**In scope:**
- A Make scenario: **Facebook Lead Ads "New Lead" (instant trigger)** → **HTTP request** to the CRM webhook, mapping `full_name`, `phone_number`, `email`, `campaign_name`, `leadgen_id`.
- Operator setup guide (Hebrew, step-by-step, no prior Make experience assumed).
- End-to-end validation using Meta's Lead Ads Testing Tool + the CRM intake log (`GET /api/lead-intake/log`, Admin).
- `WEBHOOK_API_KEY` set to a strong value in the production env.

**Out of scope:**
- Direct Meta leadgen webhook integration (future plan; requires App Review).
- Comment-to-message automation (separate future plan).
- CRM code changes of any kind (none are needed).
- Website-form intake (the `/website` webhook exists; wiring a site form is a separate small task).

## Assumptions

- The CRM webhook accepts flat JSON (`full_name`, `phone_number`, `email`, `campaign_name`, `leadgen_id`) via the facebook normalizer's flat fallback, authenticated by the `x-api-key` header against `WEBHOOK_API_KEY`.
- Duplicate protection is two-layer and already live: `leadgen_id` → `ExternalRef` (replays return the same lead), then normalized-phone dedup in `lead.service`.
- New leads created via intake enqueue the WhatsApp welcome automation (plan 005/008) once that's live — no extra wiring.
- **Dependency:** Make needs a stable public HTTPS URL for the CRM → this plan executes after plan 010 Phase F (Railway deploy). Early validation is possible against a tunnel URL, but the scenario should be pointed at the production URL once, not maintained against a changing tunnel.
- Instagram lead forms belong to the Facebook Page, so one Make trigger covers both platforms; leads arrive tagged `source=FACEBOOK` with the form/campaign name distinguishing them.
- Make free tier (1,000 operations/month) covers ~500 leads/month (2 ops per lead); paid Core (~$9/mo) if volume exceeds that.

## Open Questions

1. **Instagram source labeling.** All Meta-form leads arrive as `FACEBOOK`. Split Instagram campaigns to the `/instagram` webhook via a second scenario (or a Make router filtering on form name) so reports distinguish the platforms?
   - **(rec)** Start unified (simplest); add the router split later only if source-level reporting matters. Campaign name already distinguishes them in the lead record.

## Steps

### Step 1: Prerequisites (owner)
- CRM deployed with a public URL (plan 010 Phase F) — or a temporary tunnel for early testing.
- `WEBHOOK_API_KEY` set to a long random value in the production `.env`; keep it secret like a password.
- Facebook access: the Meta Business account must own the Page + lead forms; the user connecting Make must be a Page admin.

### Step 2: Make scenario (owner, guided — Hebrew walkthrough delivered with this plan)
1. Create a Make account (free tier).
2. New scenario → first module **Facebook Lead Ads → Watch Leads** (instant/webhook trigger); connect the Facebook account; select the INNOKIDS Page and **All forms** (so future campaigns are included automatically).
3. Second module **HTTP → Make a request**: `POST https://<crm-domain>/api/lead-intake/webhook/facebook`, header `x-api-key: <WEBHOOK_API_KEY>`, JSON body mapping Make's lead fields → `full_name`, `phone_number`, `email`, `campaign_name` (map the form name), `leadgen_id` (map the lead ID).
4. Turn the scenario **ON**, scheduling "Immediately" (webhook-triggered).

### Step 3: Validation
1. Meta **Lead Ads Testing Tool** (developers.facebook.com/tools/lead-ads-testing): submit a test lead for the Page + form.
2. Make: scenario run shows green for both modules; HTTP response is `201` with `{ status: "SUCCESS", leadId }`.
3. CRM: the lead appears in the leads table (`source` FACEBOOK, campaign name filled); the intake log shows the raw payload with status `SUCCESS`.
4. Submit the same test lead again → HTTP `200 DUPLICATE_EXTERNAL`, no duplicate lead in the CRM.
5. Submit a test lead with the same phone but a new `leadgen_id` → phone dedup path (`DUPLICATE_MERGED`/reopen), still one lead.
6. Delete test leads afterward.

## Validation

Covered by Step 3 — all six checks pass, including both dedup layers, before any real campaign is pointed at the scenario.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Make scenario silently off / errored | Leads stop flowing without notice | Make email alerts on scenario errors (Settings → Notifications); weekly glance at the CRM intake log; leads are also always in Meta's Leads Center as backup |
| API key leaked (it sits in the Make module) | Junk leads could be injected | Key is long/random, rotatable in one place (`.env` + Make module); intake log audits every hit |
| Field mapping wrong (e.g. phone empty) | Intake rejected with `VALIDATION_ERROR` | Webhook logs FAILED rows with the raw payload — visible in the intake log; testing-tool validation before go-live |
| Meta lead-form field names vary between forms | Some forms map incorrectly | Normalizer accepts both `full_name`/`name` and `phone_number`/`phone`; keep form fields standard; test each new form once |
| Free-tier operation cap exceeded | Leads delayed until month reset | ~500 leads/month headroom; upgrade to Core (~$9/mo) if campaigns scale past that |

## Rollout Order

1. Step 1 — prerequisites (after plan 010 Phase F deploy)
2. Step 2 — Make scenario setup (owner, with the Hebrew walkthrough)
3. Step 3 — testing-tool validation, both dedup layers
4. **Checkpoint — first real campaign pointed at a validated scenario**

## Rollback

- Turn the Make scenario OFF — lead flow stops instantly; the CRM is untouched (no code shipped in this plan).
- Rotate `WEBHOOK_API_KEY` to revoke a compromised bridge.
- Leads always remain available in Meta's Leads Center for manual recovery of any gap window.

## Execution Log

_(added when executed — depends on plan 010 Phase F)_
