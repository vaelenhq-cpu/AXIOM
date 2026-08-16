export interface DriverIdentity {
  id: string;
  first_name: string;
  last_name?: string | null;
}

const TOKEN_KEY =
  "axiom.driver.access_token";

const DRIVER_KEY =
  "axiom.driver.identity";

export function getDriverToken():
string | null {
  return localStorage.getItem(
    TOKEN_KEY,
  );
}

export function getDriverIdentity():
DriverIdentity | null {
  const raw =
    localStorage.getItem(
      DRIVER_KEY,
    );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setDriverAuth(
  token: string,
  driver: DriverIdentity,
): void {
  localStorage.setItem(
    TOKEN_KEY,
    token,
  );

  localStorage.setItem(
    DRIVER_KEY,
    JSON.stringify(driver),
  );
}

export function clearDriverAuth():
void {
  localStorage.removeItem(
    TOKEN_KEY,
  );

  localStorage.removeItem(
    DRIVER_KEY,
  );
}
