import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { RequestAbortedError } from '../../../shared/api/apiError';
import { getCurrentUser, login, type LoginRequest, type UserResponse } from '../api/authApi';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { authSession } from './authSession';

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserResponse | null>(null);
  const operationIdRef = useRef(0);
  const loginControllerRef = useRef<AbortController | null>(null);

  const clearAuthState = useCallback(() => {
    operationIdRef.current += 1;
    loginControllerRef.current?.abort();
    loginControllerRef.current = null;
    authSession.clear();
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    clearAuthState();
    await queryClient.cancelQueries();
    queryClient.clear();
  }, [clearAuthState, queryClient]);

  useEffect(() => {
    authSession.setUnauthorizedHandler(() => {
      void logout();
    });

    return () => {
      authSession.setUnauthorizedHandler(null);
      clearAuthState();
    };
  }, [clearAuthState, logout]);

  const signIn = useCallback(async (credentials: LoginRequest) => {
    const operationId = operationIdRef.current + 1;
    operationIdRef.current = operationId;
    loginControllerRef.current?.abort();
    authSession.clear();
    setUser(null);

    const loginController = new AbortController();
    loginControllerRef.current = loginController;

    try {
      const loginResponse = await login(credentials, loginController.signal);

      if (operationIdRef.current !== operationId) {
        throw new RequestAbortedError();
      }

      authSession.start(loginResponse.accessToken);
      const currentUser = await getCurrentUser(loginController.signal);

      if (operationIdRef.current !== operationId) {
        throw new RequestAbortedError();
      }

      setUser(currentUser);
    } catch (error) {
      if (operationIdRef.current === operationId) {
        authSession.clear();
        setUser(null);
      }
      throw error;
    } finally {
      if (operationIdRef.current === operationId) {
        loginControllerRef.current = null;
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn,
      logout,
    }),
    [logout, signIn, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
