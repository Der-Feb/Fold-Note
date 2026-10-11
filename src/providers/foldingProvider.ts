import * as vscode from "vscode";
import { store } from "../storage/store";

/**
 * Folding provider that serves two modes:
 *
 * 1. Spike mode (legacy) — a single manually-set range via `activate()`.
 * 2. Store mode — all active folder annotations from the store for the
 *    currently active document.
 *
 * Both modes coexist so spike commands keep working.
 */
export class FoldNoteProvider implements vscode.FoldingRangeProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeFoldingRanges = this._onDidChange.event;

  // Spike single-range (legacy)
  private _range: vscode.FoldingRange | undefined;

  provideFoldingRanges(
    document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];

    // Spike single-range (legacy)
    if (this._range) {
      ranges.push(this._range);
    }

    // Store-based ranges for this document
    if (document.uri.scheme === "file") {
      const filePath = this._resolveFilePath(document.uri);
      if (filePath) {
        const annotations = store.getByFile(filePath);
        for (const ann of annotations) {
          if (ann.kind === "folder" && ann.status === "active") {
            ranges.push(
              new vscode.FoldingRange(
                ann.range.start.line,
                ann.range.end.line,
                vscode.FoldingRangeKind.Region
              )
            );
          }
        }
      }
    }

    return ranges;
  }

  /** Register a spike range and tell VS Code to re-query. */
  activate(startLine: number, endLine: number): void {
    this._range = new vscode.FoldingRange(
      startLine,
      endLine,
      vscode.FoldingRangeKind.Region
    );
    this._onDidChange.fire();
  }

  /** Remove the spike range and tell VS Code to re-query. */
  clear(): void {
    this._range = undefined;
    this._onDidChange.fire();
  }

  /** Re-fire without changing state. */
  refresh(): void {
    this._onDidChange.fire();
  }

  get isActive(): boolean {
    return this._range !== undefined;
  }

  get activeRange(): vscode.FoldingRange | undefined {
    return this._range;
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
    this._onDidChange.dispose();
  }
}
