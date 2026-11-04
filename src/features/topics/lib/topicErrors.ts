import { HttpError, NetworkError, ResponseFormatError } from '../../../shared/api/apiError';

export function getTopicErrorMessage(error: unknown, fallback: string) {
  if (error instanceof NetworkError) {
    return 'CodeProgress could not reach the server. Check your connection and try again.';
  }

  if (error instanceof ResponseFormatError) {
    return 'The server returned an unexpected topic response. Please try again.';
  }

  if (error instanceof HttpError) {
    return error.apiError?.message ?? fallback;
  }

  return fallback;
}
