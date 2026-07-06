# Product Definition

## Purpose
- Define shared product intent so planning, architecture, and delivery stay aligned.

## Product Vision
Replace external paid tools (spreadsheets, WhatsApp groups, separate CRM services) with a single internal operating system that manages the full lifecycle from lead intake through student enrollment. The system should be the central hub for all business operations at INNOKIDS.

## Target Users
- Primary users:
	- **Admin** — business owner/manager with full system access. Manages leads, students, groups, staff, reports, and system settings.
	- **Staff** — operational team members who work leads, handle follow-ups, schedule trial lessons, and manage day-to-day student/group operations.
- Secondary users:
	- **Teacher** (future V2) — limited access to own groups, students, and trial lessons.

## Problem Statement
INNOKIDS is a coding school for kids and teens operating both online and in physical community centers. The business currently relies on fragmented tools for lead tracking, parent communication, trial lesson scheduling, and student management. Leads fall through cracks, follow-ups are missed, and there is no unified view of the sales pipeline or student lifecycle. The team needs a single system that captures leads from multiple sources (ads, website, manual entry), tracks them through a clear pipeline, and converts them into enrolled students.

## Value Proposition
- Unified lead-to-student lifecycle in one system
- No more lost leads — automatic dedup by phone number, webhook intake from ad platforms, external-ID idempotency
- Clear sales pipeline with enforced status transitions and follow-up reminders
- Parent communication tracked per lead (channel-agnostic conversation history) with consent/opt-in on record
- Trial lesson coordination linked to leads and groups
- Internal task management tied to CRM entities
- Activity timeline for full audit trail on every lead/student
- Hebrew RTL interface designed for the team's workflow

## Central Operating System Principle
The CRM is the single source of truth and the hub that all channels connect into. External systems attach as **adapters** on a stable core, never by reshaping the core:
- Inbound webhooks normalize external leads into the pipeline.
- A channel-agnostic communication spine (conversation + message) records all parent contact; each channel (WhatsApp first) is an adapter over it.
- An external-reference map links internal entities to external IDs for idempotency and two-way sync.
- Consent/opt-in gates outbound messaging.

## Product Scope
- In scope (Phase 1 — CRM Core):
	- Lead management with 8-stage pipeline (NEW through CLOSED)
	- Phone-based dedup with Israeli number normalization
	- Webhook lead intake with source-specific normalizers
	- Student enrollment via lead conversion
	- Group management with capacity tracking
	- Trial lesson scheduling linked to leads and groups
	- Internal task management with lead/student linking
	- Activity logging for all actions
	- Dashboard with pipeline and source analytics
	- Calendar view for trials, follow-ups, and group sessions
	- Team management (admin/staff roles)
	- In-app notifications with polling
	- Optional email notifications via Gmail SMTP
- In scope (Phase 1.5 — CRM Data-Model Hardening, plan 003):
	- Communication spine: conversation + message models with manual message logging
	- External-reference map for external-system IDs (intake idempotency)
	- Consent/opt-in fields on leads (WhatsApp, marketing, preferred channel)
	- Enforced pipeline transition rules (allowed-transition map)
	- Auto-stage logic for NO_RESPONSE and FOLLOW_UP_AFTER_TRIAL
	- Child fields on the lead for sales UX (carried to student on convert)
	- Group capacity enforcement on assignment and conversion
	- Calendar-readiness fields on groups and trial lessons
- Integration Roadmap (Phase 2+, adapters over the hardened core):
	- WhatsApp Business API — outbound send, inbound receive, delivery status, template messages (Phase 2)
	- Meta / Instagram lead ads — native webhook verification (hub.verify_token + X-Hub-Signature-256), leadgen_id idempotency
	- Website forms / landing pages — inbound submissions over the existing webhook layer
	- Calendar integration — two-way Google Calendar sync for trials, follow-ups, and group sessions via external-reference event IDs
	- Automation engine / trigger-based flows (later phase)
- Out of scope:
	- Advanced analytics and reporting (later phase)
	- Kanban board view for leads (deferred)
	- Teacher role and permissions (V2)
	- Multi-tenant / organization support
	- Payment / billing management
	- Curriculum / lesson content management (this is a CRM, not an LMS)

## Success Metrics
- Business metrics:
	- Lead response time (time from intake to first contact)
	- Pipeline conversion rate (NEW to CONVERTED)
	- Follow-up completion rate (no overdue follow-ups)
	- Consent coverage (share of active leads with a recorded contact opt-in)
- Product metrics:
	- Daily active usage by staff
	- Leads processed via webhook (automation adoption)
	- Zero duplicate leads in system (phone + external-ID idempotency)
	- Communication captured in-system (messages logged per lead)

## Constraints and Assumptions
- SQLite database — acceptable for small team, single-server deployment
- No test suite exists — manual validation only
- Hebrew RTL interface is mandatory
- Express v5 handles async errors natively
- React 18 (not 19) per project requirements
- All UI text in Hebrew

## Prioritization Rules
- Prioritize lead management and pipeline tracking — this is the core value
- Follow-up reminders and dedup are critical for preventing lost leads
- Trial lesson flow is second priority (key conversion step)
- Student/group management is operational support
- Reports and dashboard are visibility tools, not blockers

## Update Triggers
- Update this file when core user segments, product scope, or success metrics change.
