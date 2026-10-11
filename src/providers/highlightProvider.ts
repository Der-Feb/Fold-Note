import * as vscode from "vscode";

export const SPIKE_COLORS = ["yellow", "green", "red", "blue"] as const;
export type SpikeColor = (typeof SPIKE_COLORS)[number];

const COLOR_MAP: Record<SpikeColor, string> = {
  yellow: "rgba(255, 220, 0, 0.25)",
  green:  "rgba(0, 200, 80, 0.20)",
  red:    "rgba(220, 50, 50, 0.20)",
  blue:   "rgba(50, 120, 255, 0.20)",
};

/**
 * Applies background-color highlights to a dynamic range.
 * Works with any start/end line coming from a selection or manual input.
 */
export class HighlightProvider implements vscode.Disposable {
  private readonly _types: Map<SpikeColor, vscode.TextEditorDecorationType> =
    new Map();

  private _activeColor: SpikeColor | undefined;

  constructor() {
    for (const color of SPIKE_COLORS) {
      this._types.set(
        color,
        vscode.window.createTextEditorDecorationType({
          backgroundColor: COLOR_MAP[color],
          isWholeLine: true,
        })
      );
    }
  }

  /**
   * Apply a highlight of the given color from startLine to endLine (inclusive).
   * Clears any existing highlight first.
   */
  apply(
    editor: vscode.TextEditor,
    color: SpikeColor,
    startLine: number,
    endLine: number
  ): void {
    this.clear(editor);

    const type = this._types.get(color);
    if (!type) {
      return;
    }

    const ranges: vscode.Range[] = [];
    for (let i = startLine; i <= endLine; i++) {
      if (i < editor.document.lineCount) {
        ranges.push(editor.document.lineAt(i).range);
      }
    }

    editor.setDecorations(type, ranges);
    this._activeColor = color;
  }

  /** Remove all highlight decorations. */
  clear(editor: vscode.TextEditor): void {
    for (const type of this._types.values()) {
      editor.setDecorations(type, []);
    }
    this._activeColor = undefined;
  }

  get isActive(): boolean {
    return this._activeColor !== undefined;
  }

  get activeColor(): SpikeColor | undefined {
    return this._activeColor;
  }

  dispose(): void {
    for (const type of this._types.values()) {
      type.dispose();
    }
    this._types.clear();
  }
}
