import * as vscode from "vscode";
import { Annotation, AnnotationRange } from "../model/annotation";
import { store } from "./store";

/**
 * Listens to document changes and updates annotation ranges to follow edits.
 *
 * Rules:
 *  - Change entirely above a range  → shift start and end by line delta
 *  - Change entirely below a range  → no change
 *  - Change inside a range          → grow or shrink the range
 *  - Change straddling a boundary   → mark conflicted
 *  - Range collapses to < 2 lines   → mark conflicted
 */
export class RangeTracker implements vscode.Disposable {
  private readonly _disposables: vscode.Disposable[] = [];

  constructor() {
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        this._onDocumentChanged(e);
      })
    );
  }

  private _onDocumentChanged(e: vscode.TextDocumentChangeEvent): void {
    const uri = e.document.uri;
    if (uri.scheme !== "file") {
      return;
    }

    // Find the workspace-relative path for this document
    const filePath = this._resolveFilePath(uri);
    if (!filePath) {
      return;
    }

    const annotations = store.getByFile(filePath);
    if (annotations.length === 0) {
      return;
    }

    for (const ann of annotations) {
      if (ann.status === "conflicted") {
        continue; // already broken, skip
      }

      let range = { ...ann.range };
      let conflicted = false;

      for (const change of e.contentChanges) {
        const result = applyChange(range, change);
        if (result === "conflict") {
          conflicted = true;
          break;
        }
        range = result;
      }

      if (conflicted) {
        store.update(ann.id, { status: "conflicted" });
      } else if (
        range.start.line !== ann.range.start.line ||
        range.end.line !== ann.range.end.line
      ) {
        // Range shifted — update it
        if (range.end.line - range.start.line < 1) {
          // Collapsed to a single line — conflict
          store.update(ann.id, { status: "conflicted" });
        } else {
          store.update(ann.id, { range });
        }
      }
    }
  }

  private _resolveFilePath(uri: vscode.Uri): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return undefined;
    }
    const relative = vscode.workspace.asRelativePath(uri, false);
    return folders.length > 1 ? `${folder.name}/${relative}` : relative;
  }

  dispose(): void {
    this._disposables.forEach((d) => d.dispose());
  }
}

// ---------------------------------------------------------------------------
// Pure helper — apply one text change to one annotation range
// ---------------------------------------------------------------------------

function applyChange(
  range: AnnotationRange,
  change: vscode.TextDocumentContentChangeEvent
): AnnotationRange | "conflict" {
  const changeStart = change.range.start.line;
  const changeEnd = change.range.end.line;

  // How many lines the edit adds or removes
  const newLineCount = (change.text.match(/\n/g) ?? []).length;
  const removedLines = changeEnd - changeStart;
  const lineDelta = newLineCount - removedLines;

  const annStart = range.start.line;
  const annEnd = range.end.line;

  // ── Change is entirely below the annotation ──────────────────────────────
  if (changeStart > annEnd) {
    return range; // no effect
  }

  // ── Change is entirely above the annotation ───────────────────────────────
  if (changeEnd < annStart) {
    return {
      start: { line: annStart + lineDelta, character: 0 },
      end: { line: annEnd + lineDelta, character: 0 },
    };
  }

  // ── Change starts above and ends inside the annotation ───────────────────
  // (straddles the start boundary)
  if (changeStart < annStart && changeEnd >= annStart && changeEnd <= annEnd) {
    return "conflict";
  }

  // ── Change starts inside the annotation and ends below ───────────────────
  // (straddles the end boundary)
  if (changeStart >= annStart && changeStart <= annEnd && changeEnd > annEnd) {
    return "conflict";
  }

  // ── Change straddles both boundaries (wraps entire annotation) ───────────
  if (changeStart < annStart && changeEnd > annEnd) {
    return "conflict";
  }

  // ── Change is entirely inside the annotation ─────────────────────────────
  // Grow or shrink the end line by the delta
  return {
    start: { line: annStart, character: 0 },
    end: { line: annEnd + lineDelta, character: 0 },
  };
}
