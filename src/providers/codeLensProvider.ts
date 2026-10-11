import * as vscode from "vscode";

type SpikeKind = "folder" | "highlight";

interface SpikeEntry {
  kind: SpikeKind;
  startLine: number;
  endLine: number;
  color?: string;
}

/**
 * Shows a CodeLens at the actual start line of each active spike entry.
 * Both folders and highlights get a CodeLens.
 */
export class FoldNoteCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  private _entries: SpikeEntry[] = [];

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (this._entries.length === 0) {
      return [];
    }

    return this._entries
      .filter((e) => e.startLine < document.lineCount)
      .map((entry) => {
        const range = new vscode.Range(entry.startLine, 0, entry.startLine, 0);
        const label =
          entry.kind === "folder"
            ? `📝 Spike note · L${entry.startLine + 1}–${entry.endLine + 1}`
            : `🎨 ${entry.color ?? "highlight"} · L${entry.startLine + 1}–${entry.endLine + 1}`;

        return new vscode.CodeLens(range, {
          title: label,
          command: "foldNote.spikeCodeLensClicked",
          arguments: [entry.kind],
        });
      });
  }

  activateFolder(startLine: number, endLine: number): void {
    this._removeKind("folder");
    this._entries.push({ kind: "folder", startLine, endLine });
    this._onDidChange.fire();
  }

  activateHighlight(startLine: number, endLine: number, color: string): void {
    this._removeKind("highlight");
    this._entries.push({ kind: "highlight", startLine, endLine, color });
    this._onDidChange.fire();
  }

  clearFolder(): void {
    this._removeKind("folder");
    this._onDidChange.fire();
  }

  clearHighlight(): void {
    this._removeKind("highlight");
    this._onDidChange.fire();
  }

  clearAll(): void {
    this._entries = [];
    this._onDidChange.fire();
  }

  refresh(): void {
    this._onDidChange.fire();
  }

  private _removeKind(kind: SpikeKind): void {
    this._entries = this._entries.filter((e) => e.kind !== kind);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
