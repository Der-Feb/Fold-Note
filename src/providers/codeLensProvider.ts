import * as vscode from "vscode";

type SpikeKind = "folder" | "highlight";

interface SpikeEntry {
  kind: SpikeKind;
  color?: string; // highlights only
}

/**
 * Chapter 1 spike: shows a hardcoded CodeLens above line 0 for each
 * active spike entry (fold and/or highlight). Both folders and highlights
 * get a CodeLens — they are the same annotation type, only the kind differs.
 */
export class FoldNoteCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  private _entries: SpikeEntry[] = [];

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (this._entries.length === 0 || document.lineCount < 5) {
      return [];
    }

    const range = new vscode.Range(0, 0, 0, 0);

    return this._entries.map((entry) => {
      const label =
        entry.kind === "folder"
          ? "📝 Spike note · L1–5  (click to test)"
          : `🎨 Spike highlight · ${entry.color ?? "color"} · L1–5  (click to test)`;

      return new vscode.CodeLens(range, {
        title: label,
        command: "foldNote.spikeCodeLensClicked",
        arguments: [entry.kind],
      });
    });
  }

  /** Register a fold CodeLens. */
  activateFolder(): void {
    this._removeKind("folder");
    this._entries.push({ kind: "folder" });
    this._onDidChange.fire();
  }

  /** Register a highlight CodeLens. */
  activateHighlight(color: string): void {
    this._removeKind("highlight");
    this._entries.push({ kind: "highlight", color });
    this._onDidChange.fire();
  }

  /** Remove the fold CodeLens. */
  clearFolder(): void {
    this._removeKind("folder");
    this._onDidChange.fire();
  }

  /** Remove the highlight CodeLens. */
  clearHighlight(): void {
    this._removeKind("highlight");
    this._onDidChange.fire();
  }

  /** Remove all CodeLenses. */
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
