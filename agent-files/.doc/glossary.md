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

## Naming Alignment
- Keep this glossary aligned with naming decisions in `../.rule/naming-rules.md`.
- If a new domain term is introduced, add it here before broad usage.

## Update Rules
- Add new terms when introducing a new bounded context, entity, or shared API concept.
- Avoid synonyms for existing terms unless explicitly approved and documented here.
