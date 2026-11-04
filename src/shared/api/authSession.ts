type UnauthorizedHandler = (failedToken: string) => void;

class AuthSession {
  private accessToken: string | null = null;
  private abortController: AbortController | null = null;
  private unauthorizedHandler: UnauthorizedHandler | null = null;

  start(accessToken: string) {
    this.abortController?.abort();
    this.accessToken = accessToken;
    this.abortController = new AbortController();
  }

  clear() {
    this.abortController?.abort();
    this.abortController = null;
    this.accessToken = null;
  }

  getAccessToken() {
    return this.accessToken;
  }

  getSignal() {
    return this.abortController?.signal;
  }

  setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    this.unauthorizedHandler = handler;
  }

  handleUnauthorized(failedToken: string) {
    if (this.accessToken === failedToken) {
      this.unauthorizedHandler?.(failedToken);
    }
  }
}

export const authSession = new AuthSession();
