import {
  clearAuth,
  setAuth,
  type AuthUser,
} from "../auth/authStore";

import { apiRequest } from "./client";

export interface LoginPayload {
  company_slug: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  token_type: string;
  expires_at: string;
  session_id: string;
  user: AuthUser;
}

export interface CurrentUser {
  session_id: string;
  company_id: string;
  user_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
}

export async function login(
  payload: LoginPayload,
): Promise<LoginResponse> {
  const result =
    await apiRequest<LoginResponse>(
      "/api/auth/login",
      {
        method: "POST",
        body: payload,
        auth: false,
      },
    );

  setAuth(
    result.token,
    result.user,
  );

  return result;
}

export async function getMe(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>(
    "/api/auth/me",
  );
}

export async function logout(): Promise<void> {
  try {
    await apiRequest(
      "/api/auth/logout",
      {
        method: "POST",
      },
    );
  } finally {
    clearAuth();
  }
}
