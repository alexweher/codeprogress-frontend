# Real-backend Browser E2E

This suite is intentionally excluded from `playwright.config.ts`, `npm test`,
`npm run test:e2e`, `npm run test:e2e:mocked`, and the standard GitHub Actions workflow.

It is destructive integration tooling, not a normal developer test. Run it only against a dedicated,
disposable test database after an authorized operator has inspected the backend/JDBC target and
verified an exact read-only SQL baseline. Never point it at production, legacy, shared, or personally
important data.

## Required runtime acknowledgements

The runner and Playwright config fail closed unless every non-secret variable below is supplied for
the current authorized run:

```text
CODEPROGRESS_REAL_E2E_OPT_IN=CONFIRM_ISOLATED_REAL_E2E
CODEPROGRESS_REAL_E2E_PREFLIGHT=CONFIRM_DATABASE_AND_BASELINE_VERIFIED
CODEPROGRESS_REAL_E2E_ALLOW_REGISTRATION=CONFIRM_ONE_SYNTHETIC_USER
CODEPROGRESS_REAL_E2E_ALLOW_MUTATIONS=CONFIRM_CREATED_RESOURCES_ONLY
CODEPROGRESS_REAL_E2E_DATABASE=<isolated-test-database-identifier>
CODEPROGRESS_REAL_E2E_BASELINE=users=<n>,topics=<n>,learning_tasks=<n>,study_sessions=<n>
CODEPROGRESS_REAL_E2E_BASE_URL=http://127.0.0.1:5173
```

These acknowledgements are attestations, not isolation checks. The runner cannot independently prove
the Docker, network, volume, JDBC, or SQL state. Set them only after the current environment has been
verified and the exact registration, mutations, and cleanup have been explicitly authorized. Do not
put database passwords, JWTs, Authorization headers, or other secrets in these variables.

The database identifier must be a neutral test identifier and is rejected when it contains
`prod`, `production`, or `legacy`. The baseline is runtime evidence and is deliberately not fixed in
the repository. A historical opt-in or baseline must never be reused.

## Mutation boundary

The suite registers one random `example.test` user and first confirms that this new owner's Dashboard
and Topics views are empty. It then creates one Topic, three LearningTasks, and one StudySession.
Every created ID is captured from the corresponding HTTP `201` response and registered by resource
type. PUT, PATCH, and DELETE paths refuse IDs that were not registered during the current process.

Happy-path UI cleanup deletes only those current-run resources. There is no `afterEach`, `afterAll`,
direct API fallback, SQL cleanup, or automatic retry. Tests run serially with one worker and zero
retries, so the first failure stops the remaining flow. If cleanup becomes impossible, stop, record
the new IDs without credentials, and request separate authorization before taking further action.

Synthetic credentials and JWTs remain in process/browser memory. Traces, screenshots, and video are
disabled. Real-backend E2E is never evidence that an arbitrary environment is safe; authorization and
external preflight remain mandatory for every run.
