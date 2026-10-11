import * as vscode from "vscode";
import * as path from "path";

/**
 * Convert a document URI to a workspace-relative path used as the store key.
 *
 * Single-root:  "src/utils.ts"
 * Multi-root:   "my-root/src/utils.ts"
 *
 * Returns an error string if the document is untitled or outside all
 * workspace folders.
 */
export function toWorkspacePath(
  uri: vscode.Uri
): string | { error: string } {
  // Block untitled (unsaved) documents
  if (uri.scheme === "untitled") {
    return {
      error:
        "FoldNote only works with saved files. Save this file first, then try again.",
    };
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return {
      error: "FoldNote requires an open workspace folder.",
    };
  }

  // Find the workspace folder that contains this file
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return {
      error: `This file is outside all workspace folders and cannot be annotated.`,
    };
  }

  const relative = path.posix.relative(
    folder.uri.path,
    uri.path
  );

  // In a multi-root workspace, prefix with the root folder name
  if (folders.length > 1) {
    return `${folder.name}/${relative}`;
  }

  return relative;
}

/**
 * Convenience: return the workspace path or show a warning and return undefined.
 */
export function toWorkspacePathOrWarn(
  uri: vscode.Uri
): string | undefined {
  const result = toWorkspacePath(uri);
  if (typeof result === "object") {
    vscode.window.showWarningMessage(result.error);
    return undefined;
  }
  return result;
}
