import { Annotation } from "../model/annotation";

/** Key used in workspaceState. */
export const STORAGE_KEY = "foldNote.data";

/** Bump this when the stored shape changes in a breaking way. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * The root object stored under STORAGE_KEY.
 * files: workspace-relative path → list of annotations.
 */
export interface StoredData {
  schemaVersion: number;
  files: Record<string, Annotation[]>;
}

/** Returns a fresh empty store. */
export function emptyStoredData(): StoredData {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, files: {} };
}

/**
 * Migrate older stored data to the current schema version.
 * Add cases here as the schema evolves.
 */
export function migrate(raw: unknown): StoredData {
  if (!raw || typeof raw !== "object") {
    return emptyStoredData();
  }

  const data = raw as Partial<StoredData>;

  if (
    typeof data.schemaVersion !== "number" ||
    data.schemaVersion > CURRENT_SCHEMA_VERSION
  ) {
    // Unknown or future version — start fresh.
    return emptyStoredData();
  }

  // v1 is the only version so far — nothing to migrate yet.
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    files: data.files ?? {},
  };
}
