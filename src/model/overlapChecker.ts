import { AnnotationRange, Annotation } from "./annotation";

/**
 * Result of an overlap check between a proposed new folder range
 * and the existing folders for the same file.
 */
export type OverlapResult =
  | { kind: "ok" }
  | { kind: "identical"; existing: Annotation }
  | { kind: "partial"; existing: Annotation }
  | { kind: "nested_inside"; parent: Annotation }
  | { kind: "contains"; children: Annotation[] };

// ---------------------------------------------------------------------------
// Private helpers (line-level only — folders always cover whole lines)
// ---------------------------------------------------------------------------

function linesOverlap(a: AnnotationRange, b: AnnotationRange): boolean {
  return a.start.line <= b.end.line && b.start.line <= a.end.line;
}

function fullyInside(inner: AnnotationRange, outer: AnnotationRange): boolean {
  return (
    inner.start.line >= outer.start.line &&
    inner.end.line <= outer.end.line
  );
}

function identical(a: AnnotationRange, b: AnnotationRange): boolean {
  return a.start.line === b.start.line && a.end.line === b.end.line;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether `proposed` (a new folder range) conflicts with any of the
 * `existing` folder annotations in the same file.
 *
 * Rules (line-level):
 *   identical range           → rejected
 *   fully inside existing     → allowed (nested child)
 *   fully contains existing   → allowed (becomes parent)
 *   partial overlap           → rejected
 *   no overlap / adjacent     → allowed
 *
 * Conflicted and drifted folders are skipped — they are not physically
 * folded so they cannot cause a real layout conflict.
 * Highlights are never passed in and never checked here.
 */
export function checkOverlap(
  proposed: AnnotationRange,
  existing: Annotation[]
): OverlapResult {
  const contained: Annotation[] = [];

  for (const ann of existing) {
    if (ann.kind !== "folder") {
      continue;
    }
    if (ann.status === "conflicted" || ann.status === "drifted") {
      continue;
    }

    const r = ann.range;

    if (!linesOverlap(proposed, r)) {
      continue; // no overlap at all — fine
    }

    if (identical(proposed, r)) {
      return { kind: "identical", existing: ann };
    }

    if (fullyInside(proposed, r)) {
      // proposed sits fully inside this existing folder — nested child
      return { kind: "nested_inside", parent: ann };
    }

    if (fullyInside(r, proposed)) {
      // this existing folder sits fully inside proposed — collect as child
      contained.push(ann);
      continue;
    }

    // partial overlap — rejected
    return { kind: "partial", existing: ann };
  }

  if (contained.length > 0) {
    return { kind: "contains", children: contained };
  }

  return { kind: "ok" };
}

/**
 * Human-readable rejection message for the user.
 * Returns undefined for non-rejected results.
 */
export function overlapMessage(result: OverlapResult): string | undefined {
  switch (result.kind) {
    case "identical":
      return (
        `A folder already covers exactly this range ` +
        `(L${result.existing.range.start.line + 1}–${result.existing.range.end.line + 1}: ` +
        `"${result.existing.note}"). Choose a different range.`
      );
    case "partial":
      return (
        `This range partially overlaps with "${result.existing.note}" ` +
        `(L${result.existing.range.start.line + 1}–${result.existing.range.end.line + 1}). ` +
        `Folders must nest cleanly. Adjust your selection and try again.`
      );
    default:
      return undefined;
  }
}
