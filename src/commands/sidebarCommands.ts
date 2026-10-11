import * as vscode from "vscode";
import { Annotation } from "../model/annotation";
import { store } from "../storage/store";
import { AnnotationTreeProvider, AnnotationItem } from "../views/annotationTreeProvider";

/**
 * Commands that interact with the sidebar tree view.
 *
 * foldNote.refreshView      — manually refresh the tree
 * foldNote.revealAnnotation — jump to an annotation in the editor
 * foldNote.deleteAnnotation — remove an annotation from the store
 * foldNote.unfoldAnnotation — unfold a folder (keeps the record)
 */
export function registerSidebarCommands(
  context: vscode.ExtensionContext,
  treeProvider: AnnotationTreeProvider,
  treeView: vscode.TreeView<vscode.TreeItem>
): void {
  context.subscriptions.push(
    // -------------------------------------------------------------------------
    // Refresh
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand("foldNote.refreshView", () => {
      treeProvider.refresh();
    }),

    // -------------------------------------------------------------------------
    // Reveal — open file and move cursor to annotation start
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.revealAnnotation",
      async (annotation: Annotation) => {
        if (!annotation) {
          return;
        }

        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
          return;
        }

        // Resolve the absolute URI from the workspace-relative path
        let uri: vscode.Uri | undefined;
        for (const folder of folders) {
          const candidate = vscode.Uri.joinPath(
            folder.uri,
            annotation.filePath.startsWith(folder.name + "/")
              ? annotation.filePath.slice(folder.name.length + 1)
              : annotation.filePath
          );
          try {
            await vscode.workspace.fs.stat(candidate);
            uri = candidate;
            break;
          } catch {
            // not this folder
          }
        }

        if (!uri) {
          vscode.window.showWarningMessage(
            `FoldNote: could not find file "${annotation.filePath}".`
          );
          return;
        }

        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);

        const line = Math.min(
          annotation.range.start.line,
          doc.lineCount - 1
        );
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter
        );
      }
    ),

    // -------------------------------------------------------------------------
    // Delete — remove from store and refresh
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.deleteAnnotation",
      (item: AnnotationItem | Annotation) => {
        const annotation =
          item instanceof AnnotationItem ? item.annotation : item;
        if (!annotation) {
          return;
        }

        store.remove(annotation.id);
        treeProvider.refresh();

        vscode.window.showInformationMessage(
          `FoldNote: deleted "${annotation.note || "annotation"}".`
        );
      }
    ),

    // -------------------------------------------------------------------------
    // Unfold — expand the code but keep the annotation record
    // -------------------------------------------------------------------------
    vscode.commands.registerCommand(
      "foldNote.unfoldAnnotation",
      async (item: AnnotationItem | Annotation) => {
        const annotation =
          item instanceof AnnotationItem ? item.annotation : item;
        if (!annotation || annotation.kind !== "folder") {
          return;
        }

        // Reveal the file first
        await vscode.commands.executeCommand(
          "foldNote.revealAnnotation",
          annotation
        );

        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const pos = new vscode.Position(annotation.range.start.line, 0);
          editor.selection = new vscode.Selection(pos, pos);
          await vscode.commands.executeCommand("editor.unfold");
        }

        treeProvider.refresh();
        vscode.window.showInformationMessage(
          `FoldNote: unfolded "${annotation.note}". Record kept.`
        );
      }
    )
  );
}
