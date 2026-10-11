import * as vscode from "vscode";
import { AnnotationRange } from "../model/annotation";
import { store } from "./store";
import { computeAnchorHash } from "../utils/anchorHash";

/**
 * Listens to document changes and updates annotation ranges to follow edits.
 * Also detects drift when a file is opened after external changes.
 */
export class RangeTracker implements vscode.Disposable {
  private readonly _disposables: vscode.Disposable[] = [];

  constructor() {
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        this._onDocumentChanged(e);
      }),
      vscode.workspace.onDidOpenTextDocument((doc) => {
        this._onDocumentOpened(doc);
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Document change — shift or conflict annotations
  // ---------------------------------------------------------------------------

  private _onDocumentChanged(e: vscode.TextDocumentChangeEvent): void {
    if (e.document.uri.scheme !== "file") {
      return;
    }
    if (e.contentChanges.length === 0) {
      return;
    }

    const filePath = this._resolveFilePath(e.document.uri);
    if (!filePath) {
      return;
    }

    const annotations = store.getByFile(filePath);
    if (annotations.length === 0) {
      return;
    }

    for (const ann of annotations) {
      if (ann.status === "conflicted") {
        continue;
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
        if (range.end.line - range.start.line < 1) {
          store.update(ann.id, { status: "conflicted" });
        } else {
          store.update(ann.id, { range });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Document open — detect drift via anchor hash
  // ---------------------------------------------------------------------------

  private _onDocumentOpened(doc: vscode.TextDocument): void {
    if (doc.uri.scheme !== "file") {
      return;
    }

    const filePath = this._resolveFilePath(doc.uri);
    if (!filePath) {
      return;
    }

    const annotations = store.getByFile(filePath);
    if (annotations.length === 0) {
      return;
    }

    for (const ann of annotations) {
      if (ann.status !== "active" || !ann.anchorHash) {
        continue;
      }

      const lineIdx = Math.min(ann.range.start.line, doc.lineCount - 1);
      const currentHash = computeAnchorHash(doc.lineAt(lineIdx).text);

      if (currentHash !== ann.anchorHash) {
        store.update(ann.id, { status: "drifted" });
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
  const newLineCount = (change.text.match(/\n/g) ?? []).length;
  const removedLines = changeEnd - changeStart;
  const lineDelta = newLineCount - removedLines;

  const annStart = range.start.line;
  const annEnd = range.end.line;

  // Change entirely below annotation
  if (changeStart > annEnd) {
    return range;
  }

  // Change entirely above annotation
  if (changeEnd < annStart) {
    return {
      start: { line: annStart + lineDelta, character: 0 },
      end: { line: annEnd + lineDelta, character: 0 },
    };
  }

  // Straddles start boundary
  if (changeStart < annStart && changeEnd >= annStart && changeEnd <= annEnd) {
    return "conflict";
  }

  // Straddles end boundary
  if (changeStart >= annStart && changeStart <= annEnd && changeEnd > annEnd) {
    return "conflict";
  }

  // Wraps entire annotation
  if (changeStart < annStart && changeEnd > annEnd) {
    return "conflict";
  }

  // Entirely inside annotation
  return {
    start: { line: annStart, character: 0 },
    end: { line: annEnd + lineDelta, character: 0 },
  };
}
