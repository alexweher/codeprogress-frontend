type ProcessLike = {
  env?: Record<string, string | undefined>;
};

const environment =
  (globalThis as typeof globalThis & { process?: ProcessLike }).process?.env ?? {};

const requiredAcknowledgements = {
  CODEPROGRESS_REAL_E2E_OPT_IN: 'CONFIRM_ISOLATED_REAL_E2E',
  CODEPROGRESS_REAL_E2E_PREFLIGHT: 'CONFIRM_DATABASE_AND_BASELINE_VERIFIED',
  CODEPROGRESS_REAL_E2E_ALLOW_REGISTRATION: 'CONFIRM_ONE_SYNTHETIC_USER',
  CODEPROGRESS_REAL_E2E_ALLOW_MUTATIONS: 'CONFIRM_CREATED_RESOURCES_ONLY',
} as const;

for (const [name, requiredValue] of Object.entries(requiredAcknowledgements)) {
  if (environment[name] !== requiredValue) {
    throw new Error(`Real-backend E2E is disabled: ${name} acknowledgement is missing.`);
  }
}

const database = environment.CODEPROGRESS_REAL_E2E_DATABASE;
if (
  database === undefined ||
  !/^[A-Za-z0-9_-]{3,63}$/.test(database) ||
  /(prod|production|legacy)/i.test(database)
) {
  throw new Error(
    'Real-backend E2E is disabled: provide a safe isolated test database identifier.',
  );
}

const baseline = environment.CODEPROGRESS_REAL_E2E_BASELINE;
if (
  baseline === undefined ||
  !/^users=\d+,topics=\d+,learning_tasks=\d+,study_sessions=\d+$/.test(baseline)
) {
  throw new Error(
    'Real-backend E2E is disabled: provide the exact externally verified SQL baseline.',
  );
}

const baseURL = environment.CODEPROGRESS_REAL_E2E_BASE_URL;
if (baseURL !== 'http://127.0.0.1:5173') {
  throw new Error('Real-backend E2E is disabled: baseURL must be the isolated loopback Vite URL.');
}

export const realE2EConfig = {
  baseURL,
  baseline,
  database,
} as const;
