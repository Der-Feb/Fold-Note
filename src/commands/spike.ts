import * as vscode from "vscode";
import { FoldNoteProvider } from "../providers/foldingProvider";
import { DecorationProvider } from "../providers/decorationProvider";
import { FoldNoteCodeLensProvider } from "../providers/codeLensProvider";

/**
 * Chapter 1 spike commands.
 *
 * foldNote.spikeFold    — activates the range, folds it, draws the label, shows CodeLens.
 * foldNote.spikeUnfold  — clears the range, unfolds, removes label and CodeLens.
 * foldNote.spikeRefresh — fires the provider change event to prove re-querying works.
 * foldNote.spikeCodeLensClicked — triggered when the CodeLens is clicked.
 */
export function registerSpikeCommands(
  context: vscode.ExtensionContext,
  foldingProvider: FoldNoteProvider,
  decorationProvider: DecorationProvider,
  codeLensProvider: FoldNoteCodeLensProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("foldNote.spikeFold", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("FoldNote spike: open a file first.");
        return;
      }
      if (editor.document.lineCount < 5) {
        vscode.window.showWarningMessage(
          "FoldNote spike: file needs at least 5 lines."
        );
        return;
      }

      // 1. Register the range with the provider so VS Code knows it exists
      foldingProvider.activate();
      codeLensProvider.activate();

      // 2. Move cursor to line 0 and fold
      const pos = new vscode.Position(0, 0);
      editor.selection = new vscode.Selection(pos, pos);
      await vscode.commands.executeCommand("editor.fold");

      // 3. Draw the note label
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

      // 1. Unfold the code
      const pos = new vscode.Position(0, 0);
      editor.selection = new vscode.Selection(pos, pos);
      await vscode.commands.executeCommand("editor.unfold");

      // 2. Remove label, range, and CodeLens
      decorationProvider.clear(editor);
      foldingProvider.clear();
      codeLensProvider.clear();

      vscode.window.showInformationMessage(
        "FoldNote spike: unfolded, label and CodeLens removed. ✅"
      );
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
