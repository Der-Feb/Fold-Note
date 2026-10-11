import * as vscode from "vscode";
import { store } from "../storage/store";
import { AnnotationTreeProvider } from "../views/annotationTreeProvider";
import { FoldNoteProvider } from "../providers/foldingProvider";
import { FoldNoteCodeLensProvider } from "../providers/codeLensProvider";
import { checkOverlap, overlapMessage } from "../model/overlapChecker";
import { toWorkspacePathOrWarn } from "../utils/filePath";
import { generateId } from "../utils/uuid";
import { makeLineRange } from "../model/annotation";
import { computeAnchorHash } from "../utils/anchorHash";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a selection to whole lines. Trims end if it lands at column 0. */
function normalizeToLines(
  sel: vscode.Selection,
  doc: vscode.TextDocument
): { startLine: number; endLine: number } | string {
  // Reject multiple selections
  if (
    vscode.window.activeTextEditor &&
    vscode.window.activeTextEditor.selections.length > 1
  ) {
    return "Select a single contiguous range — multiple selections are not supported.";
  }

  if (sel.isEmpty) {
    return "No text selected. Select at least 2 lines first.";
  }

  const startLine = sel.start.line;
  const endLine =
    sel.end.character === 0 && sel.end.line > sel.start.line
      ? sel.end.line - 1
      : sel.end.line;

  if (startLine === endLine) {
    return "Select at least 2 lines to fold.";
  }

  if (endLine >= doc.lineCount) {
    return "Selection extends beyond the end of the file.";
  }

  return { startLine, endLine };
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

export function registerFoldCommands(
  context: vscode.ExtensionContext,
  foldingProvider: FoldNoteProvider,
  codeLensProvider: FoldNoteCodeLensProvider,
  treeProvider: AnnotationTreeProvider
): void {
  context.subscriptions.push(
    // -------------------------------------------------------------------------
    // foldNote.foldSelection — Fold Selection with Note
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.foldSelection",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("FoldNote: open a file first.");
          return;
        }

        const filePath = toWorkspacePathOrWarn(editor.document.uri);
        if (!filePath) {
          return;
        }

        // Normalize selection
        const normalized = normalizeToLines(editor.selection, editor.document);
        if (typeof normalized === "string") {
          vscode.window.showWarningMessage(`FoldNote: ${normalized}`);
          return;
        }
        const { startLine, endLine } = normalized;
        const proposed = makeLineRange(startLine, endLine);

        // Overlap check
        const existing = store.getByFile(filePath);
        const overlapResult = checkOverlap(proposed, existing);
        const errorMsg = overlapMessage(overlapResult);
        if (errorMsg) {
          const conflicting =
            overlapResult.kind === "identical" || overlapResult.kind === "partial"
              ? overlapResult.existing
              : undefined;

          const actions = conflicting ? ["Reveal"] : [];
          const choice = await vscode.window.showWarningMessage(
            `FoldNote: ${errorMsg}`,
            ...actions
          );
          if (choice === "Reveal" && conflicting) {
            await vscode.commands.executeCommand(
              "foldNote.revealAnnotation",
              conflicting
            );
          }
          return;
        }

        // Prompt for note
        const note = await vscode.window.showInputBox({
          prompt: `Note for fold L${startLine + 1}–${endLine + 1} (leave empty for session-only)`,
          placeHolder: "e.g. Auth helper logic",
        });
        if (note === undefined) {
          return; // cancelled
        }

        const persist = note.trim().length > 0;

        // Register range with folding provider and fold
        foldingProvider.refresh();
        const pos = new vscode.Position(startLine, 0);
        editor.selection = new vscode.Selection(pos, pos);
        await vscode.commands.executeCommand("editor.fold", {
          selectionLines: [startLine],
        });

        if (persist) {
          const anchorLine = editor.document.lineAt(startLine).text;
          const now = new Date().toISOString();
          store.add({
            id: generateId(),
            filePath,
            range: proposed,
            kind: "folder",
            note: note.trim(),
            anchorHash: computeAnchorHash(anchorLine),
            status: "active",
            createdAt: now,
            updatedAt: now,
          });
          treeProvider.refresh();
          codeLensProvider.refresh();
          vscode.window.showInformationMessage(
            `FoldNote: folded L${startLine + 1}–${endLine + 1} — "${note.trim()}". ✅`
          );
        } else {
          vscode.window.showInformationMessage(
            `FoldNote: session fold L${startLine + 1}–${endLine + 1} (no note — will not be saved).`
          );
        }
      }
    ),

    // -------------------------------------------------------------------------
    // foldNote.unfoldAtCursor — Unfold the folder whose range contains the cursor
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.unfoldAtCursor",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const filePath = toWorkspacePathOrWarn(editor.document.uri);
        if (!filePath) {
          return;
        }

        const cursorLine = editor.selection.active.line;
        const annotations = store.getByFile(filePath);
        const folder = annotations.find(
          (a) =>
            a.kind === "folder" &&
            a.range.start.line <= cursorLine &&
            a.range.end.line >= cursorLine
        );

        if (!folder) {
          vscode.window.showInformationMessage(
            "FoldNote: no folder found at the cursor position."
          );
          return;
        }

        const pos = new vscode.Position(folder.range.start.line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        await vscode.commands.executeCommand("editor.unfold");

        // Keep the record — do not remove from store
        treeProvider.refresh();
        vscode.window.showInformationMessage(
          `FoldNote: unfolded "${folder.note}". Record kept.`
        );
      }
    ),

    // -------------------------------------------------------------------------
    // foldNote.toggleAllNotes — show/hide all CodeLenses in the active file
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand("foldNote.toggleAllNotes", () => {
      codeLensProvider.toggleVisibility();
      const state = codeLensProvider.isVisible ? "shown" : "hidden";
      vscode.window.showInformationMessage(
        `FoldNote: CodeLens indicators ${state}.`
      );
    }),

    // -------------------------------------------------------------------------
    // foldNote.refreshRanges — re-validate ranges for the active file
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand("foldNote.refreshRanges", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const filePath = toWorkspacePathOrWarn(editor.document.uri);
      if (!filePath) {
        return;
      }

      const annotations = store.getByFile(filePath);
      let refreshed = 0;

      for (const ann of annotations) {
        if (ann.status === "drifted") {
          const line = editor.document.lineAt(
            Math.min(ann.range.start.line, editor.document.lineCount - 1)
          ).text;
          const currentHash = computeAnchorHash(line);
          if (currentHash === ann.anchorHash) {
            store.update(ann.id, { status: "active" });
            refreshed++;
          }
        }
      }

      treeProvider.refresh();
      codeLensProvider.refresh();
      foldingProvider.refresh();

      vscode.window.showInformationMessage(
        refreshed > 0
          ? `FoldNote: ${refreshed} annotation(s) cleared of drift flag.`
          : "FoldNote: ranges re-validated. No changes."
      );
    }),

    // -------------------------------------------------------------------------
    // foldNote.codeLensClicked — opens sidebar and reveals annotation by ID
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.codeLensClicked",
      async (annId: string) => {
        await vscode.commands.executeCommand(
          "workbench.view.extension.foldNote"
        );
        if (annId) {
          const ann = store.getById(annId);
          if (ann) {
            await vscode.commands.executeCommand(
              "foldNote.revealAnnotation",
              ann
            );
          }
        }
      }
    ),

    // -------------------------------------------------------------------------
    // foldNote.clearAllData — remove all annotations with confirmation
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand("foldNote.clearAllData", async () => {
      const choice = await vscode.window.showWarningMessage(
        "FoldNote: This will permanently delete ALL annotations for this workspace. Are you sure?",
        { modal: true },
        "Delete All"
      );
      if (choice === "Delete All") {
        store.clearAll();
        treeProvider.refresh();
        codeLensProvider.refresh();
        foldingProvider.refresh();
        vscode.window.showInformationMessage(
          "FoldNote: all annotations deleted."
        );
      }
    })
  );
}
