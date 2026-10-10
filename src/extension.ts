import * as vscode from "vscode";
import { registerHelloWorld } from "./commands/helloWorld";

export function activate(context: vscode.ExtensionContext): void {
  console.log("FoldNote is now active.");

  registerHelloWorld(context);
}

export function deactivate(): void {
  console.log("FoldNote deactivated.");
}
