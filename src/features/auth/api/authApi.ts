import { apiClient } from '../../../shared/api/apiClient';
import { ResponseFormatError } from '../../../shared/api/apiError';

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

export type RegisterUserRequest = {
  email: string;
  password: string;
};

export type UserResponse = {
  id: number;
  email: string;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLoginResponse(value: unknown): value is LoginResponse {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    value.tokenType === 'Bearer' &&
    typeof value.expiresIn === 'number' &&
    value.expiresIn > 0
  );
}

function isUserResponse(value: unknown): value is UserResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.email === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export async function login(request: LoginRequest, signal?: AbortSignal) {
  const response: unknown = await apiClient.post('auth/login', request, { signal });

  if (!isLoginResponse(response)) {
    throw new ResponseFormatError('The login response has an unexpected format');
  }

  return response;
}

export async function register(request: RegisterUserRequest, signal?: AbortSignal) {
  const response: unknown = await apiClient.post('auth/register', request, { signal });

  if (!isUserResponse(response)) {
    throw new ResponseFormatError('The registration response has an unexpected format');
  }

  return response;
}

export async function getCurrentUser(signal?: AbortSignal) {
  const response: unknown = await apiClient.get('users/me', {
    authenticated: true,
    signal,
  });

  if (!isUserResponse(response)) {
    throw new ResponseFormatError('The current-user response has an unexpected format');
  }

  return response;
}
