# CodeProgress Frontend

CodeProgress is a responsive web application for organizing programming study. It lets each signed-in user manage learning topics, tasks, and study sessions while tracking progress through a dashboard.

This repository contains the frontend for [CodeProgress API v1.0.0](https://github.com/alexweher/code-progress-api). The verified backend reference commit is `d90f5b85cf929c82b5292c5264f4ae2e7161bddf`.

## Technology stack

- React 19 and TypeScript with strict type checking
- Vite
- React Router
- TanStack Query
- CSS Modules and shared design tokens
- Vitest and React Testing Library
- Playwright

## Features

### Authentication

- Account registration
- Email and password sign-in
- JWT verification through `GET /api/users/me`
- Protected and public-only routes
- Safe logout, request cancellation, and user-scoped cache clearing
- Global handling for authenticated HTTP 401 responses

The access token is stored only in JavaScript memory. It is never persisted to `localStorage`, `sessionStorage`, or cookies. Reloading the page clears the session and requires the user to sign in again. CodeProgress API v1.0.0 does not provide a refresh-token flow.

### Dashboard

- Progress summary metrics
- Daily study activity for the last 30 calendar days
- Empty, loading, retry, and malformed-response states
- Automatic refresh after relevant mutations

### Topics

- List, create, view, update, and delete topics
- Change topic status
- Owner-scoped data and user-scoped query caches
- Safe handling for ambiguous delete outcomes

### LearningTasks

- List and create tasks inside a topic
- View and update task details
- Change status, difficulty, priority, and optional deadline
- Delete tasks when allowed by the backend
- Clear deadline with an explicit `null` request

### StudySessions

- List and record study sessions inside a topic
- View, update, and delete sessions
- Associate completed tasks with a session
- Reflect backend-managed task completion and status reconciliation
- Refresh Dashboard activity and affected task data

## Application routes

| Route                      | Access           | Purpose                                                                       |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `/`                        | Public           | Redirects to `/app`, which then applies the authentication guard.             |
| `/login`                   | Signed-out users | Sign in to an existing account. Authenticated users are redirected to `/app`. |
| `/register`                | Signed-out users | Create an account, then return to Login without automatic authentication.     |
| `/app`                     | Protected        | Authenticated workspace overview.                                             |
| `/app/dashboard`           | Protected        | Progress summary and 30-day daily activity.                                   |
| `/app/topics`              | Protected        | Topic list and topic creation.                                                |
| `/app/topics/:topicId`     | Protected        | Topic details, status, edit/delete actions, LearningTasks, and StudySessions. |
| `/app/tasks/:taskId`       | Protected        | LearningTask details, editing, planning, status, and deletion.                |
| `/app/sessions/:sessionId` | Protected        | StudySession details, editing, and deletion.                                  |
| Any unknown route          | Public           | Redirects through `/` to the appropriate authenticated or Login destination.  |

## Requirements

- Node.js `24.x` LTS. The current setup was verified with Node.js `24.13.1`.
- npm `11.x`. The current setup was verified with npm `11.8.0`.
- CodeProgress API v1.0.0 for live API flows.

## Installation

Install the exact dependency tree from `package-lock.json`:

```bash
npm ci
```

Do not place passwords, JWTs, database credentials, or server secrets in frontend environment files.

## Local development

Start the Vite development server:

```bash
npm run dev
```

The frontend is available at `http://localhost:5173` by default.

### API configuration

The public browser-facing API base URL is configured at build/start time:

```text
VITE_API_BASE_URL=/api
```

Copy `.env.example` to `.env.local` only when a local override is required. Every `VITE_*` value is public and becomes part of the browser bundle; it must never contain a secret.

With the default `/api` value, the browser sends same-origin requests such as `/api/auth/login`. During local development, Vite proxies `/api` to `http://localhost:8080`, where CodeProgress API v1.0.0 is expected to be running.

The Vite proxy exists only in the development server. It is not included in the production bundle.

An absolute `VITE_API_BASE_URL` may be used for a separately hosted API, but the backend must then allow the exact frontend origin through its trusted CORS configuration. The frontend API client refuses request paths that escape the configured API origin or path prefix.

## Quality commands

```bash
npm run typecheck
npm run lint
npm test
npm run format:check
npm run format
npm run build
```

- `npm run format:check` verifies formatting without modifying files.
- `npm run format` applies Prettier formatting.
- `npm run build` performs TypeScript checking and creates the production bundle in `dist/`.

## Browser tests

Install the project-managed Playwright Chromium browser once:

```bash
npx playwright install chromium
```

Run the fully mocked browser suite:

```bash
npm run test:e2e
```

`npm run test:e2e:mocked` is an equivalent explicit command. The mocked suite starts an isolated local Vite process and does not require Docker, PostgreSQL, a live backend, or real user credentials.

The real-backend suite is intentionally guarded. `npm run test:e2e:real` must not be run as a normal local or CI command. It requires:

- a separately authorized and isolated PostgreSQL database;
- the pinned backend version;
- a freshly verified SQL baseline;
- temporary synthetic credentials;
- explicit opt-in values and permission for every allowed mutation;
- a cleanup and resource shutdown plan.

Its fail-closed runtime configuration requires a current isolated database identifier, an externally verified SQL baseline, explicit registration/mutation acknowledgements, and the loopback frontend URL. The suite captures created IDs from HTTP responses and permits UI mutations only for resources registered during that process. It has no retry, direct API fallback, or SQL cleanup. Never reuse historical real-E2E opt-in values or assume that an old baseline is still valid. See [`e2e/real-backend/README.md`](e2e/real-backend/README.md) for the safety contract; do not store credentials in its variables or documentation.

## Project structure

```text
src/
  app/                 # Router and global providers
  pages/               # Route-level screens
  features/            # Auth, Dashboard, Topics, LearningTasks, StudySessions
  entities/            # Shared verified domain types
  shared/
    api/               # Typed fetch client, auth session, and error mapping
    ui/                # Reusable UI primitives
    lib/               # Shared utilities
    styles/            # Design tokens and global styles
  test/                # Shared test setup
e2e/
  mocked/              # Fully mocked Playwright suite
  real-backend/        # Guarded isolated-environment suite
docs/                  # API contract and project documentation
```

The verified backend contract is documented in [`docs/api-contract.md`](docs/api-contract.md).

## Production hosting requirements

No production hosting provider or deployment configuration is included yet. Before deployment, the selected platform must provide all of the following:

1. **API routing:** either proxy same-origin `/api` requests to CodeProgress API or build with a reviewed absolute `VITE_API_BASE_URL` and an exact trusted backend CORS policy.
2. **SPA fallback:** serve `index.html` for direct requests to `/login`, `/register`, and `/app/**`, because the application uses `BrowserRouter`.
3. **HTTPS:** serve the frontend and API over HTTPS outside local development.
4. **Security headers:** define an appropriate Content Security Policy, HSTS, `X-Content-Type-Options`, frame protection, and `Referrer-Policy` at the hosting or reverse-proxy layer.
5. **Cache policy:** avoid serving stale `index.html` while allowing fingerprinted static assets to be cached safely.

These are deployment prerequisites, not claims that production deployment has already been completed.

## Known limitations

- Authentication is intentionally not persistent; a full reload requires Login.
- The backend does not provide refresh tokens, password reset, email verification, or admin flows.
- Production hosting and deployment automation have not been selected.
- The automated browser suite currently uses Chromium; Firefox, WebKit, screen-reader, and full assistive-technology audits are not yet part of the baseline.
- Real mobile browser coverage is limited; mocked Playwright covers desktop and a narrow viewport.
- Topic/task/session lists follow the unpaginated CodeProgress API v1.0.0 contract.

## Versioning

The frontend follows [Semantic Versioning](https://semver.org/):

- **MAJOR** for incompatible application, configuration, or supported-contract changes;
- **MINOR** for backward-compatible features;
- **PATCH** for backward-compatible fixes and documentation updates.

Frontend and backend releases are versioned independently. A Git tag such as `v1.0.0` is created only as part of an explicitly approved release process; changing `package.json` alone does not publish or tag a release.

See [`CHANGELOG.md`](CHANGELOG.md) for prepared release notes.

## License

This project is licensed under the MIT License. See the [`LICENSE`](LICENSE) file for details.
