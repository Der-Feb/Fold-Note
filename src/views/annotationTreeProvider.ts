import * as vscode from "vscode";
import { Annotation } from "../model/annotation";
import { store } from "../storage/store";

// ---------------------------------------------------------------------------
// Tree item types
// ---------------------------------------------------------------------------

export class FileItem extends vscode.TreeItem {
  readonly kind = "file" as const;

  constructor(
    public readonly filePath: string,
    public readonly annotations: Annotation[],
    public readonly orphaned = false
  ) {
    super(filePath, vscode.TreeItemCollapsibleState.Expanded);
    if (orphaned) {
      this.description = "file not found";
      this.iconPath = new vscode.ThemeIcon(
        "error",
        new vscode.ThemeColor("list.errorForeground")
      );
      this.contextValue = "foldNote.orphanedFile";
    } else {
      this.description = `${annotations.length} annotation${annotations.length !== 1 ? "s" : ""}`;
      this.iconPath = new vscode.ThemeIcon("file");
      this.contextValue = "foldNote.file";
    }
  }
}

export class AnnotationItem extends vscode.TreeItem {
  readonly kind = "annotation" as const;

  constructor(
    public readonly annotation: Annotation,
    collapsible = vscode.TreeItemCollapsibleState.None
  ) {
    super(AnnotationItem._label(annotation), collapsible);

    this.description = AnnotationItem._description(annotation);
    this.iconPath = AnnotationItem._icon(annotation);
    this.tooltip = AnnotationItem._tooltip(annotation);
    this.contextValue = AnnotationItem._contextValue(annotation);

    // Click jumps to the annotation in the editor
    this.command = {
      command: "foldNote.revealAnnotation",
      title: "Reveal",
      arguments: [annotation],
    };
  }

  private static _label(ann: Annotation): string {
    if (ann.status === "conflicted") {
      return `⚠ ${ann.note || "(no note)"}`;
    }
    if (ann.status === "drifted") {
      return `~ ${ann.note || "(no note)"}`;
    }
    return ann.note || "(no note)";
  }

  private static _description(ann: Annotation): string {
    const start = ann.range.start.line + 1;
    const end = ann.range.end.line + 1;
    const kind = ann.kind === "folder" ? "📁" : `🎨 ${ann.color ?? ""}`;
    return `${kind} · L${start}–${end}`;
  }

  private static _icon(ann: Annotation): vscode.ThemeIcon {
    if (ann.status === "conflicted") {
      return new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("list.warningForeground")
      );
    }
    if (ann.status === "drifted") {
      return new vscode.ThemeIcon(
        "question",
        new vscode.ThemeColor("list.warningForeground")
      );
    }
    if (ann.kind === "folder") {
      return new vscode.ThemeIcon("fold");
    }
    return new vscode.ThemeIcon("symbol-color");
  }

  private static _tooltip(ann: Annotation): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${ann.note || "(no note)"}**\n\n`);
    md.appendMarkdown(
      `Lines ${ann.range.start.line + 1}–${ann.range.end.line + 1}\n\n`
    );
    if (ann.kind === "highlight" && ann.color) {
      md.appendMarkdown(`Color: \`${ann.color}\`\n\n`);
    }
    if (ann.status !== "active") {
      md.appendMarkdown(`⚠ Status: \`${ann.status}\`\n\n`);
    }
    md.appendMarkdown(
      `*Created ${new Date(ann.createdAt).toLocaleString()}*`
    );
    return md;
  }

  private static _contextValue(ann: Annotation): string {
    // Used for showing/hiding inline actions in the view
    if (ann.status === "conflicted") {
      return "foldNote.conflicted";
    }
    if (ann.kind === "folder") {
      return "foldNote.folder";
    }
    return "foldNote.highlight";
  }
}

export type FoldNoteTreeItem = FileItem | AnnotationItem;

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

export class AnnotationTreeProvider
  implements vscode.TreeDataProvider<FoldNoteTreeItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<FoldNoteTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /** Set of file paths known to be orphaned (checked asynchronously). */
  private _orphanedFiles = new Set<string>();

  constructor() {
    // Auto-refresh when the store mutates
    store.onChange(() => {
      this.refresh();
    });
  }

  refresh(): void {
    // Kick off orphan check in background; a second fire happens when done
    this._checkOrphanedFiles().then(() => {
      this._onDidChangeTreeData.fire();
    });
    // Fire immediately too so the tree updates right away
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FoldNoteTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FoldNoteTreeItem): FoldNoteTreeItem[] {
    if (!element) {
      // Root level — one FileItem per tracked file
      return this._buildFileItems();
    }

    if (element instanceof FileItem) {
      if (element.orphaned) {
        return []; // orphaned files have no children to show
      }
      // Children of a file — top-level annotations only
      return this._buildTopLevelAnnotations(element.filePath, element.annotations);
    }

    if (element instanceof AnnotationItem && element.annotation.kind === "folder") {
      // Children of a folder — annotations nested inside it
      return this._buildNestedAnnotations(element.annotation, element.annotation.filePath);
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Orphaned file detection
  // ---------------------------------------------------------------------------

  /**
   * Stats each tracked file path; marks missing ones as orphaned.
   * This method is async and updates `_orphanedFiles` in place.
   */
  async checkOrphanedFiles(): Promise<void> {
    await this._checkOrphanedFiles();
  }

  private async _checkOrphanedFiles(): Promise<void> {
    const wsFolders = vscode.workspace.workspaceFolders;
    if (!wsFolders || wsFolders.length === 0) {
      return;
    }

    const trackedFiles = store.getTrackedFiles();
    const newOrphans = new Set<string>();

    for (const filePath of trackedFiles) {
      // Try to resolve the file in each workspace folder
      let found = false;
      for (const folder of wsFolders) {
        const stripped = filePath.startsWith(folder.name + "/")
          ? filePath.slice(folder.name.length + 1)
          : filePath;
        const uri = vscode.Uri.joinPath(folder.uri, stripped);
        try {
          await vscode.workspace.fs.stat(uri);
          found = true;
          break;
        } catch {
          // not in this folder
        }
      }
      if (!found) {
        newOrphans.add(filePath);
      }
    }

    this._orphanedFiles = newOrphans;
  }

  // ---------------------------------------------------------------------------
  // Private builders
  // ---------------------------------------------------------------------------

  private _buildFileItems(): FileItem[] {
    const files = store.getTrackedFiles();
    if (files.length === 0) {
      return [];
    }

    return files
      .map((filePath) => {
        const annotations = store.getByFile(filePath);
        const orphaned = this._orphanedFiles.has(filePath);
        return new FileItem(filePath, annotations, orphaned);
      })
      .sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  private _buildTopLevelAnnotations(
    filePath: string,
    annotations: Annotation[]
  ): AnnotationItem[] {
    // Top-level = annotations not fully inside any other folder
    const folders = annotations.filter((a) => a.kind === "folder");

    return annotations
      .filter((ann) => !this._hasParent(ann, folders))
      .sort((a, b) => a.range.start.line - b.range.start.line)
      .map((ann) => {
        const hasChildren =
          ann.kind === "folder" &&
          annotations.some(
            (child) =>
              child.id !== ann.id && this._isInside(child.range, ann.range)
          );
        return new AnnotationItem(
          ann,
          hasChildren
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None
        );
      });
  }

  private _buildNestedAnnotations(
    parent: Annotation,
    filePath: string
  ): AnnotationItem[] {
    const all = store.getByFile(filePath);
    const folders = all.filter((a) => a.kind === "folder");

    // Direct children: inside parent but not inside any other folder that is itself inside parent
    return all
      .filter(
        (ann) =>
          ann.id !== parent.id &&
          this._isInside(ann.range, parent.range) &&
          !this._hasParentOtherThan(ann, folders, parent)
      )
      .sort((a, b) => a.range.start.line - b.range.start.line)
      .map((ann) => new AnnotationItem(ann));
  }

  private _isInside(
    inner: Annotation["range"],
    outer: Annotation["range"]
  ): boolean {
    return (
      inner.start.line >= outer.start.line &&
      inner.end.line <= outer.end.line
    );
  }

  private _hasParent(ann: Annotation, folders: Annotation[]): boolean {
    return folders.some(
      (f) => f.id !== ann.id && this._isInside(ann.range, f.range)
    );
  }

  private _hasParentOtherThan(
    ann: Annotation,
    folders: Annotation[],
    exclude: Annotation
  ): boolean {
    return folders.some(
      (f) =>
        f.id !== ann.id &&
        f.id !== exclude.id &&
        this._isInside(ann.range, f.range) &&
        this._isInside(f.range, exclude.range)
    );
  }
}
