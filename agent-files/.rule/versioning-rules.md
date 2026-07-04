# Versioning Rules

## Purpose
- Define branch, commit, merge, and release versioning expectations for this repository.

## Core Principles
- Execute implementation work from a dedicated branch, not from main.
- Keep changes small, reviewable, and scoped to a single intent.
- Never commit, merge, or publish release tags without explicit approval.

## Branch Rules
- Create a new branch before executing an approved plan.
- Keep one plan or workstream per branch.
- Keep branch names predictable and lowercase using this pattern:
	- `feat/<topic>` for new capabilities.
	- `fix/<topic>` for bug fixes.
	- `chore/<topic>` for maintenance.
	- `docs/<topic>` for documentation-only changes.
- Prefer singular domain terms in branch names when applicable.

## Commit Rules
- Do not commit until the user explicitly approves committing.
- Keep commit messages concise and action-oriented.
- Use imperative commit subjects, for example: `add org validation rule`.
- Avoid bundling unrelated changes in the same commit.

## Merge Rules
- Do not merge branches without explicit approval.
- Require at least one review pass before merge when collaboration is involved.
- Resolve comments and open questions before merge.

## Versioning Model
- Use Semantic Versioning for releases: `MAJOR.MINOR.PATCH`.
- Increment `MAJOR` for breaking changes.
- Increment `MINOR` for backward-compatible features.
- Increment `PATCH` for backward-compatible fixes.

## Pre-release and Build Metadata
- Use prerelease identifiers for non-final versions when needed:
	- `1.4.0-alpha.1`
	- `1.4.0-rc.1`
- Use build metadata only for build traceability, for example: `1.4.0+build.20260607`.

## Release Process Rules
- Create release tags only after approval.
- Ensure release notes summarize user-visible changes and any breaking behavior.
- Verify tests and critical validation steps pass before publishing a release.