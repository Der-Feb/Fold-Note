import * as vscode from "vscode";
import { FoldNoteProvider } from "../providers/foldingProvider";
import { FoldNoteCodeLensProvider } from "../providers/codeLensProvider";
import { HighlightProvider, SPIKE_COLORS, SpikeColor } from "../providers/highlightProvider";
import { rangeFromSelection, rangeFromInput, ResolvedRange } from "../utils/rangeInput";
import { store } from "../storage/store";
import { AnnotationTreeProvider } from "../views/annotationTreeProvider";
import { toWorkspacePathOrWarn } from "../utils/filePath";
import { generateId } from "../utils/uuid";
import { makeLineRange } from "../model/annotation";

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
  highlightProvider: HighlightProvider,
  treeProvider: AnnotationTreeProvider
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
    const filePath = toWorkspacePathOrWarn(editor.document.uri);
    if (!filePath) {
      return;
    }

    // Prompt for a note (required)
    const note = await vscode.window.showInputBox({
      prompt: `Note for fold L${range.startLine + 1}–${range.endLine + 1}`,
      placeHolder: "e.g. Auth helper logic",
      validateInput: (v) =>
        v.trim().length === 0 ? "Note cannot be empty." : undefined,
    });
    if (note === undefined) {
      return; // cancelled
    }

    foldingProvider.activate(range.startLine, range.endLine);
    codeLensProvider.activateFolder(range.startLine, range.endLine);

    const pos = new vscode.Position(range.startLine, 0);
    editor.selection = new vscode.Selection(pos, pos);
    await vscode.commands.executeCommand("editor.fold", {
      selectionLines: [range.startLine],
    });

    const now = new Date().toISOString();
    store.add({
      id: generateId(),
      filePath,
      range: makeLineRange(range.startLine, range.endLine),
      kind: "folder",
      note: note.trim(),
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    treeProvider.refresh();

    vscode.window.showInformationMessage(
      `FoldNote: folded L${range.startLine + 1}–${range.endLine + 1} — "${note.trim()}". ✅`
    );
  }

  function applyHighlight(
    editor: vscode.TextEditor,
    range: ResolvedRange,
    color: SpikeColor,
    note: string
  ): void {
    const filePath = toWorkspacePathOrWarn(editor.document.uri);
    if (!filePath) {
      return;
    }

    highlightProvider.apply(editor, color, range.startLine, range.endLine);
    codeLensProvider.activateHighlight(range.startLine, range.endLine, color);

    const now = new Date().toISOString();
    store.add({
      id: generateId(),
      filePath,
      range: makeLineRange(range.startLine, range.endLine),
      kind: "highlight",
      note: note.trim(),
      color,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    treeProvider.refresh();

    vscode.window.showInformationMessage(
      `FoldNote: highlighted L${range.startLine + 1}–${range.endLine + 1} in ${color}${note ? ` — "${note.trim()}"` : ""}. ✅`
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

        const note = await vscode.window.showInputBox({
          prompt: "Add a note (optional)",
          placeHolder: "e.g. Important section",
        });
        if (note === undefined) {
          return; // cancelled
        }

        applyHighlight(editor, result, color, note);
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

        const note = await vscode.window.showInputBox({
          prompt: "Add a note (optional)",
          placeHolder: "e.g. Important section",
        });
        if (note === undefined) {
          return; // cancelled
        }

        applyHighlight(editor, result, color, note);
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

      // Remove spike fold annotations from store for this file
      const editor2 = vscode.window.activeTextEditor;
      if (editor2) {
        const filePath = toWorkspacePathOrWarn(editor2.document.uri);
        if (filePath) {
          const toRemove = store
            .getByFile(filePath)
            .filter((a) => a.kind === "folder" && a.note.startsWith("Spike fold"));
          toRemove.forEach((a) => store.remove(a.id));
          treeProvider.refresh();
        }
      }

      vscode.window.showInformationMessage(
        "FoldNote spike: unfolded, CodeLens removed. ✅"
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

      // Remove spike highlight annotations from store for this file
      const filePath = toWorkspacePathOrWarn(editor.document.uri);
      if (filePath) {
        const toRemove = store
          .getByFile(filePath)
          .filter((a) => a.kind === "highlight" && a.note.startsWith("Spike highlight"));
        toRemove.forEach((a) => store.remove(a.id));
        treeProvider.refresh();
      }

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
    // CodeLens click handler — opens the sidebar
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.spikeCodeLensClicked",
      async (kind?: string) => {
        // Open the FoldNote sidebar
        await vscode.commands.executeCommand(
          "workbench.view.extension.foldNote"
        );
        vscode.window.showInformationMessage(
          `FoldNote: opened sidebar from ${kind ?? "annotation"} CodeLens. ✅`
        );
      }
    )
  );
}
