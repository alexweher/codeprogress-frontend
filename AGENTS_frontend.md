# AGENTS.md — CodeProgress Frontend

> Repository scope: **frontend only**. This file is the operating contract for Codex working inside the CodeProgress frontend repository. Read this file before starting any task and re-check it when requirements change.

## 1. Mission and project boundaries

Build a responsive, accessible web interface for the existing **CodeProgress API v1.0.0**. The interface helps a signed-in user organize programming-study topics, learning tasks, study sessions, and personal learning progress.

- **Frontend:** a new, independent project/repository and separate Codex workspace.
- **Backend:** existing Java/Spring Boot REST API, published at https://github.com/alexweher/code-progress-api , release tag `v1.0.0`.
- **Backend release:** https://github.com/alexweher/code-progress-api/releases/tag/v1.0.0 .
- **Reference backend commit:** `d90f5b85cf929c82b5292c5264f4ae2e7161bddf`.
- **Never change, commit, push, or migrate the backend repository from frontend tasks.** Do not treat a separate Codex chat as automatically having access to backend local files.
- The frontend must integrate with actual backend endpoints. Do not invent routes, DTO fields, enumerations, auth flows, or business rules.

## 2. Source of truth and discovery

Before implementing API-dependent functionality:
1. Inspect the pinned backend `v1.0.0` sources/readme/OpenAPI if accessible, with priority: actual controller + request/response DTO + security configuration + validation + OpenAPI > documentation > assumptions.
2. Look at repository files via read-only access (or ask for backend OpenAPI JSON / relevant controller and DTO files if access is unavailable). Never claim to have inspected files you did not inspect.
3. Create/update `docs/api-contract.md`: method, exact path, auth requirement, request fields, response fields, statuses/errors, pagination and sorting conventions, source reference.
4. Clearly label **verified**, **assumed**, and **unknown** details. Resolve unknown contract details before writing a real integration; if blocked, implement a clearly marked UI placeholder, not a fabricated working backend call.
5. Do not silently extend API contracts. Any backend change must be proposed separately for explicit approval and performed in the backend's own workflow.
6. A released backend tag is immutable. Do not retag or alter backend `v1.0.0`.

## 3. Technology baseline

Use the following as the initial default, not permission to install arbitrary packages:
- React + TypeScript (strict mode) + Vite.
- React Router for client routing.
- TanStack Query for server state / caching / mutations.
- A single typed API client built on `fetch` (or a justified alternative); centralized error mapping and authorization handling.
- CSS via a consistent approach chosen and documented at project bootstrap (e.g., CSS Modules and design tokens). Do not add a UI framework or styling library without proposing it first.
- ESLint, Prettier, Vitest + React Testing Library; add Playwright for critical user journeys when justified.
- npm with a committed lockfile unless user approves a different package manager.
- Choose supported, mutually compatible versions after checking the installed Node.js version and official documentation. Prefer a current supported Node LTS. Record actual versions in README; do not guess.

Do not add Next.js, Redux, a second HTTP layer, component-library dependencies, state-management frameworks, or other major infrastructure without an explanation and explicit approval.

## 4. Functional product scope

Build the interface incrementally, matching verified backend support:

1. **Authentication:** registration, sign-in, sign-out, current-user view; protected routes; clear session-expiry handling.
2. **Dashboard:** overview of learning progress and daily activity from real analytics endpoints.
3. **Topics:** list, create, view details, edit, delete; status display/filtering if supported by the API.
4. **Learning tasks:** list and forms; statuses, difficulty, priority, optional deadline; today/upcoming/overdue and filtering as supported.
5. **Study sessions:** list, create, edit, delete; associate sessions with actual entities as the API permits; respect backend reconciliation rules.
6. **UX:** loading, empty, error, validation, confirmation and success states; pagination; responsive desktop/tablet/mobile layouts.

**Out of scope by default:** AI tutor, chatbot, social features, payments, notifications, refresh-token server flows, password reset, email verification, admin roles, native mobile app, production deployment. Do not claim unsupported functionality exists.

## 5. Architecture and code quality

Recommended initial structure (adjust after reviewing the actual template):

```text
src/
  app/                 # app setup, routing, providers
  pages/               # route-level screens
  features/            # auth, dashboard, topics, tasks, sessions
  entities/            # shared domain types (only verified API fields)
  shared/
    api/               # typed client, auth/error handling
    ui/                # reusable accessible UI primitives
    lib/               # utilities
    styles/            # tokens/global styles
  test/                # shared test utilities
public/
docs/
```

Rules:
- Use functional React components and hooks; TypeScript `strict`; avoid `any` unless unavoidable with documented reason.
- Keep networking out of presentational components; keep server data in TanStack Query, local UI state in React.
- Prefer small, cohesive components and feature-specific modules over giant pages, duplicated API calls, or premature abstraction.
- Validate forms and display backend validation errors; never depend on client validation as a security boundary.
- Use stable query keys, invalidate/refetch after mutations, and prevent stale user data after sign-out or account switch.
- Add accessible labels, keyboard interactions, focus states, semantic HTML, and readable contrast. Support narrow screens and meaningful empty/loading/error states.
- Avoid gratuitous animation, unnecessary library additions and UI redesign outside the requested feature.

## 6. Authentication and security

- The backend owns authentication, authorization, user identity and data ownership. The frontend must not invent or supply an owner ID to bypass API rules.
- Verify exact login/registration endpoint and JWT response shape before implementing.
- Send access tokens as `Authorization: Bearer <token>` only to the configured trusted API origin.
- Treat tokens as secrets: never log them or expose them in screenshots, issue reports, query strings, URLs, analytics, or Git.
- Prefer **in-memory token storage** for the initial implementation unless the user explicitly accepts a documented persistence/security tradeoff. A full reload may require signing in again; do not promise seamless persistent login without a supported secure design.
- Do not put tokens in localStorage/sessionStorage by default. Do not fabricate refresh tokens, cookies, or server endpoints.
- On logout or confirmed authentication failure, clear token, identity and all cached user-specific queries. Distinguish network failures from actual 401 responses.
- Never expose `JWT_SECRET`, database passwords, or server-only configuration in `VITE_*` variables or the client bundle.
- Do not disable browser security or recommend permissive CORS as a workaround. Diagnose CORS accurately and propose backend changes for separate authorization.
- Follow OWASP principles; do not render unsanitized HTML. Avoid `dangerouslySetInnerHTML` unless separately justified.

## 7. API configuration and environment

- Use one documented browser-facing API base URL, e.g. `VITE_API_BASE_URL`, with a local `.env.example` containing only placeholder/public values. Verify its actual value and whether endpoints include `/api` before wiring requests.
- `VITE_*` is public browser configuration, never a place for secrets.
- Account for browser CORS and any Vite dev proxy by documenting exactly which URL the browser calls and which backend it reaches. Do not assume Docker service names are reachable from a browser.
- Use ISO dates/times according to real API types; do not assume a timezone or convert a date-only deadline into a timestamp.
- Encode query parameters safely. Derive pagination/sorting/status values from verified backend contracts, not hardcoded guesses.
- Do not use mocked API data in production flows. Test fixtures must be isolated from real UI behavior and labeled clearly.

## 8. Workflow: how Codex must work

For **each** user task:
1. Restate the requested outcome and what is in/out of scope.
2. Inspect existing project files, `AGENTS.md`, relevant docs and git status before changes.
3. If the task touches the API, check `docs/api-contract.md` against pinned backend `v1.0.0` evidence.
4. Propose a short plan and name the files to change. For significant decisions or additional dependencies, ask approval first.
5. Implement the **smallest complete vertical slice**; do not refactor unrelated files.
6. Run available checks and report their real outcomes (lint, typecheck, tests, build, and relevant manual UI checks). Never say checks passed if not executed.
7. Review `git diff` and `git diff --check`, scan for secrets and accidental generated files.
8. Summarize what changed, what was tested, what remains unverified, and the exact next step in **Russian**. Explain important React/TypeScript concepts simply, because the project owner is learning frontend development.
9. If blocked, report exact error/command, likely cause and safest next action; do not pretend completion.

Prefer one feature or milestone at a time. Do not create an entire application in one unreviewed step. Provide a succinct Russian completion report for each task; persistent files go into `docs/` only when useful and requested.

## 9. Git / approval / destructive-action policy

- **No** commit, push, remote branch creation, PR creation, merge, tag, release, deploy, repository deletion or secret mutation without separate explicit authorization for that action.
- For allowed commits, use clear conventional messages (e.g., `feat(auth): add login form`), stage only intended paths; no `git add .` by default.
- Never force-push, rewrite public history, remove branches/tags, or change repository settings without explicit specific authorization.
- No deletion/overwriting of user files, `.env`, local databases, reports, or untracked files without explicit approval.
- Do not execute destructive shell commands or modify backend DB/Docker volumes. If an operation is not reversible, explain the impact before asking permission.
- Never commit `.env`, credentials, build artifacts (`dist/`, `node_modules/`), coverage or private data.
- Keep frontend and backend git repositories, environments and release histories independent.

## 10. Quality gates and definition of done

A feature is complete only when:
- It matches a verified backend contract or is explicitly marked UI-only.
- It has usable responsive layout, clear loading/error/empty states and accessible basic interaction.
- It handles authentication and user-scoped cache safely where applicable.
- Relevant tests exist and pass; TypeScript check, lint and production build succeed when configured.
- No secrets, debug-only bypasses, mock data or unrelated changes are included.
- Documentation is updated for significant setup/config/contract changes.
- Actual run commands and results are reported. If tests cannot run, mark **NOT VERIFIED** and explain why.

## 11. Project starting sequence

**First task in this new frontend workspace** (do not skip straight to product screens):
1. Inspect directory, `git status`, Node/npm installations, and any existing frontend files; avoid overwriting user content.
2. Check backend repository at pinned tag `v1.0.0` in read-only mode, focusing on OpenAPI/controllers/DTOs/auth config. If unavailable, ask for the OpenAPI specification or a safe local copy.
3. Propose the minimal frontend setup and exact dependencies; confirm with the user before introducing major choices.
4. Scaffold React + TypeScript + Vite after approval; set up routing, query client, styling baseline, lint/typecheck/tests and `.env.example`.
5. Create `README.md` and `docs/api-contract.md` using **verified**, explicitly sourced details.
6. Run install/build/lint/tests; report actual results.
7. First functional vertical slice after bootstrap: login + protected shell, *only after verifying authentication contract*.

## 12. Communication preferences

- Talk to the project owner in **Russian**, including explanations and final reports.
- Keep source code names, variables, commit messages, API routes and technical identifiers in English.
- When useful, explain **what**, **why**, and **how to verify** with short concrete steps.
- Do not make unsupported claims about the existing backend, about actions executed or about production readiness.
- Prioritize correctness, security, maintainability and a usable interface over speed or unnecessary complexity.

---

**Scope reminder:** This AGENTS.md governs only the new CodeProgress frontend repository. It does not override the backend project's own AGENTS.md or authorize modifications to the released backend.
