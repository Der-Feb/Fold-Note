import * as vscode from "vscode";
import { FoldNoteProvider } from "../providers/foldingProvider";
import { DecorationProvider } from "../providers/decorationProvider";

/**
 * Chapter 1 spike commands:
 *
 * foldNote.spikeFold   — folds lines 1–5 using the built-in fold command,
 *                        then draws the note decoration.
 * foldNote.spikeUnfold — unfolds and clears the decoration.
 * foldNote.spikeRefresh — fires the provider change event so VS Code
 *                         re-queries folding ranges (proves the event works).
 * foldNote.spikeCodeLensClicked — triggered when the CodeLens is clicked.
 */
export function registerSpikeCommands(
  context: vscode.ExtensionContext,
  foldingProvider: FoldNoteProvider,
  decorationProvider: DecorationProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("foldNote.spikeFold", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("FoldNote spike: open a file first.");
        return;
      }

      // Move cursor to line 0 so the built-in fold targets our range
      const pos = new vscode.Position(0, 0);
      editor.selection = new vscode.Selection(pos, pos);

      // Built-in fold command folds the range that starts at the cursor line
      await vscode.commands.executeCommand("editor.fold");

      // Draw the note label
      decorationProvider.apply(editor);

      vscode.window.showInformationMessage(
        "FoldNote spike: folded lines 1–5 with note label. ✅"
      );
    }),

    vscode.commands.registerCommand("foldNote.spikeUnfold", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const pos = new vscode.Position(0, 0);
      editor.selection = new vscode.Selection(pos, pos);

      await vscode.commands.executeCommand("editor.unfold");
      decorationProvider.clear(editor);

      vscode.window.showInformationMessage("FoldNote spike: unfolded. ✅");
    }),

    vscode.commands.registerCommand("foldNote.spikeRefresh", () => {
      foldingProvider.refresh();
      vscode.window.showInformationMessage(
        "FoldNote spike: fired onDidChangeFoldingRanges — VS Code will re-query ranges. ✅"
      );
    }),

    vscode.commands.registerCommand("foldNote.spikeCodeLensClicked", () => {
      vscode.window.showInformationMessage(
        "FoldNote spike: CodeLens clicked! This will open the sidebar in future chapters. ✅"
      );
    })
  );
}
