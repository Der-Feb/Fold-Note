import * as vscode from "vscode";
import { store } from "../storage/store";

/**
 * Shows a CodeLens above every active annotation in the current document.
 * Reads directly from the store so line numbers always reflect the latest
 * tracked ranges after edits.
 *
 * Chapter 6 additions:
 *  - Respects `foldNote.enableCodeLens` setting (default true).
 *  - `toggleVisibility()` toggles a per-session override for the active file.
 *  - Uses `foldNote.codeLensClicked` (not the spike command) for store annotations.
 */
export class FoldNoteCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  /** Session-level visibility toggle (affects ALL files). */
  private _visible = true;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (document.uri.scheme !== "file") {
      return [];
    }

    // Check the enableCodeLens setting
    const cfg = vscode.workspace.getConfiguration("foldNote");
    const settingEnabled = cfg.get<boolean>("enableCodeLens", true);
    if (!settingEnabled || !this._visible) {
      return [];
    }

    const filePath = this._resolveFilePath(document.uri);
    if (!filePath) {
      return [];
    }

    const annotations = store.getByFile(filePath);
    if (annotations.length === 0) {
      return [];
    }

    const prefix = cfg.get<string>("badgePrefix", "📝 ");

    return annotations
      .filter((ann) => ann.range.start.line < document.lineCount)
      .map((ann) => {
        const startLine = ann.range.start.line;
        const endLine = ann.range.end.line;
        const range = new vscode.Range(startLine, 0, startLine, 0);

        let title: string;
        if (ann.status === "conflicted") {
          title = `⚠ conflict · "${ann.note}" · click to manage`;
        } else if (ann.kind === "folder") {
          title = `${prefix}${ann.note} · L${startLine + 1}–${endLine + 1}`;
        } else {
          title = `🎨 ${ann.color ?? "highlight"} · ${ann.note || ""} · L${startLine + 1}–${endLine + 1}`;
        }

        return new vscode.CodeLens(range, {
          title,
          command: "foldNote.codeLensClicked",
          arguments: [ann.id],
        });
      });
  }

  /** Toggle session-level visibility of all CodeLenses. */
  toggleVisibility(): void {
    this._visible = !this._visible;
    this._onDidChange.fire();
  }

  get isVisible(): boolean {
    return this._visible;
  }

  refresh(): void {
    this._onDidChange.fire();
  }

  // Keep these for backward compat with spike commands (no-ops now since
  // store is the source of truth)
  activateFolder(_startLine: number, _endLine: number): void {
    this._onDidChange.fire();
  }
  activateHighlight(_startLine: number, _endLine: number, _color: string): void {
    this._onDidChange.fire();
  }
  clearFolder(): void {
    this._onDidChange.fire();
  }
  clearHighlight(): void {
    this._onDidChange.fire();
  }
  clearAll(): void {
    this._onDidChange.fire();
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
