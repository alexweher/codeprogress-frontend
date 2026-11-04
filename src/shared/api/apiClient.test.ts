import { apiClient } from './apiClient';
import { HttpError, ResponseFormatError } from './apiError';
import { authSession } from './authSession';

describe('apiClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    authSession.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    authSession.setUnauthorizedHandler(null);
    authSession.clear();
    vi.unstubAllGlobals();
  });

  it('supports an empty 204 response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(apiClient.post<void>('test/empty', {})).resolves.toBeUndefined();
  });

  it('reports a successful non-JSON response as a response-format error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('unexpected', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );

    await expect(apiClient.get('test/format')).rejects.toBeInstanceOf(ResponseFormatError);
  });

  it('parses the backend error envelope for an HTTP error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          timestamp: '2026-10-25T10:00:00',
          status: 400,
          error: 'Bad Request',
          message: 'Request validation failed',
          path: '/api/test',
          fieldErrors: [{ field: 'email', message: 'Email must be valid' }],
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const error = await apiClient.get('test/error').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      status: 400,
      apiError: {
        message: 'Request validation failed',
        fieldErrors: [{ field: 'email', message: 'Email must be valid' }],
      },
    });
  });

  it('refuses an absolute external request before fetch is called', async () => {
    await expect(apiClient.get('https://example.com/private')).rejects.toThrow(/must be relative/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a delayed 401 from an older token after the session changes', () => {
    const unauthorizedHandler = vi.fn();
    authSession.setUnauthorizedHandler(unauthorizedHandler);
    authSession.start('old-token');
    authSession.start('new-token');

    authSession.handleUnauthorized('old-token');

    expect(unauthorizedHandler).not.toHaveBeenCalled();
    expect(authSession.getAccessToken()).toBe('new-token');
  });
});
