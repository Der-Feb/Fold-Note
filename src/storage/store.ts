import * as vscode from "vscode";
import { Annotation } from "../model/annotation";
import { StoredData, STORAGE_KEY, emptyStoredData, migrate } from "./schema";

/** Debounce window before writing to workspaceState (ms). */
const DEBOUNCE_MS = 500;

/**
 * AnnotationStore — the single source of truth for all annotations.
 *
 * - Loaded once at startup from workspaceState (non-blocking).
 * - In-memory lookups by file path and by annotation ID.
 * - Writes are debounced; a final flush happens on deactivate.
 * - Fires `onChange` after every mutation so listeners can react.
 */
export class AnnotationStore implements vscode.Disposable {
  private _data: StoredData = emptyStoredData();
  private _context: vscode.ExtensionContext | undefined;
  private _saveTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly _onChange = new vscode.EventEmitter<void>();
  /** Fires after every mutation (add, update, remove, removeFile, clearAll). */
  readonly onChange = this._onChange.event;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Load persisted data into memory. Call once during extension activation. */
  load(context: vscode.ExtensionContext): void {
    this._context = context;
    const raw = context.workspaceState.get<unknown>(STORAGE_KEY);
    this._data = migrate(raw);
  }

  /** Flush any pending save immediately. Call during extension deactivation. */
  async flush(): Promise<void> {
    if (this._saveTimer !== undefined) {
      clearTimeout(this._saveTimer);
      this._saveTimer = undefined;
    }
    await this._persist();
  }

  dispose(): void {
    this.flush();
    this._onChange.dispose();
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** All annotations for a given workspace-relative file path. */
  getByFile(filePath: string): Annotation[] {
    return this._data.files[filePath] ?? [];
  }

  /** A single annotation by ID, or undefined if not found. */
  getById(id: string): Annotation | undefined {
    for (const annotations of Object.values(this._data.files)) {
      const found = annotations.find((a) => a.id === id);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /** All file paths that have at least one annotation. */
  getTrackedFiles(): string[] {
    return Object.keys(this._data.files);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /** Add a new annotation. Replaces any existing annotation with the same ID. */
  add(annotation: Annotation): void {
    const list = this._data.files[annotation.filePath] ?? [];
    const idx = list.findIndex((a) => a.id === annotation.id);
    if (idx >= 0) {
      list[idx] = annotation;
    } else {
      list.push(annotation);
    }
    this._data.files[annotation.filePath] = list;
    this._scheduleSave();
    this._onChange.fire();
  }

  /** Update fields on an existing annotation. No-op if ID not found. */
  update(
    id: string,
    changes: Partial<Omit<Annotation, "id" | "filePath">>
  ): void {
    for (const list of Object.values(this._data.files)) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          ...changes,
          updatedAt: new Date().toISOString(),
        };
        this._scheduleSave();
        this._onChange.fire();
        return;
      }
    }
  }

  /** Remove an annotation by ID. */
  remove(id: string): void {
    for (const [path, list] of Object.entries(this._data.files)) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx >= 0) {
        list.splice(idx, 1);
        if (list.length === 0) {
          delete this._data.files[path];
        }
        this._scheduleSave();
        this._onChange.fire();
        return;
      }
    }
  }

  /** Remove all annotations for a given file path. */
  removeFile(filePath: string): void {
    if (this._data.files[filePath]) {
      delete this._data.files[filePath];
      this._scheduleSave();
      this._onChange.fire();
    }
  }

  /** Remove every annotation in the workspace. */
  clearAll(): void {
    this._data = emptyStoredData();
    this._scheduleSave();
    this._onChange.fire();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _scheduleSave(): void {
    if (this._saveTimer !== undefined) {
      clearTimeout(this._saveTimer);
    }
    this._saveTimer = setTimeout(() => {
      this._saveTimer = undefined;
      this._persist();
    }, DEBOUNCE_MS);
  }

  private async _persist(): Promise<void> {
    if (!this._context) {
      return;
    }
    await this._context.workspaceState.update(STORAGE_KEY, this._data);
  }
}

/** Singleton instance shared across the extension. */
export const store = new AnnotationStore();
