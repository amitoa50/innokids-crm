# Testing Rules

## Purpose
- Define consistent expectations for test coverage, test design, and release confidence.

## Scope
- Apply these rules to unit, integration, and end-to-end tests.

## Core Principles
- Test behavior, not implementation details.
- Keep tests deterministic and isolated.
- Prefer fast feedback: unit tests first, integration where needed, end-to-end for critical flows.
- Add tests for every bug fix when feasible.

## Required Coverage Areas
- Domain logic and state transitions.
- API request validation and error responses.
- Auth and org boundary enforcement.
- Persistence-critical paths and migration-sensitive queries.
- User-facing failure flows for key features.

## Test Structure Rules
- Arrange tests with clear setup, action, and assertion phases.
- Use descriptive test names that state expected behavior.
- Keep one primary assertion intent per test.
- Avoid shared mutable state between tests.

## Data and Fixtures
- Use minimal fixtures focused on the scenario.
- Prefer factories/builders over large static fixtures.
- Do not embed real secrets, keys, or credentials in test data.

## Reliability Rules
- No flaky tests in mainline branches.
- Mock only unstable external dependencies.
- Freeze/override time and randomness when behavior depends on them.
- Do not rely on test execution order.

## Pull Request Expectations
- New features include happy-path and failure-path tests.
- Bug fixes include a regression test that fails before and passes after the fix.
- Update or remove obsolete tests when behavior changes intentionally.
