import * as vscode from "vscode";
import { registerHelloWorld } from "./commands/helloWorld";
import { registerSpikeCommands } from "./commands/spike";
import { registerSidebarCommands } from "./commands/sidebarCommands";
import { FoldNoteProvider } from "./providers/foldingProvider";
import { FoldNoteCodeLensProvider } from "./providers/codeLensProvider";
import { HighlightProvider } from "./providers/highlightProvider";
import { AnnotationTreeProvider } from "./views/annotationTreeProvider";
import { store } from "./storage/store";
import { RangeTracker } from "./storage/rangeTracker";

export function activate(context: vscode.ExtensionContext): void {
  console.log("FoldNote is now active.");

  // --- Chapter 2: load persisted annotations ---
  store.load(context);

  // --- Chapter 0: hello world ---
  registerHelloWorld(context);

  // --- Providers (created first so sidebar commands can reference them) ---
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

  // --- Chapter 5: sidebar ---
  const treeProvider = new AnnotationTreeProvider();
  const treeView = vscode.window.createTreeView("foldNote.annotationsView", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  registerSidebarCommands(
    context,
    treeProvider,
    treeView,
    highlightProvider,
    foldingProvider,
    codeLensProvider
  );

  treeProvider.refresh();

  // --- Chapter 4: range tracker ---
  const rangeTracker = new RangeTracker();

  // Refresh sidebar and CodeLens after every document change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {
      treeProvider.refresh();
      codeLensProvider.refresh();
      foldingProvider.refresh();
    })
  );

  // --- Chapter 1 spike commands ---
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
    rangeTracker,
    store
  );
}

export function deactivate(): Promise<void> {
  console.log("FoldNote deactivated.");
  return store.flush();
}
