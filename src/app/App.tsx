import type { QueryClient } from '@tanstack/react-query';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './router';

type AppProps = {
  queryClient?: QueryClient;
};

export function App({ queryClient }: AppProps) {
  return (
    <AppProviders queryClient={queryClient}>
      <AppRoutes />
    </AppProviders>
  );
}
