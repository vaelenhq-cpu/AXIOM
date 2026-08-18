function resolveApiBaseUrl(): string {
  const configured =
    import.meta.env.VITE_AXIOM_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (
    window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
  ) {
    return "http://127.0.0.1:8000";
  }

  return "https://api.axiom.vaelenhq.com";
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
};
