import { HttpError, NetworkError, ResponseFormatError } from '../../../shared/api/apiError';
import type { I18nContextValue } from '../../../shared/i18n/I18nContext';

export function getTopicErrorMessage(error: unknown, fallback: string, t?: I18nContextValue['t']) {
  if (error instanceof NetworkError) {
    return (
      t?.('common.networkError') ??
      'CodeProgress could not reach the server. Check your connection and try again.'
    );
  }

  if (error instanceof ResponseFormatError) {
    return (
      t?.('common.unexpectedResponse') ??
      'The server returned an unexpected topic response. Please try again.'
    );
  }

  if (error instanceof HttpError) {
    return error.apiError?.message ?? fallback;
  }

  return fallback;
}
