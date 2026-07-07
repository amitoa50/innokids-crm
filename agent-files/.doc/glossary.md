# Glossary

## Purpose
- Define canonical domain terms and approved short forms used across code, API routes, docs, and plans.

## Core Terms
- `lead`
	- Canonical meaning: parent/customer who left contact details, tracked through the sales pipeline.
	- Use: always singular in routes and service names (`/api/lead`, `lead.service.ts`).
- `student`
	- Canonical meaning: enrolled child, created when a lead converts.
	- Use: singular in routes and service names.
- `group`
	- Canonical meaning: class group for a specific program, age range, and schedule.
	- Use: singular in routes and service names.
- `trial-lesson`
	- Canonical meaning: trial/demo class scheduled for a lead before enrollment.
	- Use: hyphenated in routes (`/api/trial-lesson`), camelCase in code (`trialLesson`).
- `task`
	- Canonical meaning: internal follow-up or to-do item for staff.
	- Use: singular in routes and service names.
- `activity-log`
	- Canonical meaning: chronological record of actions on leads/students for timeline views.
	- Use: camelCase in code (`activityLog`), hyphenated in routes if needed.
- `lead-intake`
	- Canonical meaning: webhook-based system for receiving leads from external platforms.
	- Use: hyphenated in routes (`/api/lead-intake`), camelCase in code (`leadIntake`).
- `notification`
	- Canonical meaning: in-app alert sent to a user.
	- Use: singular in routes and service names.
- `user`
	- Canonical meaning: system account (Admin or Staff).
	- Use: singular in routes and service names.
- `conversation`
	- Canonical meaning: a channel-scoped thread of messages with a lead or student (WhatsApp, email, SMS, phone, manual).
	- Use: singular in routes and service names (`conversation.service.ts`); accessed via the lead (`/api/lead/:id/conversation`) in Phase-1 hardening.
- `message`
	- Canonical meaning: a single inbound or outbound communication inside a conversation, with direction and delivery status.
	- Use: singular in routes and code; logged via `communication.service.ts`.
- `external-ref`
	- Canonical meaning: mapping between an internal entity and its identifier in an external system (Meta, Instagram, website, WhatsApp, Google Calendar). Provides intake idempotency.
	- Use: camelCase in code (`externalRef`); internal service only, no public route.
- `consent` / `opt-in`
	- Canonical meaning: a lead's recorded permission to be contacted on a channel (e.g. `whatsappConsent`, `marketingConsent`).
	- Use: field-level on `lead`; never assume consent — only set from an explicit source.
- `pipeline-transition`
	- Canonical meaning: a permitted move between two lead pipeline statuses, enforced application-side via an allowed-transition map.
	- Use: camelCase in code (`pipeline.ts`, `canTransition`).
- `preferred-channel`
	- Canonical meaning: the channel a lead prefers for contact (WHATSAPP, PHONE, EMAIL).
	- Use: field-level on `lead` (`preferredChannel`).
- `whatsapp-provider`
	- Canonical meaning: a pluggable WhatsApp adapter (Meta Cloud API, mock, future BSPs) behind the `WhatsAppProvider` interface.
	- Use: code only (`services/whatsapp/`); selected via `WHATSAPP_PROVIDER` env.
- `service-window`
	- Canonical meaning: the 24h window opened by an inbound WhatsApp message during which free-form (session) messages are allowed; outside it, only approved templates.
	- Use: tracked on `lead.whatsappWindowExpiresAt`.
- `message-template`
	- Canonical meaning: a pre-approved WhatsApp template used for out-of-window and automated sends.
	- Use: singular route/service (`messageTemplate`).
- `automation-rule`
	- Canonical meaning: a trigger→template mapping (with timing offset) that enqueues automated messages on pipeline events.
	- Use: singular in code (`automationRule`).
- `scheduled-message`
	- Canonical meaning: an automation outbox row dispatched by cron when due; the queue between an automation rule and an actual send.
	- Use: singular in code (`scheduledMessage`).
- `automation-outbox`
	- Canonical meaning: the set of `PENDING` `scheduled-message` rows awaiting dispatch by the 5-minute automation cron tick.
	- Use: informal collective term for the `ScheduledMessage` queue; not a separate entity or route.

## Naming Alignment
- Keep this glossary aligned with naming decisions in `../.rule/naming-rules.md`.
- If a new domain term is introduced, add it here before broad usage.

## Update Rules
- Add new terms when introducing a new bounded context, entity, or shared API concept.
- Avoid synonyms for existing terms unless explicitly approved and documented here.
