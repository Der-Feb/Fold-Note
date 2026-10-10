import * as vscode from "vscode";

/**
 * Chapter 1 spike: shows a single hardcoded CodeLens above line 0,
 * but only while the spike fold is active.
 */
export class FoldNoteCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  private _active = false;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (!this._active || document.lineCount < 5) {
      return [];
    }

    const range = new vscode.Range(0, 0, 0, 0);
    return [
      new vscode.CodeLens(range, {
        title: "📝 Spike note · L1–5  (click to test)",
        command: "foldNote.spikeCodeLensClicked",
        arguments: [],
      }),
    ];
  }

  /** Show the CodeLens. */
  activate(): void {
    this._active = true;
    this._onDidChange.fire();
  }

  /** Hide the CodeLens. */
  clear(): void {
    this._active = false;
    this._onDidChange.fire();
  }

  refresh(): void {
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
