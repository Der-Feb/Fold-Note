import * as vscode from "vscode";
import { store } from "../storage/store";
import { FoldNoteProvider } from "../providers/foldingProvider";
import { FoldNoteCodeLensProvider } from "../providers/codeLensProvider";
import { HighlightProvider } from "../providers/highlightProvider";
import { AnnotationTreeProvider } from "../views/annotationTreeProvider";
import { toWorkspacePathOrWarn } from "../utils/filePath";
import { generateId } from "../utils/uuid";
import { makeLineRange } from "../model/annotation";
import { checkOverlap } from "../model/overlapChecker";
import { computeAnchorHash } from "../storage/rangeTracker";

/**
 * Registers the real fold/unfold commands for FoldNote (Chapters 3 & 4).
 *
 * foldNote.foldSelection   — fold a selection with an optional note
 * foldNote.unfoldAtCursor  — unfold the fold at the cursor (keeps record)
 * foldNote.toggleAllNotes  — toggle CodeLens visibility for the active file
 * foldNote.refreshRanges   — re-validate drift for the active file
 * foldNote.codeLensClicked — CodeLens click: open sidebar + reveal annotation
 */
export function registerFoldCommands(
  context: vscode.ExtensionContext,
  foldingProvider: FoldNoteProvider,
  codeLensProvider: FoldNoteCodeLensProvider,
  _highlightProvider: HighlightProvider,
  treeProvider: AnnotationTreeProvider
): void {
  context.subscriptions.push(
    // -------------------------------------------------------------------------
    // foldNote.foldSelection — fold the current selection with a note
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.foldSelection",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("FoldNote: open a file first.");
          return;
        }

        // Reject multiple selections
        if (editor.selections.length > 1) {
          vscode.window.showWarningMessage(
            "FoldNote: Select a single contiguous range."
          );
          return;
        }

        const sel = editor.selection;

        // Normalize to whole lines:
        // If end is at column 0 and not the same line as start, exclude that line.
        let startLine = sel.start.line;
        let endLine = sel.end.line;
        if (sel.end.character === 0 && endLine > startLine) {
          endLine = endLine - 1;
        }

        // Reject single-line selections
        if (endLine <= startLine) {
          vscode.window.showWarningMessage(
            "FoldNote: Select at least 2 lines to fold."
          );
          return;
        }

        // Reject untitled files
        const filePath = toWorkspacePathOrWarn(editor.document.uri);
        if (!filePath) {
          return;
        }

        // Overlap check
        const proposedRange = makeLineRange(startLine, endLine);
        const existing = store.getByFile(filePath);
        const overlapResult = checkOverlap(proposedRange, existing);

        if (
          overlapResult.kind === "identical" ||
          overlapResult.kind === "partial"
        ) {
          const conflictAnn =
            overlapResult.kind === "identical"
              ? overlapResult.existing
              : overlapResult.existing;

          const conflictNote = conflictAnn.note || "(no note)";
          const conflictStart = conflictAnn.range.start.line + 1;
          const conflictEnd = conflictAnn.range.end.line + 1;

          const message =
            overlapResult.kind === "identical"
              ? `FoldNote: A folder already covers exactly this range — "${conflictNote}" (L${conflictStart}–${conflictEnd}).`
              : `FoldNote: This range partially overlaps with "${conflictNote}" (L${conflictStart}–${conflictEnd}). Folders must nest cleanly.`;

          const choice = await vscode.window.showWarningMessage(
            message,
            "Reveal"
          );
          if (choice === "Reveal") {
            await vscode.commands.executeCommand(
              "foldNote.revealAnnotation",
              conflictAnn
            );
          }
          return;
        }

        // Prompt for a note (empty = session-only, not persisted)
        const note = await vscode.window.showInputBox({
          prompt: `Note for fold L${startLine + 1}–${endLine + 1} (leave empty for session-only)`,
          placeHolder: "e.g. Auth helper logic",
        });
        if (note === undefined) {
          return; // user cancelled
        }

        // Compute anchor hash from the first line of the selection
        const anchorLine = editor.document.lineAt(startLine).text;
        const anchorHash = computeAnchorHash(anchorLine);

        // Apply the fold visually
        foldingProvider.refresh(); // let the provider pick up the store entry below
        const pos = new vscode.Position(startLine, 0);
        editor.selection = new vscode.Selection(pos, pos);
        await vscode.commands.executeCommand("editor.fold", {
          selectionLines: [startLine],
        });

        if (note.trim().length > 0) {
          // Has note → persist to store
          const now = new Date().toISOString();
          store.add({
            id: generateId(),
            filePath,
            range: makeLineRange(startLine, endLine),
            kind: "folder",
            note: note.trim(),
            anchorHash,
            status: "active",
            createdAt: now,
            updatedAt: now,
          });
          foldingProvider.refresh();
          codeLensProvider.refresh();
          treeProvider.refresh();

          vscode.window.showInformationMessage(
            `FoldNote: folded L${startLine + 1}–${endLine + 1} — "${note.trim()}". ✅`
          );
        } else {
          // Empty note → session-only fold, nothing saved
          // Use the spike activate so the fold range is known
          foldingProvider.activate(startLine, endLine);
          vscode.window.showInformationMessage(
            `FoldNote: folded L${startLine + 1}–${endLine + 1} (session-only, no note saved).`
          );
        }
      }
    ),

    // -------------------------------------------------------------------------
    // foldNote.unfoldAtCursor — unfold the annotation at the cursor
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.unfoldAtCursor",
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

        const cursorLine = editor.selection.active.line;
        const annotations = store.getByFile(filePath);

        // Find the innermost folder containing the cursor
        const matching = annotations
          .filter(
            (ann) =>
              ann.kind === "folder" &&
              ann.range.start.line <= cursorLine &&
              ann.range.end.line >= cursorLine
          )
          .sort(
            (a, b) =>
              // prefer innermost (smallest range)
              b.range.start.line - a.range.start.line ||
              a.range.end.line - b.range.end.line
          );

        if (matching.length === 0) {
          vscode.window.showInformationMessage(
            "FoldNote: no folded annotation at cursor."
          );
          return;
        }

        const ann = matching[0];
        const foldPos = new vscode.Position(ann.range.start.line, 0);
        editor.selection = new vscode.Selection(foldPos, foldPos);
        await vscode.commands.executeCommand("editor.unfold");

        // Keep the record in store — do NOT delete
        treeProvider.refresh();

        vscode.window.showInformationMessage(
          `FoldNote: unfolded "${ann.note || "(no note)"}". Record kept.`
        );
      }
    ),

    // -------------------------------------------------------------------------
    // foldNote.toggleAllNotes — toggle CodeLens visibility for active file
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.toggleAllNotes",
      () => {
        codeLensProvider.toggleVisibility();
        const nowVisible = codeLensProvider.isVisible;
        vscode.window.showInformationMessage(
          `FoldNote: CodeLens notes ${nowVisible ? "shown" : "hidden"}.`
        );
      }
    ),

    // -------------------------------------------------------------------------
    // foldNote.refreshRanges — re-validate drift for the active file
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.refreshRanges",
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

        const annotations = store.getByFile(filePath);
        let revalidated = 0;

        for (const ann of annotations) {
          if (ann.status === "drifted" && ann.anchorHash) {
            const startLine = ann.range.start.line;
            if (startLine < editor.document.lineCount) {
              const currentHash = computeAnchorHash(
                editor.document.lineAt(startLine).text
              );
              if (currentHash === ann.anchorHash) {
                store.update(ann.id, { status: "active" });
                revalidated++;
              }
            }
          }
        }

        treeProvider.refresh();
        codeLensProvider.refresh();

        vscode.window.showInformationMessage(
          revalidated > 0
            ? `FoldNote: cleared drift on ${revalidated} annotation(s).`
            : "FoldNote: no drifted annotations to clear."
        );
      }
    ),

    // -------------------------------------------------------------------------
    // foldNote.codeLensClicked — CodeLens click handler (real commands)
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.codeLensClicked",
      async (annId: string) => {
        // Open the FoldNote sidebar
        await vscode.commands.executeCommand(
          "workbench.view.extension.foldNote"
        );

        // Reveal the annotation in the sidebar by looking it up by ID
        const ann = store.getById(annId);
        if (ann) {
          await vscode.commands.executeCommand(
            "foldNote.revealAnnotation",
            ann
          );
        }
      }
    )
  );
}
