import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

export type LocalAuth = {
  token: string;
  authFile: string;
};

export function loadOrCreateLocalAuth(authFile: string, overrideToken?: string): LocalAuth {
  if (overrideToken) return { token: overrideToken, authFile };
  if (authFile === ":memory:") return { token: randomBytes(32).toString("base64url"), authFile };
  if (existsSync(authFile)) {
    const parsed = JSON.parse(readFileSync(authFile, "utf8")) as { token?: unknown };
    if (typeof parsed.token === "string" && parsed.token.length >= 32) return { token: parsed.token, authFile };
    throw new Error("Local authorization file is invalid");
  }
  const token = randomBytes(32).toString("base64url");
  writeFileSync(authFile, `${JSON.stringify({ version: 1, token }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try { chmodSync(authFile, 0o600); } catch { /* Windows ACL is tightened by the installer. */ }
  return { token, authFile };
}

export function tokenMatches(expected: string, candidate: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(candidate);
  return left.length === right.length && timingSafeEqual(left, right);
}
