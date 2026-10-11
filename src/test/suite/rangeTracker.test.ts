import * as assert from "assert";
import { makeLineRange, AnnotationRange } from "../../model/annotation";

// ---------------------------------------------------------------------------
// We test the pure applyChange logic by extracting it as a standalone fn.
// Since rangeTracker.ts keeps applyChange private, we duplicate it here
// for unit testing purposes (pure function, no VS Code deps).
// ---------------------------------------------------------------------------

type ChangeEvent = {
  range: { start: { line: number }; end: { line: number } };
  text: string;
};

function applyChange(
  range: AnnotationRange,
  change: ChangeEvent
): AnnotationRange | "conflict" {
  const changeStart = change.range.start.line;
  const changeEnd = change.range.end.line;
  const newLineCount = (change.text.match(/\n/g) ?? []).length;
  const removedLines = changeEnd - changeStart;
  const lineDelta = newLineCount - removedLines;

  const annStart = range.start.line;
  const annEnd = range.end.line;

  if (changeStart > annEnd) return range;
  if (changeEnd < annStart) {
    return {
      start: { line: annStart + lineDelta, character: 0 },
      end: { line: annEnd + lineDelta, character: 0 },
    };
  }
  if (changeStart < annStart && changeEnd >= annStart && changeEnd <= annEnd) return "conflict";
  if (changeStart >= annStart && changeStart <= annEnd && changeEnd > annEnd) return "conflict";
  if (changeStart < annStart && changeEnd > annEnd) return "conflict";
  return {
    start: { line: annStart, character: 0 },
    end: { line: annEnd + lineDelta, character: 0 },
  };
}

function change(startLine: number, endLine: number, text: string): ChangeEvent {
  return { range: { start: { line: startLine }, end: { line: endLine } }, text };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("RangeTracker — applyChange", () => {
  // Annotation covers lines 10–20

  test("insert lines above → shifts down", () => {
    const r = makeLineRange(10, 20);
    // Insert 3 lines above (at line 5, replace 0 lines with 3 newlines)
    const result = applyChange(r, change(5, 5, "\n\n\n"));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 13);
      assert.strictEqual(result.end.line, 23);
    }
  });

  test("delete lines above → shifts up", () => {
    const r = makeLineRange(10, 20);
    // Delete lines 3 and 4 — in VS Code the range end is exclusive line,
    // so to remove 2 lines we use start=3, end=5 with empty text
    const result = applyChange(r, change(3, 5, ""));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 8);
      assert.strictEqual(result.end.line, 18);
    }
  });

  test("edit below → no change", () => {
    const r = makeLineRange(10, 20);
    const result = applyChange(r, change(25, 25, "\n\n"));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 10);
      assert.strictEqual(result.end.line, 20);
    }
  });

  test("insert inside → end line grows", () => {
    const r = makeLineRange(10, 20);
    // Insert 2 lines inside at line 15
    const result = applyChange(r, change(15, 15, "\n\n"));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 10);
      assert.strictEqual(result.end.line, 22);
    }
  });

  test("delete inside → end line shrinks", () => {
    const r = makeLineRange(10, 20);
    // Delete 3 lines inside — range end is exclusive, so start=12, end=15
    const result = applyChange(r, change(12, 15, ""));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 10);
      assert.strictEqual(result.end.line, 17);
    }
  });

  test("paste across start boundary → conflict", () => {
    const r = makeLineRange(10, 20);
    // Edit spans lines 8–12 (crosses start at 10)
    const result = applyChange(r, change(8, 12, "replacement"));
    assert.strictEqual(result, "conflict");
  });

  test("paste across end boundary → conflict", () => {
    const r = makeLineRange(10, 20);
    // Edit spans lines 18–22 (crosses end at 20)
    const result = applyChange(r, change(18, 22, "replacement"));
    assert.strictEqual(result, "conflict");
  });

  test("edit wraps entire annotation → conflict", () => {
    const r = makeLineRange(10, 20);
    // Edit spans lines 5–25 (wraps entire annotation)
    const result = applyChange(r, change(5, 25, "replacement"));
    assert.strictEqual(result, "conflict");
  });

  test("collapse to single line → caller detects conflict", () => {
    const r = makeLineRange(10, 11);
    // Delete the second line — range end exclusive means start=10, end=11 with ""
    // removes line 10's newline, collapsing to one line
    const result = applyChange(r, change(10, 11, ""));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.ok(result.end.line - result.start.line < 1);
    }
  });
});
