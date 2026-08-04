const TRUSTED_ORIGINS = new Set([
  "null",
  "app://-",
  "http://127.0.0.1:47831",
  "http://localhost:47831",
  "http://127.0.0.1:47832",
  "http://localhost:47832",
]);

export function isTrustedOrigin(origin: string | undefined): boolean {
  return origin === undefined || TRUSTED_ORIGINS.has(origin);
}
