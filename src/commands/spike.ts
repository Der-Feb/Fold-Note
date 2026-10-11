import * as vscode from "vscode";
import { FoldNoteProvider } from "../providers/foldingProvider";
import { FoldNoteCodeLensProvider } from "../providers/codeLensProvider";
import { HighlightProvider, SPIKE_COLORS, SpikeColor } from "../providers/highlightProvider";
import { rangeFromSelection, rangeFromInput, ResolvedRange } from "../utils/rangeInput";

/**
 * Chapter 1 spike commands — four variants:
 *
 * foldNote.spikeFoldSelection      — fold the active selection
 * foldNote.spikeFoldInput          — fold a range typed by the user
 * foldNote.spikeHighlightSelection — highlight the active selection
 * foldNote.spikeHighlightInput     — highlight a range typed by the user
 * foldNote.spikeUnfold             — unfold and remove all spike decorations
 * foldNote.spikeClearHighlight     — remove highlight only
 * foldNote.spikeRefresh            — fire the folding provider change event
 * foldNote.spikeCodeLensClicked    — CodeLens click handler
 */
export function registerSpikeCommands(
  context: vscode.ExtensionContext,
  foldingProvider: FoldNoteProvider,
  codeLensProvider: FoldNoteCodeLensProvider,
  highlightProvider: HighlightProvider
): void {
  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  async function pickColor(): Promise<SpikeColor | undefined> {
    const pick = await vscode.window.showQuickPick([...SPIKE_COLORS], {
      placeHolder: "Pick a highlight color",
    });
    return pick as SpikeColor | undefined;
  }

  async function applyFold(
    editor: vscode.TextEditor,
    range: ResolvedRange
  ): Promise<void> {
    foldingProvider.activate(range.startLine, range.endLine);
    codeLensProvider.activateFolder(range.startLine, range.endLine);

    // Move cursor to the start line and fold targeting exactly our range
    const pos = new vscode.Position(range.startLine, 0);
    editor.selection = new vscode.Selection(pos, pos);
    await vscode.commands.executeCommand("editor.fold", {
      selectionLines: [range.startLine],
    });

    vscode.window.showInformationMessage(
      `FoldNote spike: folded lines ${range.startLine + 1}–${range.endLine + 1}. ✅`
    );
  }

  function applyHighlight(
    editor: vscode.TextEditor,
    range: ResolvedRange,
    color: SpikeColor
  ): void {
    highlightProvider.apply(editor, color, range.startLine, range.endLine);
    codeLensProvider.activateHighlight(range.startLine, range.endLine, color);

    vscode.window.showInformationMessage(
      `FoldNote spike: highlighted lines ${range.startLine + 1}–${range.endLine + 1} in ${color}. ✅`
    );
  }

  // ---------------------------------------------------------------------------
  // Fold — from selection
  // ---------------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "foldNote.spikeFoldSelection",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("FoldNote: open a file first.");
          return;
        }

        const result = rangeFromSelection(editor);
        if (typeof result === "string") {
          vscode.window.showWarningMessage(`FoldNote: ${result}`);
          return;
        }

        await applyFold(editor, result);
      }
    ),

    // -------------------------------------------------------------------------
    // Fold — from input
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.spikeFoldInput",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("FoldNote: open a file first.");
          return;
        }

        const result = await rangeFromInput(editor);
        if (result === undefined) {
          return; // cancelled
        }
        if (typeof result === "string") {
          vscode.window.showWarningMessage(`FoldNote: ${result}`);
          return;
        }

        await applyFold(editor, result);
      }
    ),

    // -------------------------------------------------------------------------
    // Highlight — from selection
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.spikeHighlightSelection",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("FoldNote: open a file first.");
          return;
        }

        const result = rangeFromSelection(editor);
        if (typeof result === "string") {
          vscode.window.showWarningMessage(`FoldNote: ${result}`);
          return;
        }

        const color = await pickColor();
        if (!color) {
          return; // cancelled
        }

        applyHighlight(editor, result, color);
      }
    ),

    // -------------------------------------------------------------------------
    // Highlight — from input
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.spikeHighlightInput",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("FoldNote: open a file first.");
          return;
        }

        const result = await rangeFromInput(editor);
        if (result === undefined) {
          return; // cancelled
        }
        if (typeof result === "string") {
          vscode.window.showWarningMessage(`FoldNote: ${result}`);
          return;
        }

        const color = await pickColor();
        if (!color) {
          return; // cancelled
        }

        applyHighlight(editor, result, color);
      }
    ),

    // -------------------------------------------------------------------------
    // Unfold — removes fold, label, and fold CodeLens
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand("foldNote.spikeUnfold", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      if (!foldingProvider.isActive) {
        vscode.window.showInformationMessage(
          "FoldNote: nothing is folded right now."
        );
        return;
      }

      const activeRange = foldingProvider.activeRange;
      if (activeRange) {
        const pos = new vscode.Position(activeRange.start, 0);
        editor.selection = new vscode.Selection(pos, pos);
      }

      await vscode.commands.executeCommand("editor.unfold");

      foldingProvider.clear();
      codeLensProvider.clearFolder();

      vscode.window.showInformationMessage(
        "FoldNote spike: unfolded, label and CodeLens removed. ✅"
      );
    }),

    // -------------------------------------------------------------------------
    // Clear highlight — removes highlight and highlight CodeLens
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand("foldNote.spikeClearHighlight", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      if (!highlightProvider.isActive) {
        vscode.window.showInformationMessage(
          "FoldNote: no highlight active right now."
        );
        return;
      }

      highlightProvider.clear(editor);
      codeLensProvider.clearHighlight();

      vscode.window.showInformationMessage(
        "FoldNote spike: highlight and CodeLens removed. ✅"
      );
    }),

    // -------------------------------------------------------------------------
    // Refresh folding ranges
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand("foldNote.spikeRefresh", () => {
      foldingProvider.refresh();
      vscode.window.showInformationMessage(
        "FoldNote spike: fired onDidChangeFoldingRanges. ✅"
      );
    }),

    // -------------------------------------------------------------------------
    // CodeLens click handler
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.spikeCodeLensClicked",
      (kind?: string) => {
        vscode.window.showInformationMessage(
          `FoldNote spike: ${kind ?? "annotation"} CodeLens clicked! Will open sidebar in a future chapter. ✅`
        );
      }
    )
  );
}
