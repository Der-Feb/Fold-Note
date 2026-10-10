import * as vscode from "vscode";
import { registerHelloWorld } from "./commands/helloWorld";
import { registerSpikeCommands } from "./commands/spike";
import { FoldNoteProvider } from "./providers/foldingProvider";
import { DecorationProvider } from "./providers/decorationProvider";
import { FoldNoteCodeLensProvider } from "./providers/codeLensProvider";

export function activate(context: vscode.ExtensionContext): void {
  console.log("FoldNote is now active.");

  // --- Chapter 0: hello world ---
  registerHelloWorld(context);

  // --- Chapter 1 spike ---
  const foldingProvider = new FoldNoteProvider();
  const decorationProvider = new DecorationProvider();
  const codeLensProvider = new FoldNoteCodeLensProvider();

  // Register the folding range provider for all languages
  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { scheme: "file" },
      foldingProvider
    )
  );

  // Register the CodeLens provider for all languages
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      codeLensProvider
    )
  );

  // Re-apply decorations when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        decorationProvider.apply(editor);
      }
    })
  );

  // Apply decoration to the already-open editor on activation
  if (vscode.window.activeTextEditor) {
    decorationProvider.apply(vscode.window.activeTextEditor);
  }

  // Register spike commands
  registerSpikeCommands(context, foldingProvider, decorationProvider, codeLensProvider);

  // Dispose providers on deactivation
  context.subscriptions.push(foldingProvider, decorationProvider, codeLensProvider);
}

export function deactivate(): void {
  console.log("FoldNote deactivated.");
}
