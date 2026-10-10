import * as vscode from "vscode";

/**
 * Chapter 1 spike: shows a single hardcoded CodeLens above line 0.
 * Clicking it runs the foldNote.openSidebar command (also hardcoded for now).
 */
export class FoldNoteCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (document.lineCount < 5) {
      return [];
    }

    const range = new vscode.Range(0, 0, 0, 0);
    const lens = new vscode.CodeLens(range, {
      title: "📝 Spike note · L1–5  (click to test)",
      command: "foldNote.spikeCodeLensClicked",
      arguments: [],
    });

    return [lens];
  }

  refresh(): void {
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
