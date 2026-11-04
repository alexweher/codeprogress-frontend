import { authSession } from './authSession';
import {
  HttpError,
  isApiErrorResponse,
  NetworkError,
  RequestAbortedError,
  ResponseFormatError,
  type ApiErrorResponse,
} from './apiError';

type RequestOptions = {
  body?: unknown;
  signal?: AbortSignal;
  authenticated?: boolean;
  expectedStatus?: number;
};

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';

function createRequestUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    throw new Error('API request paths must be relative to the configured API base URL');
  }

  const baseUrl = new URL(
    configuredBaseUrl.endsWith('/') ? configuredBaseUrl : `${configuredBaseUrl}/`,
    window.location.origin,
  );
  const requestUrl = new URL(path.replace(/^\//, ''), baseUrl);

  if (requestUrl.origin !== baseUrl.origin || !requestUrl.pathname.startsWith(baseUrl.pathname)) {
    throw new Error('Refusing to send a request outside the configured API base URL');
  }

  return requestUrl;
}

function combineSignals(signals: Array<AbortSignal | undefined>) {
  const availableSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);

  if (availableSignals.length === 0) {
    return undefined;
  }

  if (availableSignals.length === 1) {
    return availableSignals[0];
  }

  return AbortSignal.any(availableSignals);
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new ResponseFormatError(
      error instanceof Error ? 'The server response is not valid JSON' : undefined,
    );
  }
}

async function parseErrorResponse(response: Response): Promise<ApiErrorResponse | null> {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return null;
  }

  try {
    const body: unknown = await response.json();
    return isApiErrorResponse(body) ? body : null;
  } catch {
    return null;
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: RequestOptions = {},
) {
  const requestUrl = createRequestUrl(path);
  const headers = new Headers({ Accept: 'application/json' });
  const accessToken = options.authenticated ? authSession.getAccessToken() : null;

  if (options.authenticated && !accessToken) {
    throw new HttpError(401, null);
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: combineSignals([
        options.signal,
        options.authenticated ? authSession.getSignal() : undefined,
      ]),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RequestAbortedError();
    }

    throw new NetworkError(error instanceof Error ? { cause: error } : undefined);
  }

  if (!response.ok) {
    const apiError = await parseErrorResponse(response);

    if (response.status === 401 && accessToken) {
      authSession.handleUnauthorized(accessToken);
    }

    throw new HttpError(response.status, apiError);
  }

  if (options.expectedStatus !== undefined && response.status !== options.expectedStatus) {
    throw new ResponseFormatError(
      `The server returned HTTP ${response.status}; expected HTTP ${options.expectedStatus}`,
    );
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new ResponseFormatError('The server response is not JSON');
  }

  return (await parseJson(response)) as T;
}

export const apiClient = {
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('GET', path, options);
  },
  post<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('POST', path, { ...options, body });
  },
  put<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('PUT', path, { ...options, body });
  },
  patch<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('PATCH', path, { ...options, body });
  },
  delete<T>(path: string, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('DELETE', path, options);
  },
};
