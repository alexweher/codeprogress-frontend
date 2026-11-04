import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../app/App';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderApp(initialRoute = '/login', queryClient = createTestQueryClient()) {
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App queryClient={queryClient} />
    </MemoryRouter>,
  );

  return { ...result, user, queryClient };
}
