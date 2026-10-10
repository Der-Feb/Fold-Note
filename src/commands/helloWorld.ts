import * as vscode from "vscode";

export function registerHelloWorld(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "foldNote.helloWorld",
    () => {
      vscode.window.showInformationMessage("FoldNote is alive! 📝");
    }
  );

  context.subscriptions.push(disposable);
}
