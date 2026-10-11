import * as crypto from "crypto";

/** Generate a RFC 4122 UUID v4. */
export function generateId(): string {
  return crypto.randomUUID();
}
