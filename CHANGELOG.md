# Changelog

All notable changes to CodeProgress Frontend are documented in this file. The project follows Semantic Versioning.

## Unreleased

No additional unreleased changes are currently recorded.

## 1.0.0 — Prepared

The first public release is prepared, but its publication date has not been set.

### Added

- Account registration, Login, Logout, protected routes, and current-user verification.
- In-memory JWT lifecycle with authenticated HTTP 401 handling, request cancellation, user-scoped caches, and stale-response session guards.
- Dashboard summary and daily study activity for the latest 30 calendar days.
- Topic list, create, details, update, status change, and safe deletion flows.
- LearningTask list, create, details, update, status, planning, optional deadline, priority, and safe deletion flows.
- StudySession list, create, details, update, and safe deletion flows.
- Backend-managed task completion and status reconciliation after StudySession create, update, and delete operations.
- Responsive CSS Modules interface with desktop and narrow-viewport layouts.
- Accessible labels, keyboard navigation, dialog focus trapping, Escape handling, and focus restoration for tested critical flows.
- Typed fetch API client with runtime response validation and distinct HTTP, network, abort, and response-format errors.
- Vitest and React Testing Library coverage for Auth, Dashboard, Topics, LearningTasks, StudySessions, cache lifecycle, and error handling.
- Fully mocked Playwright Chromium coverage for desktop and mobile-sized viewports.
- Environment-neutral, fail-closed real-backend Playwright scenario with runtime isolation attestations and response-derived resource ownership for an explicitly authorized test environment.
- MIT License for the public CodeProgress Frontend source code.

### Security

- Access tokens remain only in memory and are not written to browser storage or cookies.
- Authorization headers are restricted to the configured API base URL.
- Logout and applicable HTTP 401 responses clear identity, active requests, and user-scoped cached data.
- Topic, LearningTask, and StudySession mutations reject stale responses after Logout or account replacement.

### Known limitations

- Reloading the page requires Login because CodeProgress API v1.0.0 does not provide a refresh-token flow.
- Production hosting, CI, and deployment configuration are not included in this prepared release.
