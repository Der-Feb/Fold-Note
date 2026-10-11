import * as vscode from "vscode";

export interface ResolvedRange {
  startLine: number;
  endLine: number;
}

/**
 * Resolves a range from the active editor's current selection.
 * Returns an error string if the selection is invalid.
 */
export function rangeFromSelection(
  editor: vscode.TextEditor
): ResolvedRange | string {
  const sel = editor.selection;

  // No selection or cursor only (start === end)
  if (sel.isEmpty) {
    return "No text selected. Select at least 2 lines first.";
  }

  const startLine = sel.start.line;
  // If the selection ends at column 0 of a new line, don't include that line
  const endLine =
    sel.end.character === 0 && sel.end.line > sel.start.line
      ? sel.end.line - 1
      : sel.end.line;

  if (startLine === endLine) {
    return "Only one line selected. Select at least 2 lines for a fold or highlight.";
  }

  return { startLine, endLine };
}

/**
 * Prompts the user to type a start and end line number.
 * Returns an error string if the input is invalid or cancelled.
 */
export async function rangeFromInput(
  editor: vscode.TextEditor
): Promise<ResolvedRange | string | undefined> {
  const totalLines = editor.document.lineCount;

  const startRaw = await vscode.window.showInputBox({
    prompt: `Start line (1–${totalLines})`,
    placeHolder: "e.g. 1",
    validateInput: (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1 || n > totalLines) {
        return `Enter a number between 1 and ${totalLines}`;
      }
      return undefined;
    },
  });

  if (startRaw === undefined) {
    return undefined; // cancelled
  }

  const endRaw = await vscode.window.showInputBox({
    prompt: `End line (${startRaw}–${totalLines})`,
    placeHolder: "e.g. 5",
    validateInput: (v) => {
      const n = parseInt(v, 10);
      const start = parseInt(startRaw, 10);
      if (isNaN(n) || n < start || n > totalLines) {
        return `Enter a number between ${startRaw} and ${totalLines}`;
      }
      return undefined;
    },
  });

  if (endRaw === undefined) {
    return undefined; // cancelled
  }

  const startLine = parseInt(startRaw, 10) - 1; // convert to 0-based
  const endLine = parseInt(endRaw, 10) - 1;

  if (startLine === endLine) {
    return "Start and end are the same line. Choose a range of at least 2 lines.";
  }

  return { startLine, endLine };
}
