export type FieldValidationError = {
  field: string;
  message: string;
};

export type ApiErrorResponse = {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors: FieldValidationError[];
};

export class HttpError extends Error {
  readonly status: number;
  readonly apiError: ApiErrorResponse | null;

  constructor(status: number, apiError: ApiErrorResponse | null) {
    super(apiError?.message ?? `Request failed with status ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.apiError = apiError;
  }
}

export class NetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super('The server could not be reached', options);
    this.name = 'NetworkError';
  }
}

export class ResponseFormatError extends Error {
  constructor(message = 'The server returned an unexpected response') {
    super(message);
    this.name = 'ResponseFormatError';
  }
}

export class RequestAbortedError extends Error {
  constructor() {
    super('The request was cancelled');
    this.name = 'RequestAbortedError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFieldValidationError(value: unknown): value is FieldValidationError {
  return isRecord(value) && typeof value.field === 'string' && typeof value.message === 'string';
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isRecord(value) &&
    typeof value.timestamp === 'string' &&
    typeof value.status === 'number' &&
    typeof value.error === 'string' &&
    typeof value.message === 'string' &&
    typeof value.path === 'string' &&
    Array.isArray(value.fieldErrors) &&
    value.fieldErrors.every(isFieldValidationError)
  );
}
