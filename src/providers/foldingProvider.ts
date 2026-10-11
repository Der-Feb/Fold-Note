import * as vscode from "vscode";

/**
 * Spike folding provider.
 * Accepts a dynamic range instead of a hardcoded one, so we can fold
 * any range coming from a selection or manual input.
 */
export class FoldNoteProvider implements vscode.FoldingRangeProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeFoldingRanges = this._onDidChange.event;

  private _range: vscode.FoldingRange | undefined;

  provideFoldingRanges(
    _document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): vscode.FoldingRange[] {
    return this._range ? [this._range] : [];
  }

  /** Register a range and tell VS Code to re-query. */
  activate(startLine: number, endLine: number): void {
    this._range = new vscode.FoldingRange(
      startLine,
      endLine,
      vscode.FoldingRangeKind.Region
    );
    this._onDidChange.fire();
  }

  /** Remove the range and tell VS Code to re-query. */
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

  dispose(): void {
    this._onDidChange.dispose();
  }
}
