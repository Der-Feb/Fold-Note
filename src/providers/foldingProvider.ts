import * as vscode from "vscode";

/**
 * Chapter 1 spike: returns a single hardcoded folding range (lines 0–4)
 * so we can confirm the provider fires, VS Code re-queries it, and the
 * built-in fold command works on our range.
 */
export class FoldNoteProvider implements vscode.FoldingRangeProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeFoldingRanges = this._onDidChange.event;

  provideFoldingRanges(
    _document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): vscode.FoldingRange[] {
    // Hardcoded spike range: fold lines 0–4 (1-indexed: lines 1–5 in the editor)
    return [new vscode.FoldingRange(0, 4, vscode.FoldingRangeKind.Region)];
  }

  /** Fire this to tell VS Code to re-ask for folding ranges. */
  refresh(): void {
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
