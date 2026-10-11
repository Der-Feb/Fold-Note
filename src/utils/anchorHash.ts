import * as crypto from "crypto";

/**
 * Compute a short hash of a line of text to detect drift.
 * Returns the first 8 hex characters of SHA-256.
 */
export function computeAnchorHash(lineText: string): string {
  return crypto.createHash("sha256").update(lineText).digest("hex").slice(0, 8);
}
