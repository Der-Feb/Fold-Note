import * as vscode from "vscode";

/**
 * Chapter 1 spike: draws a hardcoded note label at the end of line 0
 * (the first line of our hardcoded folded range) using a decoration.
 */
export class DecorationProvider implements vscode.Disposable {
  private readonly _decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this._decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: "  📝 Hardcoded spike note",
        color: new vscode.ThemeColor("descriptionForeground"),
        fontStyle: "italic",
      },
    });
  }

  /** Apply the spike decoration to the given editor. */
  apply(editor: vscode.TextEditor): void {
    // Decorate the end of line 0 (the fold start line)
    const line = editor.document.lineAt(0);
    const range = new vscode.Range(
      line.range.end,
      line.range.end
    );
    editor.setDecorations(this._decorationType, [range]);
  }

  /** Remove all decorations from the given editor. */
  clear(editor: vscode.TextEditor): void {
    editor.setDecorations(this._decorationType, []);
  }

  dispose(): void {
    this._decorationType.dispose();
  }
}
