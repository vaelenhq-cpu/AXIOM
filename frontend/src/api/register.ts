import {
  setAuth,
  type AuthUser,
} from "../auth/authStore";

import {
  apiRequest,
} from "./client";


export interface RegisterPayload {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirm: string;
}


export interface RegisterResponse {
  token: string;
  token_type: string;
  expires_at: string;
  session_id: string;

  company: {
    id: string;
    name: string;
    slug: string;
  };

  user: AuthUser;
}


export async function register(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  const result =
    await apiRequest<RegisterResponse>(
      "/api/auth/register",
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
