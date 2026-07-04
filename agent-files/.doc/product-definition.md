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
- No more lost leads — automatic dedup by phone number, webhook intake from ad platforms
- Clear sales pipeline with status tracking and follow-up reminders
- Trial lesson coordination linked to leads and groups
- Internal task management tied to CRM entities
- Activity timeline for full audit trail on every lead/student
- Hebrew RTL interface designed for the team's workflow

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
- Out of scope:
	- WhatsApp integration (Phase 2)
	- Automation engine / trigger-based flows (Phase 3)
	- Advanced analytics and reporting (Phase 4)
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
- Product metrics:
	- Daily active usage by staff
	- Leads processed via webhook (automation adoption)
	- Zero duplicate leads in system

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
