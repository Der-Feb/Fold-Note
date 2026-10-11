import * as vscode from "vscode";

/**
 * Chapter 1 highlight spike: paints a hardcoded background color over
 * lines 0–4, the same range as the fold spike, so we can verify that
 * highlights survive folding and unfolding.
 */
export class HighlightProvider implements vscode.Disposable {
  /** One decoration type per color so they can be cleared independently. */
  private readonly _types: Map<string, vscode.TextEditorDecorationType> =
    new Map();

  /** Currently applied decorations: decorationType key → ranges. */
  private _active = false;

  constructor() {
    // Pre-create the four spike colors.
    this._types.set(
      "yellow",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 220, 0, 0.25)",
        isWholeLine: true,
      })
    );
    this._types.set(
      "green",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(0, 200, 80, 0.20)",
        isWholeLine: true,
      })
    );
    this._types.set(
      "red",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(220, 50, 50, 0.20)",
        isWholeLine: true,
      })
    );
    this._types.set(
      "blue",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(50, 120, 255, 0.20)",
        isWholeLine: true,
      })
    );
  }

  /**
   * Apply a highlight of the given color to lines 0–4 in the editor.
   * Clears any previous highlight first.
   */
  apply(editor: vscode.TextEditor, color: string): void {
    this.clear(editor);

    const type = this._types.get(color);
    if (!type) {
      vscode.window.showWarningMessage(
        `FoldNote spike: unknown color "${color}". Use yellow, green, red, or blue.`
      );
      return;
    }

    const ranges: vscode.Range[] = [];
    for (let i = 0; i <= 4; i++) {
      if (i < editor.document.lineCount) {
        ranges.push(editor.document.lineAt(i).range);
      }
    }

    editor.setDecorations(type, ranges);
    this._active = true;
  }

  /** Remove all highlight decorations from the editor. */
  clear(editor: vscode.TextEditor): void {
    for (const type of this._types.values()) {
      editor.setDecorations(type, []);
    }
    this._active = false;
  }

  get isActive(): boolean {
    return this._active;
  }

  dispose(): void {
    for (const type of this._types.values()) {
      type.dispose();
    }
    this._types.clear();
  }
}
