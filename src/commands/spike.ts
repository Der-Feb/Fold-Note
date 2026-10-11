import * as vscode from "vscode";
import { FoldNoteProvider } from "../providers/foldingProvider";
import { DecorationProvider } from "../providers/decorationProvider";
import { FoldNoteCodeLensProvider } from "../providers/codeLensProvider";
import { HighlightProvider } from "../providers/highlightProvider";

const SPIKE_COLORS = ["yellow", "green", "red", "blue"];

/**
 * Chapter 1 spike commands.
 *
 * foldNote.spikeFold             — activates the range, folds it, draws the label, shows CodeLens.
 * foldNote.spikeUnfold           — clears the range, unfolds, removes label and CodeLens.
 * foldNote.spikeRefresh          — fires the provider change event to prove re-querying works.
 * foldNote.spikeCodeLensClicked  — triggered when the CodeLens is clicked.
 * foldNote.spikeHighlight        — highlights lines 1–5 with a chosen color.
 * foldNote.spikeClearHighlight   — removes all highlight decorations.
 */
export function registerSpikeCommands(
  context: vscode.ExtensionContext,
  foldingProvider: FoldNoteProvider,
  decorationProvider: DecorationProvider,
  codeLensProvider: FoldNoteCodeLensProvider,
  highlightProvider: HighlightProvider
): void {
  context.subscriptions.push(
    // -------------------------------------------------------------------------
    // Fold spike
    // -------------------------------------------------------------------------
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

      foldingProvider.activate();
      codeLensProvider.activateFolder();

      const pos = new vscode.Position(0, 0);
      editor.selection = new vscode.Selection(pos, pos);
      await vscode.commands.executeCommand("editor.fold");

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
      foldingProvider.clear();
      codeLensProvider.clearFolder();

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

    vscode.commands.registerCommand("foldNote.spikeCodeLensClicked", (kind?: string) => {
      vscode.window.showInformationMessage(
        `FoldNote spike: ${kind ?? "annotation"} CodeLens clicked! This will open the sidebar in future chapters. ✅`
      );
    }),

    // -------------------------------------------------------------------------
    // Highlight spike
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand("foldNote.spikeHighlight", async () => {
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

      const color = await vscode.window.showQuickPick(SPIKE_COLORS, {
        placeHolder: "Pick a highlight color for lines 1–5",
      });

      if (!color) {
        return; // cancelled
      }

      highlightProvider.apply(editor, color);
      codeLensProvider.activateHighlight(color);

      vscode.window.showInformationMessage(
        `FoldNote spike: highlighted lines 1–5 in ${color}. ✅`
      );
    }),

    vscode.commands.registerCommand("foldNote.spikeClearHighlight", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      highlightProvider.clear(editor);
      codeLensProvider.clearHighlight();
      vscode.window.showInformationMessage(
        "FoldNote spike: highlights cleared. ✅"
      );
    })
  );
}
