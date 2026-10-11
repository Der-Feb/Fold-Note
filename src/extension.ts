import * as vscode from "vscode";
import { registerHelloWorld } from "./commands/helloWorld";
import { registerSpikeCommands } from "./commands/spike";
import { FoldNoteProvider } from "./providers/foldingProvider";
import { DecorationProvider } from "./providers/decorationProvider";
import { FoldNoteCodeLensProvider } from "./providers/codeLensProvider";
import { HighlightProvider } from "./providers/highlightProvider";

export function activate(context: vscode.ExtensionContext): void {
  console.log("FoldNote is now active.");

  // --- Chapter 0: hello world ---
  registerHelloWorld(context);

  // --- Chapter 1 spike ---
  const foldingProvider = new FoldNoteProvider();
  const decorationProvider = new DecorationProvider();
  const codeLensProvider = new FoldNoteCodeLensProvider();
  const highlightProvider = new HighlightProvider();

  // Folding range provider for all file-scheme documents
  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { scheme: "file" },
      foldingProvider
    )
  );

  // CodeLens provider for all file-scheme documents
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      codeLensProvider
    )
  );

  // Re-apply decorations when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && foldingProvider.isActive) {
        decorationProvider.apply(editor);
      }
    })
  );

  // Apply decoration to the already-open editor on activation only if a fold is active
  if (vscode.window.activeTextEditor && foldingProvider.isActive) {
    decorationProvider.apply(vscode.window.activeTextEditor);
  }

  // Register all spike commands
  registerSpikeCommands(
    context,
    foldingProvider,
    decorationProvider,
    codeLensProvider,
    highlightProvider
  );

  // Dispose providers cleanly on deactivation
  context.subscriptions.push(
    foldingProvider,
    decorationProvider,
    codeLensProvider,
    highlightProvider
  );
}

export function deactivate(): void {
  console.log("FoldNote deactivated.");
}
