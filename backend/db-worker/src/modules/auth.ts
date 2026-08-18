import {
  pbkdf2Sync,
  timingSafeEqual,
} from "node:crypto";

import { first, run } from "../core/db";
import { generateId } from "../core/ids";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((v) => v.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split("$");

  if (
    parts.length !== 4
    ||
    parts[0] !== "pbkdf2_sha256"
  ) {
    return false;
  }

  const iterations =
    Number(parts[1]);

  const saltHex = parts[2];
  const expectedHex = parts[3];

  if (
    !Number.isFinite(iterations)
    ||
    iterations <= 0
    ||
    iterations > 100_000
    ||
    saltHex.length % 2 !== 0
  ) {
    return false;
  }

  const expected =
    Buffer.from(
      expectedHex,
      "hex",
    );

  const actual =
    pbkdf2Sync(
      password,
      Buffer.from(
        saltHex,
        "hex",
      ),
      iterations,
      expected.length,
      "sha256",
    );

  if (
    actual.length !==
    expected.length
  ) {
    return false;
  }

  return timingSafeEqual(
    actual,
    expected,
  );
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function futureIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function ownerLogin(db: D1Database, input: any) {
  const identity = await first<any>(db, `
    SELECT u.id, u.company_id, u.email, u.password_hash, u.first_name, u.last_name,
           u.role, u.status, c.status AS company_status
    FROM company_users u
    JOIN companies c ON c.id = u.company_id
    WHERE c.slug = ? AND lower(u.email) = lower(?)
    LIMIT 1
  `, [String(input.companySlug ?? "").trim(), String(input.email ?? "").trim()]);

  if (!identity || !["trial", "active"].includes(identity.company_status) || identity.status !== "active" ||
      !await verifyPassword(String(input.password ?? ""), identity.password_hash)) {
    throw new Error("Invalid company, email or password");
  }

  const rawToken = newToken();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = futureIso(12);
  const sessionId = generateId("session");

  await run(db, `
    INSERT INTO auth_sessions (id, company_id, user_id, token_hash, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [sessionId, identity.company_id, identity.id, tokenHash, input.ipAddress ?? null, input.userAgent ?? null, expiresAt]);

  await run(db, `UPDATE company_users SET last_login_at = ?, updated_at = ? WHERE id = ? AND company_id = ?`,
    [new Date().toISOString(), new Date().toISOString(), identity.id, identity.company_id]);

  return {
    token: rawToken,
    token_type: "bearer",
    expires_at: expiresAt,
    session_id: sessionId,
    user: {
      id: identity.id,
      company_id: identity.company_id,
      email: identity.email,
      first_name: identity.first_name,
      last_name: identity.last_name,
      role: identity.role,
    },
  };
}

export async function ownerAuthenticate(db: D1Database, token: string) {
  const tokenHash = await sha256Hex(token);
  const row = await first<any>(db, `
    SELECT s.id AS session_id, s.company_id, s.user_id, s.expires_at, s.revoked_at,
           u.email, u.first_name, u.last_name, u.role, u.status AS user_status,
           c.status AS company_status
    FROM auth_sessions s
    JOIN company_users u ON u.id = s.user_id AND u.company_id = s.company_id
    JOIN companies c ON c.id = s.company_id
    WHERE s.token_hash = ? LIMIT 1
  `, [tokenHash]);

  if (!row || row.revoked_at || row.user_status !== "active" || !["trial", "active"].includes(row.company_status) ||
      new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Invalid or expired session");
  }

  return {
    session_id: row.session_id,
    company_id: row.company_id,
    user_id: row.user_id,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    role: row.role,
  };
}

export async function ownerLogout(db: D1Database, token: string) {
  const tokenHash = await sha256Hex(token);
  await run(db, `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL`, [tokenHash]);
  return { revoked: true };
}

export async function driverLogin(db: D1Database, input: any) {
  const identity = await first<any>(db, `
    SELECT da.id, da.company_id, da.driver_id, da.password_hash, da.status,
           d.first_name, d.last_name, d.active AS driver_active,
           c.status AS company_status
    FROM driver_accounts da
    JOIN drivers d ON d.id = da.driver_id AND d.company_id = da.company_id
    JOIN companies c ON c.id = da.company_id
    WHERE c.slug = ? AND da.login_identifier = ? LIMIT 1
  `, [String(input.companySlug ?? "").trim(), String(input.loginIdentifier ?? "").trim()]);

  if (!identity || identity.status !== "active" || !identity.driver_active ||
      !["trial", "active"].includes(identity.company_status) || !identity.password_hash ||
      !await verifyPassword(String(input.password ?? ""), identity.password_hash)) {
    throw new Error("Invalid driver credentials");
  }

  const rawToken = newToken();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = futureIso(24);
  const sessionId = generateId("session");

  await run(db, `
    INSERT INTO driver_sessions (id, company_id, driver_account_id, token_hash, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [sessionId, identity.company_id, identity.id, tokenHash, input.ipAddress ?? null, input.userAgent ?? null, expiresAt]);

  await run(db, `UPDATE driver_accounts SET last_login_at = ?, updated_at = ? WHERE id = ? AND company_id = ?`,
    [new Date().toISOString(), new Date().toISOString(), identity.id, identity.company_id]);

  return {
    token: rawToken,
    expires_at: expiresAt,
    session_id: sessionId,
    driver: { id: identity.driver_id, first_name: identity.first_name, last_name: identity.last_name },
  };
}

export async function driverAuthenticate(db: D1Database, token: string) {
  const tokenHash = await sha256Hex(token);
  const row = await first<any>(db, `
    SELECT ds.id AS session_id, ds.company_id, ds.driver_account_id, ds.expires_at, ds.revoked_at,
           da.driver_id, da.status AS account_status, d.first_name, d.last_name,
           d.active AS driver_active, c.status AS company_status
    FROM driver_sessions ds
    JOIN driver_accounts da ON da.id = ds.driver_account_id AND da.company_id = ds.company_id
    JOIN drivers d ON d.id = da.driver_id AND d.company_id = ds.company_id
    JOIN companies c ON c.id = ds.company_id
    WHERE ds.token_hash = ? LIMIT 1
  `, [tokenHash]);

  if (!row || row.revoked_at || row.account_status !== "active" || !row.driver_active ||
      !["trial", "active"].includes(row.company_status) || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Invalid or expired driver session");
  }

  return {
    session_id: row.session_id,
    company_id: row.company_id,
    driver_id: row.driver_id,
    first_name: row.first_name,
    last_name: row.last_name,
  };
}
