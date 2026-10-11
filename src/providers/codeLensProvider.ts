import * as vscode from "vscode";
import { store } from "../storage/store";

/**
 * Shows a CodeLens above every active annotation in the current document.
 * Reads directly from the store so line numbers always reflect the latest
 * tracked ranges after edits.
 */
export class FoldNoteCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  private _visible = true;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (!this._visible) {
      return [];
    }

    // Check user setting
    const enabled = vscode.workspace
      .getConfiguration("foldNote")
      .get<boolean>("enableCodeLens", true);
    if (!enabled) {
      return [];
    }

    if (document.uri.scheme !== "file") {
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

    return annotations
      .filter((ann) => ann.range.start.line < document.lineCount)
      .map((ann) => {
        const startLine = ann.range.start.line;
        const endLine = ann.range.end.line;
        const range = new vscode.Range(startLine, 0, startLine, 0);

        let title: string;
        if (ann.status === "conflicted") {
          title = `⚠ conflict · "${ann.note}" · click to manage`;
        } else if (ann.status === "drifted") {
          title = `~ may have moved · "${ann.note}" · L${startLine + 1}–${endLine + 1}`;
        } else if (ann.kind === "folder") {
          title = `📝 ${ann.note} · L${startLine + 1}–${endLine + 1}`;
        } else {
          const colorLabel = ann.color ? `${ann.color} ` : "";
          title = `🎨 ${colorLabel}${ann.note || ""} · L${startLine + 1}–${endLine + 1}`.trim();
        }

        return new vscode.CodeLens(range, {
          title,
          command: "foldNote.codeLensClicked",
          arguments: [ann.id],
        });
      });
  }

  /** Toggle CodeLens visibility (used by Toggle All Notes command). */
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

  // Kept for spike backward compat — these are now no-ops
  activateFolder(_s: number, _e: number): void { this._onDidChange.fire(); }
  activateHighlight(_s: number, _e: number, _c: string): void { this._onDidChange.fire(); }
  clearFolder(): void { this._onDidChange.fire(); }
  clearHighlight(): void { this._onDidChange.fire(); }
  clearAll(): void { this._onDidChange.fire(); }

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
