import { getAccessToken } from "../auth/authStore";
import { config } from "../core/config";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(
    status: number,
    message: string,
    payload?: unknown,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    auth = true,
    headers = {},
  } = options;

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] =
      "application/json";
  }

  if (auth) {
    const token = getAccessToken();

    if (token) {
      requestHeaders.Authorization =
        `Bearer ${token}`;
    }
  }

  const response = await fetch(
    `${config.apiBaseUrl}${path}`,
    {
      method,
      headers: requestHeaders,
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    },
  );

  let payload: unknown = null;

  const contentType =
    response.headers.get(
      "content-type",
    );

  if (
    contentType?.includes(
      "application/json",
    )
  ) {
    payload = await response.json();
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload
        ? String(
            (
              payload as {
                message?: unknown;
              }
            ).message,
          )
        : `HTTP ${response.status}`;

    throw new ApiError(
      response.status,
      message,
      payload,
    );
  }

  return payload as T;
}
