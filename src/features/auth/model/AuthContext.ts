import { createContext } from 'react';
import type { LoginRequest, UserResponse } from '../api/authApi';

export type AuthContextValue = {
  user: UserResponse | null;
  isAuthenticated: boolean;
  signIn: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
