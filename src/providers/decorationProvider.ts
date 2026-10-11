import * as vscode from "vscode";

/**
 * Draws a note label at the end of the fold start line.
 * Accepts a dynamic line number so it works with any range.
 */
export class DecorationProvider implements vscode.Disposable {
  private readonly _decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this._decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: "  📝 Spike note",
        color: new vscode.ThemeColor("descriptionForeground"),
        fontStyle: "italic",
      },
    });
  }

  /** Apply the note label to the end of `startLine` in the editor. */
  apply(editor: vscode.TextEditor, startLine: number): void {
    if (startLine >= editor.document.lineCount) {
      return;
    }
    const line = editor.document.lineAt(startLine);
    editor.setDecorations(this._decorationType, [
      new vscode.Range(line.range.end, line.range.end),
    ]);
  }

  /** Remove all note label decorations. */
  clear(editor: vscode.TextEditor): void {
    editor.setDecorations(this._decorationType, []);
  }

  dispose(): void {
    this._decorationType.dispose();
  }
}
