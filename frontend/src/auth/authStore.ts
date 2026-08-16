export interface AuthUser {
  id: string;
  company_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

const TOKEN_KEY = "axiom.access_token";
const USER_KEY = "axiom.user";

let state: AuthState = {
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
};

const storedUser = localStorage.getItem(USER_KEY);

if (storedUser) {
  try {
    state.user = JSON.parse(storedUser);
  } catch {
    localStorage.removeItem(USER_KEY);
  }
}

export function getAuthState(): AuthState {
  return {
    ...state,
  };
}

export function getAccessToken(): string | null {
  return state.token;
}

export function setAuth(
  token: string,
  user: AuthUser,
): void {
  state = {
    token,
    user,
  };

  localStorage.setItem(
    TOKEN_KEY,
    token,
  );

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user),
  );
}

export function clearAuth(): void {
  state = {
    token: null,
    user: null,
  };

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(state.token);
}
