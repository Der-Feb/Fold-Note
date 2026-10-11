/**
 * Core annotation types for FoldNote.
 *
 * An annotation is the single underlying concept for both folders and
 * highlights. Each has a unique UUID, lives in one file, covers a range,
 * and carries optional metadata.
 */

/** The two kinds of annotation. */
export type AnnotationKind = "folder" | "highlight";

/** Health status of an annotation after range tracking. */
export type AnnotationStatus =
  | "active"      // range is valid and in sync
  | "conflicted"  // an edit broke the range (e.g. paste across boundary)
  | "drifted";    // file changed outside the editor; range may have moved

/** A character-level position within a document (0-based). */
export interface AnnotationPosition {
  line: number;
  character: number;
}

/** An inclusive start–end range. */
export interface AnnotationRange {
  start: AnnotationPosition;
  end: AnnotationPosition;
}

/** The full annotation record stored in the data model. */
export interface Annotation {
  /** UUID v4 — unique across the entire workspace. */
  id: string;

  /**
   * Workspace-relative file path.
   * In a multi-root workspace this is prefixed with the root folder name,
   * e.g. "my-root/src/utils.ts".
   */
  filePath: string;

  /** The line/character range this annotation covers. */
  range: AnnotationRange;

  /** Folder or highlight. */
  kind: AnnotationKind;

  /**
   * Human-readable note.
   * Required for folders, optional (empty string) for highlights.
   */
  note: string;

  /**
   * Named color key (highlights only).
   * Resolved against the highlightColors setting at render time.
   */
  color?: string;

  /**
   * Short hash of the first line of the range at creation time.
   * Used to detect drift when the file is edited outside VS Code.
   */
  anchorHash?: string;

  /** Current health of the annotation. */
  status: AnnotationStatus;

  /** ISO timestamp — when the annotation was created. */
  createdAt: string;

  /** ISO timestamp — when the annotation was last modified. */
  updatedAt: string;
}

/** Convenience: create a minimal AnnotationRange from 0-based line numbers. */
export function makeLineRange(
  startLine: number,
  endLine: number
): AnnotationRange {
  return {
    start: { line: startLine, character: 0 },
    end: { line: endLine, character: 0 },
  };
}
