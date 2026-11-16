import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { AuthProvider } from '../../features/auth/model/AuthProvider';
import { I18nProvider } from '../../shared/i18n/I18nProvider';

type AppProvidersProps = PropsWithChildren<{
  queryClient?: QueryClient;
}>;

export function AppProviders({ children, queryClient: providedQueryClient }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      providedQueryClient ??
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
