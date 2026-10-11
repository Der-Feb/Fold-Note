import * as vscode from "vscode";

/**
 * Chapter 1 spike: returns a single hardcoded folding range (lines 0–4)
 * only when active. Calling clear() removes the range and refreshes so
 * VS Code drops both the fold and the CodeLens.
 */
export class FoldNoteProvider implements vscode.FoldingRangeProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeFoldingRanges = this._onDidChange.event;

  private _active = false;

  provideFoldingRanges(
    _document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): vscode.FoldingRange[] {
    if (!this._active) {
      return [];
    }
    return [new vscode.FoldingRange(0, 4, vscode.FoldingRangeKind.Region)];
  }

  /** Activate the hardcoded range and tell VS Code to re-query. */
  activate(): void {
    this._active = true;
    this._onDidChange.fire();
  }

  /** Remove the range and tell VS Code to re-query (clears fold + CodeLens). */
  clear(): void {
    this._active = false;
    this._onDidChange.fire();
  }

  /** Fire the change event without toggling state (for the refresh spike command). */
  refresh(): void {
    this._onDidChange.fire();
  }

  get isActive(): boolean {
    return this._active;
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
