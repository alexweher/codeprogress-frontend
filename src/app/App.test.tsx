import { screen } from '@testing-library/react';
import { renderApp } from '../test/renderApp';

describe('protected routing', () => {
  it('redirects a visitor without an in-memory session from /app to /login', () => {
    renderApp('/app');

    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeInTheDocument();
  });
});
