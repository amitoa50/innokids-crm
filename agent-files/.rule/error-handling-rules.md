# Error Handling Rules

## Purpose
- Define consistent patterns for detecting, classifying, logging, and returning errors across the system.

## Core Principles
- Fail fast on invalid input.
- Return safe, actionable messages to clients.
- Keep internal details in logs, not in external error responses.
- Use consistent error shapes and status codes.

## Error Categories
- Validation errors
	- Input is missing, malformed, or out of allowed range.
- Domain errors
	- Business rule violations (for example, invalid state transitions).
- Infrastructure errors
	- Network, database, queue, or third-party service failures.
- Authorization and authentication errors
	- Missing credentials, invalid token, insufficient org/resource access.

## API Response Rules
- Use a stable JSON error shape for all non-2xx responses.
- Recommended response shape:
	- `error.code`: machine-readable code.
	- `error.message`: human-readable summary.
	- `error.details`: optional structured context for validation issues.
	- `requestId`: correlation identifier for support/debugging.
- Never include secrets, stack traces, SQL text, or raw provider payloads in API responses.

## HTTP Status Guidance
- `400` for malformed input.
- `401` for unauthenticated requests.
- `403` for authenticated but unauthorized requests.
- `404` for missing resources.
- `409` for state conflicts.
- `422` for semantic validation failures.
- `429` for throttling/rate limiting.
- `500` for unexpected internal errors.
- `502` or `503` when upstream dependencies are unavailable.

## Logging Rules
- Log every unexpected error with enough context to debug.
- Include `requestId`, `org`, operation name, and relevant identifiers.
- Redact sensitive fields (tokens, passwords, credentials, secrets).
- Use structured logs whenever possible.

## Retry and Recovery
- Retry only transient infrastructure errors.
- Use bounded retries with backoff; avoid unbounded loops.
- Do not retry validation or domain errors.
- Ensure retry operations are idempotent when possible.

## Frontend and UX Rules
- Show user-safe, clear messages.
- Avoid generic "Something went wrong" when a specific action is known.
- Provide recovery hints when possible (retry, refresh, re-authenticate).
- For toasts, follow `sonner` usage from UI rules.

## Testing Requirements
- Add tests for expected failure modes in critical flows.
- Cover validation errors, authorization failures, and dependency failures.
- Verify response shape consistency for error endpoints.