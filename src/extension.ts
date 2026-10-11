import * as vscode from "vscode";
import { registerHelloWorld } from "./commands/helloWorld";
import { registerSpikeCommands } from "./commands/spike";
import { registerSidebarCommands } from "./commands/sidebarCommands";
import { FoldNoteProvider } from "./providers/foldingProvider";
import { FoldNoteCodeLensProvider } from "./providers/codeLensProvider";
import { HighlightProvider } from "./providers/highlightProvider";
import { AnnotationTreeProvider } from "./views/annotationTreeProvider";
import { store } from "./storage/store";

export function activate(context: vscode.ExtensionContext): void {
  console.log("FoldNote is now active.");

  // --- Chapter 2: load persisted annotations (non-blocking) ---
  store.load(context);

  // --- Chapter 0: hello world ---
  registerHelloWorld(context);

  // --- Chapter 5: sidebar (created first so spike commands can reference it) ---
  const treeProvider = new AnnotationTreeProvider();
  const treeView = vscode.window.createTreeView("foldNote.annotationsView", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  registerSidebarCommands(context, treeProvider, treeView);
  treeProvider.refresh();

  // --- Chapter 1 spike providers ---
  const foldingProvider = new FoldNoteProvider();
  const codeLensProvider = new FoldNoteCodeLensProvider();
  const highlightProvider = new HighlightProvider();

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { scheme: "file" },
      foldingProvider
    ),
    vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      codeLensProvider
    )
  );

  registerSpikeCommands(
    context,
    foldingProvider,
    codeLensProvider,
    highlightProvider,
    treeProvider
  );

  context.subscriptions.push(
    foldingProvider,
    codeLensProvider,
    highlightProvider,
    treeView,
    store
  );
}

export function deactivate(): Promise<void> {
  console.log("FoldNote deactivated.");
  return store.flush();
}
